import asyncio
import logging
import math
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
from app.db.models import JobDescription, CandidateProfile, CandidateJobEntry, PipelineStageHistory, InterviewSchedule, InterviewerFeedback
from app.core.config import settings
from app.core.http_client import get_ai_client
from app.schemas.candidate_schema import AIResult

logger = logging.getLogger("svc-recruiting")

VALID_STATUSES = {"active", "inactive", "blacklisted"}

ROLE_CATEGORY_MAP = {
    "engineer": "Engineering", "developer": "Engineering", "software": "Engineering",
    "devops": "Engineering", "sre": "Engineering", "backend": "Engineering",
    "frontend": "Engineering", "fullstack": "Engineering", "data scientist": "Engineering",
    "machine learning": "Engineering", "ml": "Engineering", "qa": "Engineering",
    "test": "Engineering", "architect": "Engineering",
    "hr": "HR", "human resource": "HR", "recruiter": "HR", "talent": "HR",
    "people": "HR", "hiring": "HR",
    "finance": "Finance", "accountant": "Finance", "accounting": "Finance",
    "controller": "Finance", "cfo": "Finance", "audit": "Finance", "tax": "Finance",
    "marketing": "Marketing", "growth": "Marketing", "seo": "Marketing",
    "content": "Marketing", "brand": "Marketing", "digital marketing": "Marketing",
    "sales": "Sales", "account executive": "Sales", "business development": "Sales",
    "bdr": "Sales", "sdr": "Sales",
    "it": "IT", "system admin": "IT", "network": "IT", "infrastructure": "IT",
    "security": "IT", "helpdesk": "IT", "support": "IT",
    "product": "Product", "product manager": "Product", "program manager": "Product",
    "scrum": "Product", "agile": "Product",
    "design": "Design", "ux": "Design", "ui": "Design", "graphic": "Design",
    "creative": "Design",
}


def derive_category(current_role: str) -> str:
    if not current_role:
        return "Other"
    role_lower = current_role.lower()
    for keyword, category in ROLE_CATEGORY_MAP.items():
        if keyword in role_lower:
            return category
    return "Other"


def _clamp_ai_scores(ai_result: dict) -> dict:
    """Clamp AI scores to configured maximums and build detailed breakdown."""
    score_dict = settings.RESUME_SCORE_DICT
    cat_scores = ai_result.get("category_scores", {})

    clamped_total = 0
    for cat_scores_key, cat_scores_value in list(cat_scores.items()):
        if cat_scores_key == "total_score":
            continue
        if isinstance(cat_scores_value, dict):
            clamped_total += cat_scores_value.get("obtained_score", 0)
            continue
        if cat_scores_key in score_dict:
            clamped = max(0, min(cat_scores_value, score_dict[cat_scores_key]))
            ai_result["category_scores"][cat_scores_key] = {
                "obtained_score": clamped,
                "max_score": score_dict[cat_scores_key]
            }
            clamped_total += clamped
        else:
            clamped = max(0, cat_scores_value)
            ai_result["category_scores"][cat_scores_key] = {
                "obtained_score": clamped,
                "max_score": 10
            }
            clamped_total += clamped

    ai_result["category_scores"]["total_score"] = {
        "obtained_score": clamped_total,
        "max_score": score_dict.get("total_score", 100),
    }
    return ai_result


# ── Profile helpers ──────────────────────────────────────────────────────

async def _find_or_create_profile(
    db: AsyncSession,
    email: Optional[str],
    full_name: Optional[str],
    phone: Optional[str],
    resume_url: Optional[str],
    category: str,
    source: str,
    created_by: str,
    parsed_metadata: Optional[dict] = None,
    linkedin_url: Optional[str] = None,
    github_url: Optional[str] = None,
    portfolio_url: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> tuple:
    """Find existing profile by email/phone/linkedin/github or create a new one.
    Returns (CandidateProfile, was_existing: bool) tuple."""
    from app.utils.phone_utils import normalize_phone

    existing = None

    # Build OR conditions for matching
    or_conditions = []
    if email:
        or_conditions.append(func.lower(CandidateProfile.email) == email.lower())
    if phone:
        normalized = normalize_phone(phone)
        if normalized:
            or_conditions.append(CandidateProfile.phone.ilike(f"%{normalized}%"))
    if linkedin_url:
        or_conditions.append(CandidateProfile.linkedin_url == linkedin_url)
    if github_url:
        or_conditions.append(CandidateProfile.github_url == github_url)

    if or_conditions:
        result = await db.execute(
            select(CandidateProfile).where(
                or_(*or_conditions),
                CandidateProfile.deleted_at.is_(None),
            ).limit(1)
        )
        existing = result.scalar_one_or_none()

    if existing:
        # Update fields with newer data
        if resume_url:
            existing.resume_url = resume_url
            existing.updated_at = datetime.utcnow()
        if full_name and not existing.full_name:
            existing.full_name = full_name
        if phone and not existing.phone:
            existing.phone = phone
        if category and category != "Other":
            existing.category = category
        if parsed_metadata:
            existing.parsed_metadata = parsed_metadata
        if linkedin_url and not existing.linkedin_url:
            existing.linkedin_url = linkedin_url
        if github_url and not existing.github_url:
            existing.github_url = github_url
        if portfolio_url and not existing.portfolio_url:
            existing.portfolio_url = portfolio_url
        if photo_url and not existing.photo_url:
            existing.photo_url = photo_url
        return existing, True

    profile = CandidateProfile(
        email=email,
        full_name=full_name,
        phone=phone,
        resume_url=resume_url,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        photo_url=photo_url,
        category=category,
        original_source=source,
        created_by=created_by,
        parsed_metadata=parsed_metadata,
    )
    db.add(profile)
    await db.flush()
    return profile, False


# ── Core candidate operations ────────────────────────────────────────────

async def evaluate_and_save_candidate(db: AsyncSession, user_id: str, jd_id: str, resume_url: str, use_rubric: bool = True, async_ai: bool = False):
    """Evaluate and save a candidate. Creates profile + job entry."""
    result = await db.execute(select(JobDescription).where(JobDescription.id == int(jd_id)))
    jd = result.scalar_one_or_none()
    if not jd:
        raise ValueError("JD not found")

    if async_ai:
        # Create profile + entry with empty AI analysis, enqueue background job
        profile, was_existing = await _find_or_create_profile(
            db, email=None, full_name=None, phone=None,
            resume_url=resume_url, category="Other", source="manual",
            created_by=user_id,
        )
        # Check if entry already exists for this profile + job
        existing_entry = (await db.execute(
            select(CandidateJobEntry).where(
                CandidateJobEntry.profile_id == profile.id,
                CandidateJobEntry.jd_id == int(jd_id),
            )
        )).scalar_one_or_none()
        if existing_entry:
            entry = existing_entry
            entry.ai_resume_analysis = {}
            entry.onboard = False
        else:
            entry = CandidateJobEntry(
                profile_id=profile.id,
                jd_id=int(jd_id),
                user_id=user_id,
                ai_resume_analysis={},
                onboard=False,
                screening=False,
                interview_status=False,
            )
            db.add(entry)
        await db.commit()
        await db.refresh(entry)

        from app.services.ai_queue_service import enqueue_ai_job
        ai_job_id = await enqueue_ai_job(
            db,
            job_type="resume_scoring",
            resource_id=entry.id,
            resource_type="candidate",
            input_data={"resume_url": resume_url, "jd_id": str(jd_id), "use_rubric": use_rubric},
        )
        return {
            "candidate_id": str(entry.id),
            "ai_status": "processing",
            "ai_job_id": ai_job_id,
        }

    # Synchronous AI call
    payload = {
        "resume_file_link": resume_url,
        "parsed_jd": jd.ai_result,
        "rubric_text": jd.rubric_text if use_rubric else ""
    }

    try:
        client = get_ai_client()
        response = await client.post(f"{settings.AI_RESUME_URL}/resume/analyze", json=payload)
        response.raise_for_status()
        ai_result_data = response.json()
        ai_result = AIResult(**ai_result_data)
    except Exception as e:
        logger.error("Resume analysis failed: %s", e)
        raise

    ai_result = ai_result.model_dump()
    ai_result = _clamp_ai_scores(ai_result)

    meta = ai_result.get("metadata", {})
    current_role = meta.get("current_role", "")
    email = meta.get("email")
    full_name = meta.get("full_name")
    phone = meta.get("phone")
    cat = derive_category(current_role)

    profile, was_existing = await _find_or_create_profile(
        db, email=email, full_name=full_name, phone=phone,
        resume_url=resume_url, category=cat, source="manual",
        created_by=user_id,
    )

    # Check if entry already exists for this profile + job (re-upload scenario)
    existing_entry = (await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.profile_id == profile.id,
            CandidateJobEntry.jd_id == int(jd_id),
        )
    )).scalar_one_or_none()
    if existing_entry:
        entry = existing_entry
        entry.ai_resume_analysis = ai_result
        entry.onboard = True
    else:
        entry = CandidateJobEntry(
            profile_id=profile.id,
            jd_id=int(jd_id),
            user_id=user_id,
            ai_resume_analysis=ai_result,
            onboard=True,
            screening=False,
            interview_status=False,
        )
        db.add(entry)
    await db.commit()
    await db.refresh(entry)

    response = {
        "candidate_id": str(entry.id),
        **ai_result
    }

    # Attach duplicate info when profile already existed
    if was_existing:
        from app.services.duplicate_detection_service import _get_profile_job_history
        match_reasons = []
        if email and profile.email and profile.email.lower() == email.lower():
            match_reasons.append("email")
        if phone and profile.phone:
            from app.utils.phone_utils import normalize_phone as _np
            if _np(profile.phone) == _np(phone):
                match_reasons.append("phone")
        if not match_reasons:
            match_reasons.append("profile")
        existing_jobs = await _get_profile_job_history(db, profile.id)
        response["duplicate_info"] = {
            "profile_id": profile.id,
            "matched_name": profile.full_name,
            "matched_email": profile.email,
            "match_reasons": match_reasons,
            "existing_jobs": existing_jobs,
            "message": "A candidate with matching information already exists.",
        }

    return response


async def evaluate_and_save_candidate_sync_ai(db: AsyncSession, jd_id: str, resume_url: str, use_rubric: bool = True) -> dict:
    """Called by AI worker — performs AI call and returns result dict."""
    result = await db.execute(select(JobDescription).where(JobDescription.id == int(jd_id)))
    jd = result.scalar_one_or_none()
    if not jd:
        raise ValueError("JD not found")

    payload = {
        "resume_file_link": resume_url,
        "parsed_jd": jd.ai_result,
        "rubric_text": jd.rubric_text if use_rubric else ""
    }

    client = get_ai_client()
    response = await client.post(f"{settings.AI_RESUME_URL}/resume/analyze", json=payload)
    response.raise_for_status()
    ai_result_data = response.json()
    ai_result = AIResult(**ai_result_data).model_dump()
    ai_result = _clamp_ai_scores(ai_result)

    return ai_result


async def evaluate_and_save_multiple_candidates(db: AsyncSession, user_id: str, jd_id: str, resume_files: List, use_rubric: bool = True):
    from uuid import uuid4
    import os

    results_list = []
    successful_count = 0
    failed_count = 0

    for resume_file in resume_files:
        try:
            file_extension = os.path.splitext(resume_file.filename)[1] if resume_file.filename else ".pdf"
            resume_filename = f"{uuid4()}_{resume_file.filename if resume_file.filename else f'resume{file_extension}'}"
            resume_path = os.path.join(settings.UPLOAD_BASE, "resume", resume_filename)
            os.makedirs(os.path.dirname(resume_path), exist_ok=True)

            with open(resume_path, "wb") as f:
                f.write(await resume_file.read())

            resume_url = f"{settings.BACKEND_DOMAIN}/files/resume/{resume_filename}"
            result = await evaluate_and_save_candidate(db, user_id, jd_id, resume_url, use_rubric)

            results_list.append({
                "candidate_id": result["candidate_id"],
                "success": True,
                "error": None,
                "data": result
            })
            successful_count += 1

        except Exception as e:
            results_list.append({
                "candidate_id": "",
                "success": False,
                "error": str(e),
                "data": None
            })
            failed_count += 1

    return {
        "total_files": len(resume_files),
        "successful_uploads": successful_count,
        "failed_uploads": failed_count,
        "results": results_list
    }


async def update_candidate_onboard_status(db: AsyncSession, candidate_id: str, onboard: bool):
    result = await db.execute(
        update(CandidateJobEntry).where(CandidateJobEntry.id == int(candidate_id)).values(onboard=onboard)
    )
    await db.commit()
    return result.rowcount > 0


async def update_candidate_screening_status(db: AsyncSession, candidate_id: str, screening: bool):
    result = await db.execute(
        update(CandidateJobEntry).where(CandidateJobEntry.id == int(candidate_id)).values(screening=screening)
    )
    await db.commit()
    return result.rowcount > 0


def _extract_total_score(raw) -> float:
    if isinstance(raw, (int, float)):
        return raw
    if isinstance(raw, dict):
        return raw.get("obtained_score", 0)
    return 0


def _entry_to_dict(entry: CandidateJobEntry, profile: CandidateProfile) -> dict:
    """Convert a CandidateJobEntry + CandidateProfile pair to the legacy dict format."""
    ai = entry.ai_resume_analysis or {}
    metadata = ai.get("metadata", {})
    current_role = metadata.get("current_role", "") or (profile.parsed_metadata or {}).get("current_role", "")
    return {
        "_id": str(entry.id),
        "user_id": entry.user_id,
        "jd_id": str(entry.jd_id),
        "profile_id": profile.id,
        "ai_resume_analysis": entry.ai_resume_analysis,
        "resume_url": profile.resume_url,
        "status": profile.status or "active",
        "category": profile.category or derive_category(current_role),
        "source": entry.source or "manual",
        "application_id": entry.application_id,
        "onboard": entry.onboard,
        "screening": entry.screening,
        "interview_status": entry.interview_status,
        "created_at": entry.created_at,
        "imported_at": entry.imported_at,
        "pipeline_stage": entry.pipeline_stage or "applied",
        # Profile fields for convenience (fallback to AI metadata)
        "full_name": profile.full_name or metadata.get("full_name"),
        "email": profile.email or metadata.get("email"),
        "phone": profile.phone or metadata.get("phone"),
    }


async def get_candidates(
    db: AsyncSession,
    jd_id: str = None,
    pipeline_stage: str = None,
    search: str = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Get candidates (job entries) with joined profile data."""
    base = select(CandidateJobEntry, CandidateProfile).join(
        CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
    ).where(CandidateJobEntry.deleted_at.is_(None))

    count_q = select(func.count()).select_from(
        select(CandidateJobEntry).join(
            CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
        ).where(CandidateJobEntry.deleted_at.is_(None)).subquery()
    )

    if jd_id:
        base = base.where(CandidateJobEntry.jd_id == int(jd_id))
        count_q = select(func.count()).select_from(
            select(CandidateJobEntry).join(
                CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
            ).where(CandidateJobEntry.deleted_at.is_(None), CandidateJobEntry.jd_id == int(jd_id)).subquery()
        )

    if pipeline_stage:
        valid_stages = {"applied", "screening", "ai_interview", "interview", "offer", "hired", "rejected"}
        if pipeline_stage in valid_stages:
            base = base.where(CandidateJobEntry.pipeline_stage == pipeline_stage)
            # Rebuild count query with all filters
            count_sub = select(CandidateJobEntry.id).join(
                CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
            ).where(CandidateJobEntry.deleted_at.is_(None), CandidateJobEntry.pipeline_stage == pipeline_stage)
            if jd_id:
                count_sub = count_sub.where(CandidateJobEntry.jd_id == int(jd_id))
            count_q = select(func.count()).select_from(count_sub.subquery())

    if search:
        search_filter = f"%{search}%"
        base = base.where(
            (CandidateProfile.full_name.ilike(search_filter)) |
            (CandidateProfile.email.ilike(search_filter))
        )
        # Rebuild count query with search
        count_sub = select(CandidateJobEntry.id).join(
            CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
        ).where(
            CandidateJobEntry.deleted_at.is_(None),
            (CandidateProfile.full_name.ilike(search_filter)) |
            (CandidateProfile.email.ilike(search_filter))
        )
        if jd_id:
            count_sub = count_sub.where(CandidateJobEntry.jd_id == int(jd_id))
        if pipeline_stage and pipeline_stage in {"applied", "screening", "ai_interview", "interview", "offer", "hired", "rejected"}:
            count_sub = count_sub.where(CandidateJobEntry.pipeline_stage == pipeline_stage)
        count_q = select(func.count()).select_from(count_sub.subquery())

    total = (await db.execute(count_q)).scalar_one()
    offset = (page - 1) * page_size
    query = base.order_by(CandidateJobEntry.id.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)

    items = [_entry_to_dict(entry, profile) for entry, profile in result.all()]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


async def get_candidates_analytics(db: AsyncSession, jd_id: str = None) -> list:
    query = select(CandidateJobEntry).where(CandidateJobEntry.deleted_at.is_(None))
    if jd_id:
        query = query.where(CandidateJobEntry.jd_id == int(jd_id))
    result = await db.execute(query)
    return [
        {"onboard": e.onboard, "ai_resume_analysis": e.ai_resume_analysis}
        for e in result.scalars().all()
    ]


async def get_candidate_by_id(db: AsyncSession, candidate_id: str) -> Optional[dict]:
    """Get a single candidate entry with profile."""
    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile).join(
            CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
        ).where(CandidateJobEntry.id == int(candidate_id), CandidateJobEntry.deleted_at.is_(None))
    )
    row = result.first()
    if not row:
        return None
    return _entry_to_dict(row[0], row[1])


async def delete_candidate(db: AsyncSession, candidate_id: str, deleted_by: str = "system") -> bool:
    result = await db.execute(
        update(CandidateJobEntry)
        .where(CandidateJobEntry.id == int(candidate_id), CandidateJobEntry.deleted_at.is_(None))
        .values(deleted_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


async def update_candidate_status(db: AsyncSession, candidate_id: str, status: str) -> bool:
    """Update person-level status on profile. candidate_id can be an entry ID or profile ID."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    # Try to find the profile: first check if it's a profile ID
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.id == int(candidate_id)))
    profile = result.scalar_one_or_none()

    if not profile:
        # It's an entry ID — look up the profile via entry
        entry_result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id == int(candidate_id)))
        entry = entry_result.scalar_one_or_none()
        if not entry:
            return False
        result = await db.execute(select(CandidateProfile).where(CandidateProfile.id == entry.profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            return False

    profile.status = status
    profile.updated_at = datetime.utcnow()
    await db.commit()
    return True


async def get_candidates_for_import(
    db: AsyncSession, job_id: str, category: Optional[str] = None
) -> list:
    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile).join(
            CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
        ).where(CandidateJobEntry.jd_id == int(job_id), CandidateJobEntry.deleted_at.is_(None))
    )
    output = []
    for entry, profile in result.all():
        ai = entry.ai_resume_analysis or {}
        metadata = ai.get("metadata", {})
        current_role = metadata.get("current_role", "N/A")
        resolved_category = profile.category or derive_category(current_role)
        if category and resolved_category != category:
            continue
        output.append({
            "candidate_id": str(entry.id),
            "name": profile.full_name or metadata.get("full_name", "N/A"),
            "email": profile.email or metadata.get("email", "N/A"),
            "currentRole": current_role,
            "experience": metadata.get("years_of_experience", 0),
            "category": resolved_category,
            "resume_url": profile.resume_url,
        })
    return output


async def search_candidates_global(
    db: AsyncSession, query: str, exclude_jd_id: str, limit: int = 20,
    category: Optional[str] = None,
) -> list:
    """Typeahead search across profiles by name or email."""
    where_clauses = [CandidateProfile.deleted_at.is_(None)]
    if query.strip():
        pattern = f"%{query.strip().lower()}%"
        where_clauses.append(
            or_(
                func.lower(CandidateProfile.full_name).like(pattern),
                func.lower(CandidateProfile.email).like(pattern),
            )
        )
    if category:
        where_clauses.append(CandidateProfile.category == category)

    result = await db.execute(
        select(CandidateProfile).where(*where_clauses).order_by(CandidateProfile.id.desc()).limit(limit * 2)
    )
    profiles = result.scalars().all()

    # Filter out profiles that only have entries for exclude_jd_id
    output = []
    for p in profiles:
        if len(output) >= limit:
            break
        # Get any entry not for the excluded job
        entry_result = await db.execute(
            select(CandidateJobEntry).where(
                CandidateJobEntry.profile_id == p.id,
                CandidateJobEntry.jd_id != int(exclude_jd_id),
                CandidateJobEntry.deleted_at.is_(None),
            ).limit(1)
        )
        source_entry = entry_result.scalar_one_or_none()

        # Get job title from any entry
        any_entry_result = await db.execute(
            select(CandidateJobEntry).where(
                CandidateJobEntry.profile_id == p.id,
                CandidateJobEntry.deleted_at.is_(None),
            ).order_by(CandidateJobEntry.created_at.desc()).limit(1)
        )
        any_entry = any_entry_result.scalar_one_or_none()
        if not any_entry:
            continue

        ai = any_entry.ai_resume_analysis or {}
        meta = ai.get("metadata", {})

        # Resolve job title
        source_jd_id = source_entry.jd_id if source_entry else any_entry.jd_id
        jd_result = await db.execute(select(JobDescription).where(JobDescription.id == source_jd_id))
        jd = jd_result.scalar_one_or_none()
        jd_title = "Unknown"
        if jd and isinstance(jd.ai_result, dict):
            jd_title = jd.ai_result.get("job_title", "Untitled")

        output.append({
            "candidate_id": str(any_entry.id),
            "profile_id": p.id,
            "name": p.full_name or meta.get("full_name", "N/A"),
            "email": p.email or meta.get("email", "N/A"),
            "currentRole": meta.get("current_role", "N/A"),
            "experience": meta.get("years_of_experience", 0),
            "category": p.category or derive_category(meta.get("current_role", "")),
            "resume_url": p.resume_url,
            "source_job_id": str(source_jd_id),
            "source_job_title": jd_title,
        })
    return output


async def import_candidates_to_job(db: AsyncSession, target_job_id: str, candidate_ids: List[str], user_id: str) -> int:
    """Import candidates to a new job. candidate_ids can be entry IDs or profile IDs."""
    if not candidate_ids:
        return 0

    now = datetime.utcnow()
    new_entries = []
    int_ids = [int(cid) for cid in candidate_ids]

    # First try as entry IDs (frontend sends CandidateJobEntry IDs)
    entries_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id.in_(int_ids))
    )
    entries = entries_result.scalars().all()

    if entries:
        profile_ids = {e.profile_id for e in entries}
        profiles_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id.in_(profile_ids))
        )
        profiles = {p.id: p for p in profiles_result.scalars().all()}
    else:
        # Fall back to profile IDs
        profiles_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id.in_(int_ids))
        )
        profiles = {p.id: p for p in profiles_result.scalars().all()}
        if not profiles:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="No matching candidates found")

    # Check which profiles already have entries for the target job
    existing_result = await db.execute(
        select(CandidateJobEntry.profile_id).where(
            CandidateJobEntry.jd_id == int(target_job_id),
            CandidateJobEntry.profile_id.in_(profiles.keys()),
        )
    )
    already_in_job = {row[0] for row in existing_result.all()}

    for profile_id, profile in profiles.items():
        if profile_id in already_in_job:
            continue

        # Get latest entry for this profile to copy metadata
        latest_entry_result = await db.execute(
            select(CandidateJobEntry).where(
                CandidateJobEntry.profile_id == profile_id,
            ).order_by(CandidateJobEntry.created_at.desc()).limit(1)
        )
        latest_entry = latest_entry_result.scalar_one_or_none()

        old_ai = latest_entry.ai_resume_analysis if latest_entry else {}
        metadata_only = {"metadata": (old_ai or {}).get("metadata", {})}

        new_entries.append(CandidateJobEntry(
            profile_id=profile_id,
            jd_id=int(target_job_id),
            user_id=user_id,
            ai_resume_analysis=metadata_only,
            onboard=False,
            screening=False,
            interview_status=False,
            source="import",
            imported_at=now,
        ))

    if new_entries:
        db.add_all(new_entries)
        await db.commit()

        # Enqueue async AI evaluation for each imported candidate against the new job
        from app.services.ai_queue_service import enqueue_ai_job
        for entry in new_entries:
            await db.refresh(entry)
            resume_url = profiles[entry.profile_id].resume_url if entry.profile_id in profiles else None
            if resume_url:
                await enqueue_ai_job(
                    db,
                    job_type="resume_scoring",
                    resource_id=entry.id,
                    resource_type="candidate",
                    input_data={
                        "resume_url": resume_url,
                        "jd_id": str(target_job_id),
                        "use_rubric": True,
                    },
                )

    return len(new_entries)


async def get_talent_pool(
    db: AsyncSession,
    search: Optional[str] = None,
    min_experience: Optional[int] = None,
    max_experience: Optional[int] = None,
    jd_id: Optional[str] = None,
    sort: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Talent pool: returns unique CandidateProfile items with job counts."""
    from sqlalchemy import cast, Integer

    base_where = [CandidateProfile.deleted_at.is_(None)]

    if status:
        base_where.append(CandidateProfile.status == status)
    if category:
        base_where.append(CandidateProfile.category == category)
    if search:
        search_pattern = f"%{search.lower()}%"
        base_where.append(or_(
            func.lower(CandidateProfile.full_name).like(search_pattern),
            func.lower(CandidateProfile.email).like(search_pattern),
        ))

    # If filtering by jd_id, only show profiles that have an entry for that job
    if jd_id:
        subq = select(CandidateJobEntry.profile_id).where(
            CandidateJobEntry.jd_id == int(jd_id),
            CandidateJobEntry.deleted_at.is_(None),
        ).correlate(None).scalar_subquery()
        base_where.append(CandidateProfile.id.in_(subq))

    # Show profiles that have a scored entry (onboard=True) OR have zero job entries (manual additions)
    scored_subq = select(CandidateJobEntry.profile_id).where(
        CandidateJobEntry.onboard == True,
        CandidateJobEntry.deleted_at.is_(None),
    ).correlate(None).scalar_subquery()
    has_any_entry_subq = select(CandidateJobEntry.profile_id).where(
        CandidateJobEntry.deleted_at.is_(None),
    ).correlate(None).scalar_subquery()
    base_where.append(or_(
        CandidateProfile.id.in_(scored_subq),
        ~CandidateProfile.id.in_(has_any_entry_subq),
    ))

    count_q = select(func.count()).select_from(CandidateProfile).where(*base_where)
    total = (await db.execute(count_q)).scalar_one()

    # Job count subquery
    job_count_sq = (
        select(func.count(CandidateJobEntry.id))
        .where(
            CandidateJobEntry.profile_id == CandidateProfile.id,
            CandidateJobEntry.deleted_at.is_(None),
        )
        .correlate(CandidateProfile)
        .scalar_subquery()
        .label("job_count")
    )

    query = select(CandidateProfile, job_count_sq).where(*base_where)

    if sort == 'newest':
        query = query.order_by(CandidateProfile.created_at.desc())
    elif sort == 'oldest':
        query = query.order_by(CandidateProfile.created_at.asc())
    else:
        query = query.order_by(CandidateProfile.created_at.desc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for profile, job_count in rows:
        meta = profile.parsed_metadata or {}
        # Get skills from the latest scored entry
        latest_entry_result = await db.execute(
            select(CandidateJobEntry).where(
                CandidateJobEntry.profile_id == profile.id,
                CandidateJobEntry.onboard == True,
                CandidateJobEntry.deleted_at.is_(None),
            ).order_by(CandidateJobEntry.created_at.desc()).limit(1)
        )
        latest_entry = latest_entry_result.scalar_one_or_none()
        ai = latest_entry.ai_resume_analysis if latest_entry else {}
        ai_meta = ai.get("metadata", {}) if isinstance(ai, dict) else {}
        pm = profile.parsed_metadata or {}

        # Skills: prefer AI highlighted, then parsed_metadata skills
        ai_skills = (ai.get("highlighted_skills", []) or ai.get("key_skills", []))[:8] if isinstance(ai, dict) else []
        skills = ai_skills or (pm.get("skills", []) or [])[:8]

        items.append({
            "_id": str(profile.id),
            "profile_id": profile.id,
            "name": profile.full_name or ai_meta.get("full_name", "N/A"),
            "email": profile.email or "",
            "current_role": ai_meta.get("current_role") or pm.get("current_role", ""),
            "location": ai_meta.get("location") or pm.get("location", ""),
            "experience": ai_meta.get("years_of_experience", 0) if isinstance(ai_meta.get("years_of_experience"), (int, float)) else (pm.get("years_of_experience", 0) if isinstance(pm.get("years_of_experience"), (int, float)) else 0),
            "category": profile.category or derive_category(ai_meta.get("current_role") or pm.get("current_role", "")),
            "status": profile.status or "active",
            "resume_url": profile.resume_url,
            "skills": skills,
            "job_count": job_count or 0,
            "created_at": str(profile.created_at) if profile.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)) if total else 0,
    }


async def get_talent_pool_profile(db: AsyncSession, profile_id: str) -> Optional[dict]:
    """Get a single profile for the talent pool drawer."""
    result = await db.execute(
        select(CandidateProfile).where(
            CandidateProfile.id == int(profile_id),
            CandidateProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return None

    # Get latest scored entry for AI data
    entry_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.profile_id == profile.id,
            CandidateJobEntry.onboard == True,
            CandidateJobEntry.deleted_at.is_(None),
        ).order_by(CandidateJobEntry.created_at.desc()).limit(1)
    )
    entry = entry_result.scalar_one_or_none()
    ai = entry.ai_resume_analysis if entry else {}

    return {
        "_id": str(profile.id),
        "profile_id": profile.id,
        "full_name": profile.full_name,
        "email": profile.email,
        "phone": profile.phone,
        "resume_url": profile.resume_url,
        "status": profile.status or "active",
        "category": profile.category,
        "notes": profile.notes,
        "ai_resume_analysis": ai,
        "parsed_metadata": profile.parsed_metadata,
        "created_at": str(profile.created_at) if profile.created_at else None,
        "linkedin_url": profile.linkedin_url,
        "github_url": profile.github_url,
        "portfolio_url": profile.portfolio_url,
    }


async def get_candidate_job_history(db: AsyncSession, candidate_id: str) -> list:
    """All jobs this candidate has been evaluated for. candidate_id is a profile ID."""
    profile_id = int(candidate_id)

    # Check if it's a profile ID
    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == profile_id)
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        # Maybe it's an entry ID — resolve to profile
        entry_result = await db.execute(
            select(CandidateJobEntry).where(CandidateJobEntry.id == profile_id)
        )
        entry = entry_result.scalar_one_or_none()
        if not entry:
            return []
        profile_id = entry.profile_id

    # Get all entries for this profile
    entries_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.profile_id == profile_id,
            CandidateJobEntry.deleted_at.is_(None),
        ).order_by(CandidateJobEntry.created_at.desc())
    )
    entries = entries_result.scalars().all()

    # Batch-load job titles
    jd_ids = {e.jd_id for e in entries}
    jd_map = {}
    if jd_ids:
        jd_result = await db.execute(select(JobDescription).where(JobDescription.id.in_(jd_ids)))
        for jd in jd_result.scalars().all():
            title = jd.ai_result.get("job_title", "Untitled") if isinstance(jd.ai_result, dict) else "Untitled"
            jd_map[jd.id] = title

    history = []
    for e in entries:
        ai = e.ai_resume_analysis or {}
        history.append({
            "entry_id": e.id,
            "candidate_id": str(e.id),
            "jd_id": str(e.jd_id),
            "job_title": jd_map.get(e.jd_id, "Unknown"),
            "recommendation": ai.get("ai_recommendation", ""),
            "total_score": ai.get("category_scores", {}).get("total_score", 0),
            "pipeline_stage": e.pipeline_stage,
            "onboard": e.onboard,
            "created_at": str(e.created_at) if e.created_at else None,
        })
    return history


async def get_job_statistics(db: AsyncSession, job_id: str) -> dict:
    candidates = await get_candidates_analytics(db, job_id)

    total_candidates = len(candidates)
    interview_immediately = 0
    interview = 0
    consider = 0
    do_not_recommend = 0

    for candidate in candidates:
        recommendation = candidate.get("ai_resume_analysis", {}).get("ai_recommendation", "")
        if recommendation == "Interview Immediately":
            interview_immediately += 1
        elif recommendation == "Interview":
            interview += 1
        elif recommendation == "Consider":
            consider += 1
        elif recommendation == "Do Not Recommend":
            do_not_recommend += 1

    return {
        "total_candidates": total_candidates,
        "recommended_count": interview_immediately + interview,
        "under_review_count": consider,
        "not_recommended_count": do_not_recommend
    }


VALID_PIPELINE_STAGES = {"applied", "screening", "ai_interview", "interview", "offer", "hired", "rejected"}


async def move_candidate_stage(db: AsyncSession, candidate_id: int, new_stage: str, changed_by: str, notes: str = None, hired_location_id: int = None, skip_email: bool = False):
    if new_stage not in VALID_PIPELINE_STAGES:
        raise ValueError(f"Invalid stage. Must be one of: {', '.join(VALID_PIPELINE_STAGES)}")

    result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id))
    entry = result.scalar_one_or_none()
    if not entry:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Candidate not found")

    current_stage = entry.pipeline_stage
    if current_stage == new_stage:
        return

    now = datetime.utcnow()

    # ── Hire cap enforcement ──────────────────────────────────────────
    update_values = dict(pipeline_stage=new_stage, stage_changed_at=now, stage_changed_by=changed_by)

    if new_stage == "hired":
        from fastapi import HTTPException as HE
        from app.services.jd_service import get_location_vacancies
        loc_vacancies = await get_location_vacancies(db, entry.jd_id)
        if loc_vacancies:
            total_hired = sum(lv["hired_count"] for lv in loc_vacancies)
            total_vac = sum(lv["vacancies"] for lv in loc_vacancies)
            if total_hired >= total_vac:
                raise HE(status_code=409, detail="All vacancies filled")
            if hired_location_id:
                loc = next((lv for lv in loc_vacancies if lv["id"] == hired_location_id), None)
                if not loc:
                    raise HE(status_code=400, detail="Invalid hire location")
                if loc["is_full"]:
                    raise HE(status_code=409, detail=f"All vacancies filled for {loc['city']}, {loc['country']}")
            elif len(loc_vacancies) == 1:
                hired_location_id = loc_vacancies[0]["id"]
            else:
                raise HE(status_code=400, detail="Select a hire location")
        update_values["hired_location_id"] = hired_location_id

    # When moving away from hired, clear hired_location_id
    if current_stage == "hired" and new_stage != "hired":
        update_values["hired_location_id"] = None

    await db.execute(
        update(CandidateJobEntry)
        .where(CandidateJobEntry.id == candidate_id)
        .values(**update_values)
    )

    history_entry = PipelineStageHistory(
        candidate_id=candidate_id,
        jd_id=entry.jd_id,
        from_stage=current_stage,
        to_stage=new_stage,
        changed_by=changed_by,
        notes=notes,
    )
    db.add(history_entry)
    await db.commit()

    # Sync linked JobApplication status with pipeline stage
    try:
        app_id = getattr(entry, 'application_id', None)
        if app_id:
            stage_to_app_status = {
                "applied": "submitted", "screening": "screening", "ai_interview": "screening",
                "interview": "interview", "offer": "offered", "hired": "hired", "rejected": "rejected",
            }
            app_status = stage_to_app_status.get(new_stage)
            if app_status:
                from app.db.models import JobApplication
                await db.execute(
                    update(JobApplication)
                    .where(JobApplication.id == app_id)
                    .values(
                        status=app_status,
                        pipeline_stage=new_stage,
                        last_status_updated_at=now,
                        updated_at=now,
                    )
                )
                await db.commit()
    except Exception:
        pass  # non-fatal — pipeline stage already saved

    # Publish real-time event
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("pipeline_stage_changed", {
            "candidate_id": candidate_id, "jd_id": entry.jd_id,
            "from_stage": current_stage, "to_stage": new_stage, "changed_by": changed_by,
        })
    except Exception:
        pass

    pending_email_id = None
    if not skip_email:
        # Auto-assign, generate documents, and create deferred email (non-fatal)
        try:
            from app.services.document_service import auto_assign_and_generate_documents
            from app.services.pending_email_service import create_pending_email

            doc_ids = await auto_assign_and_generate_documents(db, candidate_id, entry.jd_id, new_stage, changed_by)
            pending_email_id = await create_pending_email(
                db, candidate_id, entry.jd_id, current_stage, new_stage, changed_by,
                attachment_doc_ids=doc_ids,
            )
        except Exception as e:
            logger.warning(f"Deferred email creation failed (non-fatal): {e}")

    if new_stage == "hired":
        await _check_and_close_job_if_filled(db, entry.jd_id)

    return {"pending_email_id": pending_email_id}


async def _check_and_close_job_if_filled(db: AsyncSession, jd_id: int):
    result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    job = result.scalar_one_or_none()
    if not job or job.status == "Closed":
        return

    from app.services.jd_service import get_location_vacancies
    loc_vacancies = await get_location_vacancies(db, jd_id)

    should_close = False
    if loc_vacancies:
        should_close = all(lv["is_full"] for lv in loc_vacancies)
    else:
        vacancies = job.number_of_vacancies or 1
        hired_result = await db.execute(
            select(func.count()).select_from(CandidateJobEntry).where(
                CandidateJobEntry.jd_id == jd_id,
                CandidateJobEntry.pipeline_stage == "hired",
                CandidateJobEntry.deleted_at.is_(None),
            )
        )
        hired_count = hired_result.scalar() or 0
        should_close = hired_count >= vacancies

    if should_close:
        now = datetime.utcnow()
        await db.execute(
            update(JobDescription)
            .where(JobDescription.id == jd_id)
            .values(status="Closed", updated_at=now)
        )
        # Update non-terminal JobApplications: reject candidates still in pipeline
        from app.db.models import JobApplication
        await db.execute(
            update(JobApplication)
            .where(
                JobApplication.jd_id == jd_id,
                JobApplication.status.in_(["submitted", "screening", "interview"]),
                JobApplication.deleted_at.is_(None),
            )
            .values(
                status="rejected",
                status_message="Position has been filled.",
                last_status_updated_at=now,
                updated_at=now,
            )
        )
        await db.commit()


async def get_candidates_by_pipeline(db: AsyncSession, jd_id: str) -> dict:
    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile).join(
            CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id
        ).where(
            CandidateJobEntry.jd_id == int(jd_id),
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    rows = result.all()

    pipeline = {stage: [] for stage in ["applied", "screening", "ai_interview", "interview", "offer", "hired", "rejected"]}

    for entry, profile in rows:
        ai = entry.ai_resume_analysis or {}
        metadata = ai.get("metadata", {})
        cat_scores = ai.get("category_scores", {})
        raw_total = cat_scores.get("total_score", 0)
        total_score = raw_total if isinstance(raw_total, (int, float)) else (raw_total.get("obtained_score", 0) if isinstance(raw_total, dict) else 0)

        item = {
            "id": entry.id,
            "full_name": profile.full_name or metadata.get("full_name", "N/A"),
            "email": profile.email or metadata.get("email", "N/A"),
            "pipeline_stage": entry.pipeline_stage or "applied",
            "score": total_score,
            "recommendation": ai.get("ai_recommendation", "N/A"),
            "stage_changed_at": str(entry.stage_changed_at) if entry.stage_changed_at else None,
            "created_at": str(entry.created_at) if entry.created_at else None,
            "source": getattr(entry, 'source', None) or "manual",
            "hired_location_id": getattr(entry, 'hired_location_id', None),
        }

        stage_key = entry.pipeline_stage or "applied"
        if stage_key in pipeline:
            pipeline[stage_key].append(item)
        else:
            pipeline["applied"].append(item)

    # Enrich ALL candidates with AI interview status
    all_candidate_ids = [c["id"] for stage_list in pipeline.values() for c in stage_list]
    if all_candidate_ids:
        from app.db.models import AIInterviewSession as AIS
        ai_result = await db.execute(
            select(
                AIS.candidate_id,
                AIS.status,
                AIS.overall_score,
                AIS.id,
            )
            .where(AIS.candidate_id.in_(all_candidate_ids))
            .order_by(AIS.candidate_id, AIS.created_at.desc())
        )
        # Keep only latest session per candidate
        ai_map: dict = {}
        for row in ai_result.all():
            if row.candidate_id not in ai_map:
                ai_map[row.candidate_id] = {
                    "ai_interview_status": row.status,
                    "ai_interview_score": row.overall_score,
                    "ai_interview_session_id": row.id,
                }
        for stage_list in pipeline.values():
            for cand in stage_list:
                ai_info = ai_map.get(cand["id"])
                if ai_info:
                    cand.update(ai_info)

    # Enrich interview-stage candidates with feedback summary data
    interview_candidates = pipeline.get("interview", [])
    if interview_candidates:
        interview_cand_ids = [c["id"] for c in interview_candidates]
        jd_id_int = int(jd_id)

        # Fetch all interview schedules for these candidates in this job
        sched_result = await db.execute(
            select(
                InterviewSchedule.candidate_id,
                func.count(InterviewSchedule.id).label("total_rounds"),
                func.count(InterviewSchedule.id).filter(
                    InterviewSchedule.status == "completed"
                ).label("completed_rounds"),
            )
            .where(
                InterviewSchedule.candidate_id.in_(interview_cand_ids),
                InterviewSchedule.jd_id == jd_id_int,
            )
            .group_by(InterviewSchedule.candidate_id)
        )
        sched_map = {
            row.candidate_id: {"total_rounds": row.total_rounds, "completed_rounds": row.completed_rounds}
            for row in sched_result.all()
        }

        # Fetch all schedule IDs for these candidates to join feedback
        all_sched_result = await db.execute(
            select(InterviewSchedule.id, InterviewSchedule.candidate_id)
            .where(
                InterviewSchedule.candidate_id.in_(interview_cand_ids),
                InterviewSchedule.jd_id == jd_id_int,
            )
        )
        all_scheds = all_sched_result.all()
        sched_id_to_cand = {s.id: s.candidate_id for s in all_scheds}
        all_sched_ids = list(sched_id_to_cand.keys())

        feedback_map = {}  # candidate_id -> {total_feedback, sum_rating, recs: []}
        if all_sched_ids:
            fb_result = await db.execute(
                select(
                    InterviewerFeedback.schedule_id,
                    InterviewerFeedback.rating,
                    InterviewerFeedback.recommendation,
                )
                .where(InterviewerFeedback.schedule_id.in_(all_sched_ids))
            )
            for fb in fb_result.all():
                cand_id = sched_id_to_cand[fb.schedule_id]
                if cand_id not in feedback_map:
                    feedback_map[cand_id] = {"total_feedback": 0, "sum_rating": 0, "recs": []}
                feedback_map[cand_id]["total_feedback"] += 1
                feedback_map[cand_id]["sum_rating"] += (fb.rating or 0)
                if fb.recommendation:
                    feedback_map[cand_id]["recs"].append(fb.recommendation)

        # Attach feedback summary to each interview candidate
        for cand in interview_candidates:
            cid = cand["id"]
            sched_info = sched_map.get(cid, {})
            total_rounds = sched_info.get("total_rounds", 0)
            completed_rounds = sched_info.get("completed_rounds", 0)

            fb_info = feedback_map.get(cid, {})
            total_feedback = fb_info.get("total_feedback", 0)
            sum_rating = fb_info.get("sum_rating", 0)
            recs = fb_info.get("recs", [])

            avg_score = (sum_rating / total_feedback) if total_feedback > 0 else None

            # Determine signal from majority recommendation
            signal = None
            if recs:
                positive = sum(1 for r in recs if r in ("yes", "strong_yes"))
                negative = sum(1 for r in recs if r in ("no", "strong_no"))
                total = len(recs)
                if positive > total / 2:
                    signal = "positive"
                elif negative > total / 2:
                    signal = "negative"
                else:
                    signal = "mixed"

            if total_rounds > 0:
                cand["feedback_progress"] = f"{completed_rounds}/{total_rounds}"
                cand["avg_feedback_score"] = round(avg_score, 1) if avg_score else None
                cand["feedback_signal"] = signal

    return pipeline


async def get_stage_history(db: AsyncSession, candidate_id: int) -> list:
    result = await db.execute(
        select(PipelineStageHistory)
        .where(PipelineStageHistory.candidate_id == candidate_id)
        .order_by(PipelineStageHistory.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "candidate_id": row.candidate_id,
            "jd_id": row.jd_id,
            "from_stage": row.from_stage,
            "to_stage": row.to_stage,
            "changed_by": row.changed_by,
            "notes": row.notes,
            "created_at": str(row.created_at) if row.created_at else None,
        }
        for row in rows
    ]


async def bulk_move_candidates(db: AsyncSession, candidate_ids: list[int], new_stage: str, changed_by: str, notes: str = None):
    for candidate_id in candidate_ids:
        await move_candidate_stage(db, candidate_id, new_stage, changed_by, notes)


# ── Profile CRUD ─────────────────────────────────────────────────────────

async def get_profile_by_id(db: AsyncSession, profile_id: int) -> Optional[dict]:
    result = await db.execute(
        select(CandidateProfile).where(
            CandidateProfile.id == profile_id,
            CandidateProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return None

    # Job count
    job_count_result = await db.execute(
        select(func.count()).select_from(CandidateJobEntry).where(
            CandidateJobEntry.profile_id == profile_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    job_count = job_count_result.scalar_one()

    # Get latest AI data for skills/experience
    latest_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.profile_id == profile_id,
            CandidateJobEntry.onboard == True,
            CandidateJobEntry.deleted_at.is_(None),
        ).order_by(CandidateJobEntry.created_at.desc()).limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    ai = latest.ai_resume_analysis if latest else {}
    ai_meta = ai.get("metadata", {}) if isinstance(ai, dict) else {}

    return {
        "id": profile.id,
        "email": profile.email,
        "full_name": profile.full_name,
        "phone": profile.phone,
        "resume_url": profile.resume_url,
        "linkedin_url": profile.linkedin_url,
        "github_url": profile.github_url,
        "portfolio_url": profile.portfolio_url,
        "status": profile.status,
        "category": profile.category,
        "notes": profile.notes,
        "job_count": job_count,
        "skills": (ai.get("highlighted_skills", []) or [])[:10] if isinstance(ai, dict) else [],
        "experience": ai_meta.get("years_of_experience"),
        "current_role": ai_meta.get("current_role"),
        "location": ai_meta.get("location"),
        "created_at": profile.created_at,
    }


async def update_profile(db: AsyncSession, profile_id: int, data: dict) -> bool:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == profile_id, CandidateProfile.deleted_at.is_(None))
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return False

    for key in ("full_name", "phone", "notes", "category"):
        if key in data and data[key] is not None:
            setattr(profile, key, data[key])
    profile.updated_at = datetime.utcnow()
    await db.commit()
    return True


async def get_profiles(
    db: AsyncSession,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    base_where = [CandidateProfile.deleted_at.is_(None)]
    if status:
        base_where.append(CandidateProfile.status == status)
    if category:
        base_where.append(CandidateProfile.category == category)
    if search:
        pattern = f"%{search.lower()}%"
        base_where.append(or_(
            func.lower(CandidateProfile.full_name).like(pattern),
            func.lower(CandidateProfile.email).like(pattern),
        ))

    count_q = select(func.count()).select_from(CandidateProfile).where(*base_where)
    total = (await db.execute(count_q)).scalar_one()

    job_count_sq = (
        select(func.count(CandidateJobEntry.id))
        .where(
            CandidateJobEntry.profile_id == CandidateProfile.id,
            CandidateJobEntry.deleted_at.is_(None),
        )
        .correlate(CandidateProfile)
        .scalar_subquery()
        .label("job_count")
    )

    query = (
        select(CandidateProfile, job_count_sq)
        .where(*base_where)
        .order_by(CandidateProfile.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)

    items = []
    for profile, job_count in result.all():
        items.append({
            "id": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "phone": profile.phone,
            "resume_url": profile.resume_url,
            "linkedin_url": profile.linkedin_url,
            "github_url": profile.github_url,
            "portfolio_url": profile.portfolio_url,
            "status": profile.status,
            "category": profile.category,
            "notes": profile.notes,
            "job_count": job_count or 0,
            "created_at": profile.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


# ---------------------------------------------------------------------------
# Fire-and-forget email helper for stage changes
# ---------------------------------------------------------------------------

def _fire_stage_change_email(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    from_stage: str,
    to_stage: str,
):
    """Schedule a background task to send a stage-change (or rejection) email."""

    async def _send():
        try:
            from app.db.postgres import AsyncSessionLocal
            async with AsyncSessionLocal() as bg_db:
                # Resolve candidate contact info
                entry_result = await bg_db.execute(
                    select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
                )
                entry = entry_result.scalar_one_or_none()
                if not entry:
                    return

                profile_result = await bg_db.execute(
                    select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
                )
                profile = profile_result.scalar_one_or_none()
                if not profile or not profile.email:
                    return

                jd_result = await bg_db.execute(
                    select(JobDescription).where(JobDescription.id == jd_id)
                )
                jd = jd_result.scalar_one_or_none()
                ai = jd.ai_result if jd else {}
                job_title = ai.get("job_title", "Open Position") if isinstance(ai, dict) else "Open Position"

            candidate_name = profile.full_name or "Candidate"
            candidate_email = profile.email

            from app.services.email_service import send_stage_change, send_rejection, send_offer_notification

            if to_stage == "rejected":
                await send_rejection(candidate_email, candidate_name, job_title)
            elif to_stage == "offer":
                await send_offer_notification(candidate_email, candidate_name, job_title)
            else:
                await send_stage_change(
                    candidate_email, candidate_name, job_title, from_stage, to_stage
                )
        except Exception:
            pass  # fire-and-forget — errors are logged inside email_service

    asyncio.create_task(_send())
