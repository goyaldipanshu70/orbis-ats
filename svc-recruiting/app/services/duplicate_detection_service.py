"""Duplicate candidate detection across job applications and candidate profiles."""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.db.models import JobApplication, CandidateProfile, CandidateJobEntry, JobDescription
from app.utils.phone_utils import normalize_phone


async def check_duplicate_application(
    db: AsyncSession,
    email: str,
    phone: Optional[str] = None,
    linkedin: Optional[str] = None,
    github: Optional[str] = None,
    portfolio: Optional[str] = None,
    exclude_user_id: Optional[int] = None,
) -> Optional[dict]:
    """Check if any existing application matches by email, phone, linkedin, github, or portfolio.
    Returns None if no match, else dict with matched info."""
    conditions = [JobApplication.user_email == email, JobApplication.deleted_at.is_(None)]

    # Build OR conditions for fuzzy matching
    or_conditions = [JobApplication.user_email == email]

    if phone:
        normalized = normalize_phone(phone)
        if normalized:
            or_conditions.append(JobApplication.phone.ilike(f"%{normalized}%"))

    if linkedin:
        or_conditions.append(JobApplication.linkedin_url == linkedin)
    if github:
        or_conditions.append(JobApplication.github_url == github)
    if portfolio:
        or_conditions.append(JobApplication.portfolio_url == portfolio)

    query = select(JobApplication).where(
        or_(*or_conditions),
        JobApplication.deleted_at.is_(None),
    )
    if exclude_user_id is not None:
        query = query.where(JobApplication.user_id != exclude_user_id)

    result = await db.execute(query.limit(1))
    match = result.scalar_one_or_none()
    if not match:
        return None

    # Build match reasons
    reasons = []
    if match.user_email == email:
        reasons.append("email")
    if phone and match.phone and normalize_phone(match.phone) == normalize_phone(phone):
        reasons.append("phone")
    if linkedin and match.linkedin_url == linkedin:
        reasons.append("linkedin")
    if github and match.github_url == github:
        reasons.append("github")
    if portfolio and match.portfolio_url == portfolio:
        reasons.append("portfolio")

    return {
        "matched_name": match.user_name,
        "matched_email": match.user_email,
        "match_reasons": reasons or ["email"],
        "message": "An account with this information already exists.",
    }


async def _get_profile_job_history(db: AsyncSession, profile_id: int) -> List[dict]:
    """Get job history for a candidate profile — used in duplicate info responses."""
    query = (
        select(
            CandidateJobEntry.id,
            CandidateJobEntry.jd_id,
            CandidateJobEntry.pipeline_stage,
            CandidateJobEntry.ai_resume_analysis,
            CandidateJobEntry.created_at,
            JobDescription.ai_result,
        )
        .join(JobDescription, CandidateJobEntry.jd_id == JobDescription.id)
        .where(
            CandidateJobEntry.profile_id == profile_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
        .order_by(CandidateJobEntry.created_at.desc())
        .limit(10)
    )
    rows = (await db.execute(query)).all()
    jobs = []
    for row in rows:
        jd_result = row.ai_result or {}
        ai_analysis = row.ai_resume_analysis or {}
        total_score = ai_analysis.get("category_scores", {}).get("total_score", {})
        score = total_score.get("obtained_score") if isinstance(total_score, dict) else total_score
        jobs.append({
            "job_title": jd_result.get("job_title", f"Job #{row.jd_id}"),
            "pipeline_stage": row.pipeline_stage or "applied",
            "score": score,
        })
    return jobs


async def check_duplicate_candidate(
    db: AsyncSession,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    github_url: Optional[str] = None,
) -> Optional[dict]:
    """Check both CandidateProfile and JobApplication for duplicates.
    Returns rich duplicate info dict or None."""

    or_conditions = []

    # Email match (case-insensitive)
    if email:
        or_conditions.append(func.lower(CandidateProfile.email) == email.lower())

    # Phone match (normalized last 10 digits)
    if phone:
        normalized = normalize_phone(phone)
        if normalized:
            or_conditions.append(CandidateProfile.phone.ilike(f"%{normalized}%"))

    # Social link matches
    if linkedin_url:
        or_conditions.append(CandidateProfile.linkedin_url == linkedin_url)
    if github_url:
        or_conditions.append(CandidateProfile.github_url == github_url)

    if not or_conditions:
        return None

    query = select(CandidateProfile).where(
        or_(*or_conditions),
        CandidateProfile.deleted_at.is_(None),
    ).limit(1)

    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        return None

    # Build match reasons
    reasons = []
    if email and profile.email and profile.email.lower() == email.lower():
        reasons.append("email")
    if phone and profile.phone:
        if normalize_phone(profile.phone) == normalize_phone(phone):
            reasons.append("phone")
    if linkedin_url and profile.linkedin_url == linkedin_url:
        reasons.append("linkedin")
    if github_url and profile.github_url == github_url:
        reasons.append("github")

    existing_jobs = await _get_profile_job_history(db, profile.id)

    return {
        "profile_id": profile.id,
        "matched_name": profile.full_name,
        "matched_email": profile.email,
        "match_reasons": reasons or ["profile"],
        "existing_jobs": existing_jobs,
        "message": "A candidate with matching information already exists.",
    }
