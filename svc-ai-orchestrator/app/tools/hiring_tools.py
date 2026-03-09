"""Hiring tool executor functions — mirror of svc-recruiting/hiring_agent_service tool executors.

These functions execute against the recruiting_db via a separate AsyncSession.
"""
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Recruiting DB models (imported dynamically to avoid cross-service imports) ──

def _get_recruiting_models():
    """Lazy import of recruiting DB models (these are declarative ORM classes on recruiting_db)."""
    from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.orm import DeclarativeBase

    class RecruitingBase(DeclarativeBase):
        pass

    class JobDescription(RecruitingBase):
        __tablename__ = "job_descriptions"
        id = Column(Integer, primary_key=True)
        user_id = Column(String(50), nullable=False)
        ai_result = Column(JSONB, nullable=False, default=dict)
        rubric_text = Column(Text, nullable=False, default="")
        model_answer_text = Column(Text, nullable=False, default="")
        uploaded_file_info = Column(JSONB, nullable=False, default=list)
        status = Column(String(20), nullable=False, default="Open")
        country = Column(String(100), nullable=True)
        city = Column(String(100), nullable=True)
        visibility = Column(String(20), nullable=False, default="internal")
        number_of_vacancies = Column(Integer, nullable=False, default=1)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        deleted_at = Column(DateTime, nullable=True)

    class CandidateProfile(RecruitingBase):
        __tablename__ = "candidate_profiles"
        id = Column(Integer, primary_key=True)
        email = Column(String(255), nullable=True)
        full_name = Column(String(300), nullable=True)
        phone = Column(String(50), nullable=True)
        resume_url = Column(Text, nullable=True)
        status = Column(String(20), nullable=False, default="active")
        category = Column(String(50), nullable=True)
        parsed_metadata = Column(JSONB, nullable=True)
        notes = Column(Text, nullable=True)
        original_source = Column(String(30), nullable=False, default="manual")
        created_by = Column(String(50), nullable=True)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        deleted_at = Column(DateTime, nullable=True)

    class CandidateJobEntry(RecruitingBase):
        __tablename__ = "candidate_job_entries"
        id = Column(Integer, primary_key=True)
        profile_id = Column(Integer, nullable=False)
        jd_id = Column(Integer, nullable=False)
        user_id = Column(String(50), nullable=False)
        ai_resume_analysis = Column(JSONB, nullable=False, default=dict)
        pipeline_stage = Column(String(20), nullable=False, default="applied")
        stage_changed_at = Column(DateTime, nullable=True)
        stage_changed_by = Column(String(50), nullable=True)
        onboard = Column(Boolean, nullable=False, default=False)
        screening = Column(Boolean, nullable=False, default=False)
        interview_status = Column(Boolean, nullable=False, default=False)
        source = Column(String(20), nullable=False, default="manual")
        application_id = Column(Integer, nullable=True)
        imported_at = Column(DateTime, nullable=True)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        deleted_at = Column(DateTime, nullable=True)

    class InterviewEvaluation(RecruitingBase):
        __tablename__ = "interview_evaluations"
        id = Column(Integer, primary_key=True)
        candidate_id = Column(Integer, nullable=False)
        ai_interview_result = Column(JSONB, nullable=False, default=dict)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    class InterviewSchedule(RecruitingBase):
        __tablename__ = "interview_schedules"
        id = Column(Integer, primary_key=True)
        candidate_id = Column(Integer, nullable=False)
        jd_id = Column(Integer, nullable=True)
        interview_type = Column(String(20), nullable=False, default="video")
        scheduled_date = Column(String(20), nullable=False)
        scheduled_time = Column(String(10), nullable=False)
        duration_minutes = Column(Integer, nullable=False, default=60)
        status = Column(String(20), nullable=False, default="scheduled")
        location = Column(Text, nullable=True)
        interviewer_names = Column(JSONB, nullable=True)
        notes = Column(Text, nullable=True)
        created_by = Column(String(50), nullable=True)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    class Offer(RecruitingBase):
        __tablename__ = "offers"
        id = Column(Integer, primary_key=True)
        candidate_id = Column(Integer, nullable=False)
        jd_id = Column(Integer, nullable=True)
        salary = Column(Numeric, nullable=True)
        salary_currency = Column(String(10), nullable=True, default="USD")
        position_title = Column(String(255), nullable=True)
        start_date = Column(String(20), nullable=True)
        department = Column(String(100), nullable=True)
        status = Column(String(20), nullable=False, default="pending")
        created_by = Column(String(50), nullable=True)
        created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
        deleted_at = Column(DateTime, nullable=True)

    return {
        "JobDescription": JobDescription,
        "CandidateProfile": CandidateProfile,
        "CandidateJobEntry": CandidateJobEntry,
        "InterviewEvaluation": InterviewEvaluation,
        "InterviewSchedule": InterviewSchedule,
        "Offer": Offer,
    }


_models = None


def _models_cache():
    global _models
    if _models is None:
        _models = _get_recruiting_models()
    return _models


# ── Context Gatherer ──

async def gather_context(db: AsyncSession, user_id: str) -> str:
    """Query recruiting_db and build a text context block for the LLM."""
    m = _models_cache()
    JD = m["JobDescription"]
    CP = m["CandidateProfile"]
    CJE = m["CandidateJobEntry"]
    IE = m["InterviewEvaluation"]
    IS = m["InterviewSchedule"]
    Off = m["Offer"]

    sections: list[str] = []

    # Jobs
    job_rows = (await db.execute(
        select(JD).where(JD.user_id == user_id, JD.deleted_at.is_(None))
        .order_by(JD.created_at.desc()).limit(50)
    )).scalars().all()

    if job_rows:
        lines = ["## Jobs"]
        for j in job_rows:
            ai = j.ai_result or {}
            rubric = ai.get("extracted_rubric", {})
            core_skills = rubric.get("core_skills", [])
            cand_count = (await db.execute(
                select(func.count()).select_from(CJE)
                .where(CJE.jd_id == j.id, CJE.deleted_at.is_(None))
            )).scalar_one()
            location_str = f"{j.city}, {j.country}" if j.city and j.country else (j.city or j.country or "N/A")
            lines.append(
                f"- ID:{j.id} | {ai.get('job_title', 'Untitled')} | status={j.status} "
                f"| visibility={j.visibility} | vacancies={j.number_of_vacancies} "
                f"| location={location_str} | candidates={cand_count} "
                f"| core_skills={', '.join(core_skills[:5])} | created={str(j.created_at)[:10]}"
            )
        sections.append("\n".join(lines))

    # Candidates
    cand_rows = (await db.execute(
        select(CJE, CP).join(CP, CJE.profile_id == CP.id)
        .where(CJE.user_id == user_id, CJE.deleted_at.is_(None))
        .order_by(CJE.created_at.desc()).limit(100)
    )).all()

    if cand_rows:
        lines = ["## Candidates"]
        for entry, profile in cand_rows:
            ai = entry.ai_resume_analysis or {}
            meta = ai.get("metadata", {})
            scores = ai.get("category_scores", {})
            total = scores.get("total_score", "N/A")
            rec = ai.get("ai_recommendation", "N/A")
            skills = ai.get("highlighted_skills", [])
            name = profile.full_name or meta.get("full_name", "Unknown")
            email = profile.email or meta.get("email", "")
            lines.append(
                f"- ID:{entry.id} | {name} | email={email} "
                f"| score={total}/100 | rec={rec} | stage={entry.pipeline_stage} "
                f"| job_id={entry.jd_id} | skills={', '.join(skills[:5])}"
            )
        sections.append("\n".join(lines))

    # Interview Evaluations
    eval_rows = (await db.execute(
        select(IE).join(CJE, IE.candidate_id == CJE.id)
        .where(CJE.user_id == user_id)
        .order_by(IE.created_at.desc()).limit(50)
    )).scalars().all()

    if eval_rows:
        lines = ["## Interview Evaluations"]
        for e in eval_rows:
            ai = e.ai_interview_result or {}
            lines.append(
                f"- candidate={ai.get('candidate_name', 'Unknown')} | position={ai.get('position', '')} "
                f"| rec={ai.get('ai_recommendation', 'N/A')}"
            )
        sections.append("\n".join(lines))

    # Offers
    offer_rows = (await db.execute(
        select(Off).join(CJE, Off.candidate_id == CJE.id)
        .where(CJE.user_id == user_id, Off.deleted_at.is_(None))
        .order_by(Off.created_at.desc()).limit(50)
    )).scalars().all()

    if offer_rows:
        lines = ["## Offers"]
        for o in offer_rows:
            lines.append(
                f"- candidate_id={o.candidate_id} | position={o.position_title or 'N/A'} "
                f"| salary={o.salary} {o.salary_currency} | status={o.status}"
            )
        sections.append("\n".join(lines))

    # Pipeline Summary
    if cand_rows:
        stage_counts: dict[str, int] = {}
        for entry, _profile in cand_rows:
            stage = entry.pipeline_stage or "unknown"
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
        pipeline_str = " | ".join(f"{k}={v}" for k, v in sorted(stage_counts.items()))
        sections.append(f"## Pipeline Summary\n{pipeline_str}")

    return "\n\n".join(sections) if sections else "No hiring data found for this user."


# ── Tool Executors ──

async def exec_create_job_posting(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    JD = m["JobDescription"]

    country = args.get("country", "")
    city = args.get("city", "")

    # Duplicate check
    if city:
        existing = (await db.execute(
            select(JD).where(
                JD.user_id == user_id,
                JD.status == "Open",
                JD.city == city,
                JD.deleted_at.is_(None),
            )
        )).scalars().all()
        for j in existing:
            ai = j.ai_result or {}
            if ai.get("job_title", "").lower() == args["job_title"].lower():
                return {"success": False, "error": f'A job titled "{ai["job_title"]}" is already open in {city} (Job ID: {j.id})'}

    ai_result = {
        "job_title": args["job_title"],
        "summary": args.get("summary", ""),
        "extracted_rubric": {
            "core_skills": args.get("core_skills", []),
            "preferred_skills": args.get("preferred_skills", []),
            "experience_requirements": {"min_years": args.get("min_experience_years", 2)},
            "educational_requirements": {"degree": args.get("education", "Bachelor's"), "field": "Related field"},
            "soft_skills": ["Communication", "Teamwork"],
            "certifications": [],
            "role_keywords": args["job_title"].lower().split(),
        },
    }

    job = JD(
        user_id=user_id,
        ai_result=ai_result,
        status="Open",
        number_of_vacancies=args.get("number_of_vacancies", 1),
        country=country or None,
        city=city or None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"success": True, "job_id": job.id, "job_title": args["job_title"]}


async def exec_move_candidate_stage(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    CJE = m["CandidateJobEntry"]

    result = await db.execute(
        select(CJE).where(CJE.id == int(args["candidate_id"]), CJE.deleted_at.is_(None))
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return {"success": False, "error": f"Candidate {args['candidate_id']} not found"}

    entry.pipeline_stage = args["stage"]
    entry.stage_changed_at = datetime.utcnow()
    entry.stage_changed_by = user_id
    await db.commit()
    return {"success": True, "candidate_id": args["candidate_id"], "new_stage": args["stage"]}


async def exec_schedule_interview(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    IS = m["InterviewSchedule"]

    schedule = IS(
        candidate_id=int(args["candidate_id"]),
        jd_id=int(args.get("jd_id", 0)),
        interview_type=args.get("interview_type", "video"),
        scheduled_date=args["scheduled_date"],
        scheduled_time=args["scheduled_time"],
        duration_minutes=args.get("duration_minutes", 60),
        location=args.get("location"),
        interviewer_names=args.get("interviewer_names", []),
        notes=args.get("notes"),
        created_by=user_id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return {"success": True, "schedule_id": schedule.id}


async def exec_create_offer(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    Off = m["Offer"]

    offer = Off(
        candidate_id=int(args["candidate_id"]),
        jd_id=int(args.get("jd_id", 0)),
        salary=args.get("salary"),
        salary_currency=args.get("salary_currency", "USD"),
        position_title=args.get("position_title"),
        start_date=args.get("start_date"),
        department=args.get("department"),
        status="pending",
        created_by=user_id,
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return {"success": True, "offer_id": offer.id}


async def exec_update_job_status(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    JD = m["JobDescription"]

    result = await db.execute(
        select(JD).where(JD.id == int(args["job_id"]), JD.user_id == user_id, JD.deleted_at.is_(None))
    )
    job = result.scalar_one_or_none()
    if not job:
        return {"success": False, "error": f"Job {args['job_id']} not found"}

    job.status = args["status"]
    job.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "job_id": args["job_id"], "new_status": args["status"]}


async def exec_add_candidates_to_job(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    CJE = m["CandidateJobEntry"]

    target_job_id = int(args["target_job_id"])
    candidate_ids = [int(cid) for cid in args["candidate_ids"]]
    imported = 0

    for cid in candidate_ids:
        result = await db.execute(
            select(CJE).where(CJE.id == cid, CJE.deleted_at.is_(None))
        )
        source = result.scalar_one_or_none()
        if not source:
            continue

        new_entry = CJE(
            profile_id=source.profile_id,
            jd_id=target_job_id,
            user_id=user_id,
            ai_resume_analysis=source.ai_resume_analysis,
            pipeline_stage="applied",
            source="imported",
        )
        db.add(new_entry)
        imported += 1

    await db.commit()
    return {"success": True, "imported_count": imported, "target_job_id": target_job_id}


async def exec_search_candidates(db: AsyncSession, user_id: str, args: dict) -> dict:
    m = _models_cache()
    CP = m["CandidateProfile"]
    CJE = m["CandidateJobEntry"]

    query = select(CJE, CP).join(CP, CJE.profile_id == CP.id).where(
        CJE.deleted_at.is_(None), CJE.onboard.is_(True)
    )

    if args.get("search"):
        search_term = f"%{args['search']}%"
        query = query.where(
            CJE.ai_resume_analysis.cast(String).ilike(search_term)
        )

    results = (await db.execute(query.limit(10))).all()
    candidates = []
    for entry, profile in results:
        ai = entry.ai_resume_analysis or {}
        meta = ai.get("metadata", {})
        scores = ai.get("category_scores", {})
        candidates.append({
            "id": entry.id,
            "name": profile.full_name or meta.get("full_name", "Unknown"),
            "email": profile.email or meta.get("email", ""),
            "score": scores.get("total_score", "N/A"),
            "recommendation": ai.get("ai_recommendation", "N/A"),
            "skills": ai.get("highlighted_skills", [])[:5],
        })

    return {"success": True, "total": len(candidates), "candidates": candidates}


async def exec_web_search(args: dict) -> dict:
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        result = client.search(query=args["query"], max_results=5)
        results = []
        for r in result.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:500],
            })
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Import String for ilike cast
from sqlalchemy import String

# Tool dispatcher map
TOOL_EXECUTORS = {
    "create_job_posting": exec_create_job_posting,
    "move_candidate_stage": exec_move_candidate_stage,
    "add_candidates_to_job": exec_add_candidates_to_job,
    "schedule_interview": exec_schedule_interview,
    "create_offer": exec_create_offer,
    "update_job_status": exec_update_job_status,
    "search_candidates": exec_search_candidates,
}
