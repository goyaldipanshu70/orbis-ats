from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models import JobDescription, CandidateJobEntry


async def get_dashboard_statistics_fixed(db: AsyncSession, user_id: str, user_role: str = "recruiter") -> dict:
    """Dashboard statistics filtered by deleted_at and user scope."""
    # Base job filters: exclude soft-deleted; scope to user unless admin/hr/hiring_manager
    job_where = [JobDescription.deleted_at.is_(None)]
    if user_role not in ("admin", "hr", "hiring_manager"):
        job_where.append(JobDescription.user_id == user_id)

    total_jobs = (await db.execute(
        select(func.count()).select_from(JobDescription).where(*job_where)
    )).scalar_one()

    active_jobs = (await db.execute(
        select(func.count()).select_from(JobDescription).where(
            *job_where, JobDescription.status == "Open"
        )
    )).scalar_one()

    closed_jobs = (await db.execute(
        select(func.count()).select_from(JobDescription).where(
            *job_where, JobDescription.status == "Closed"
        )
    )).scalar_one()

    # Base candidate filters: exclude soft-deleted; scope to user unless admin/hr/hiring_manager
    cand_where = [CandidateJobEntry.deleted_at.is_(None)]
    if user_role not in ("admin", "hr", "hiring_manager"):
        cand_where.append(CandidateJobEntry.user_id == user_id)

    total_candidates = (await db.execute(
        select(func.count()).select_from(CandidateJobEntry).where(*cand_where)
    )).scalar_one()

    recommended_candidates = (await db.execute(
        select(func.count()).select_from(CandidateJobEntry).where(
            *cand_where,
            CandidateJobEntry.ai_resume_analysis["ai_recommendation"].astext == "Interview Immediately"
        )
    )).scalar_one()

    pending_interviews = (await db.execute(
        select(func.count()).select_from(CandidateJobEntry).where(
            *cand_where,
            CandidateJobEntry.ai_resume_analysis["ai_recommendation"].astext == "Interview"
        )
    )).scalar_one()

    return {
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "closed_jobs": closed_jobs,
        "total_candidates": total_candidates,
        "recommended_candidates": recommended_candidates,
        "pending_interviews": pending_interviews
    }
