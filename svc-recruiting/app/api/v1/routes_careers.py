"""Public careers endpoints — no auth required (except lock-status)."""
import math
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.postgres import get_db
from app.db.models import JobDescription, CandidateJobEntry, ScreeningQuestion
from app.core.security import get_current_user

router = APIRouter()


@router.get("/jobs")
async def list_public_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    location_type: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    experience: Optional[str] = Query(None),
    salary_min: Optional[float] = Query(None),
    salary_max: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List public, open jobs with filters — no auth required."""
    conditions = [
        JobDescription.visibility == "public",
        JobDescription.status == "Open",
        JobDescription.deleted_at.is_(None),
    ]

    # Filter by location (city or country)
    if location:
        pattern = f"%{location.lower()}%"
        conditions.append(
            func.lower(func.coalesce(JobDescription.city, "")).like(pattern)
            | func.lower(func.coalesce(JobDescription.country, "")).like(pattern)
        )

    # Filter by location_type (onsite, remote, hybrid)
    if location_type:
        conditions.append(JobDescription.location_type == location_type)

    # Filter by job_type
    if job_type:
        conditions.append(JobDescription.job_type == job_type)

    # Filter by salary range
    if salary_min is not None:
        conditions.append(JobDescription.salary_range_max >= salary_min)
    if salary_max is not None:
        conditions.append(JobDescription.salary_range_min <= salary_max)

    # Hiring close date filter: exclude expired jobs
    from datetime import datetime as dt
    conditions.append(
        (JobDescription.hiring_close_date.is_(None)) | (JobDescription.hiring_close_date >= dt.utcnow())
    )

    base = select(JobDescription).where(*conditions)
    count_q = select(func.count()).select_from(JobDescription).where(*conditions)

    total = (await db.execute(count_q)).scalar_one()
    offset = (page - 1) * page_size
    query = base.order_by(JobDescription.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    items = []
    for j in jobs:
        ai = j.ai_result or {}
        extracted = ai.get("extracted_rubric", {})
        title = ai.get("job_title", "Untitled")

        # Apply server-side search filter (text search on title/summary)
        if search and search.lower() not in title.lower():
            summary = ai.get("summary", "")
            if search.lower() not in summary.lower():
                total -= 1
                continue

        # Count applications for this job
        app_count = (await db.execute(
            select(func.count()).select_from(CandidateJobEntry).where(CandidateJobEntry.jd_id == j.id)
        )).scalar_one()

        # Salary visibility control
        show_salary = getattr(j, "salary_visibility", "hidden") == "public"

        items.append({
            "job_id": str(j.id),
            "job_title": title,
            "summary": ai.get("summary", ""),
            "key_requirements": (extracted.get("core_skills", []) + extracted.get("preferred_skills", []))[:8],
            "experience": extracted.get("experience_requirements", {}).get("description", ""),
            "experience_range": getattr(j, "experience_range", None),
            "education": _format_education(extracted.get("educational_requirements", {})),
            "location": f"{j.city or ''}, {j.country or ''}".strip(", ") or ai.get("location", ""),
            "location_type": getattr(j, "location_type", None),
            "job_type": getattr(j, "job_type", None),
            "salary_range": {
                "min": float(j.salary_range_min) if show_salary and j.salary_range_min else None,
                "max": float(j.salary_range_max) if show_salary and j.salary_range_max else None,
                "currency": j.salary_currency if show_salary else None,
            } if show_salary else None,
            "created_at": str(j.created_at),
            "applicant_count": app_count,
            "hiring_close_date": str(j.hiring_close_date) if getattr(j, "hiring_close_date", None) else None,
        })

    total = max(total, len(items))
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)) if total else 0,
    }


@router.get("/jobs/{job_id}")
async def get_public_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Single public job detail — no auth required."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == int(job_id),
            JobDescription.visibility == "public",
            JobDescription.status == "Open",
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ai = job.ai_result or {}
    extracted = ai.get("extracted_rubric", {})

    show_salary = getattr(job, "salary_visibility", "hidden") == "public"

    return {
        "job_id": str(job.id),
        "job_title": ai.get("job_title", "Untitled"),
        "summary": ai.get("summary", ""),
        "key_requirements": extracted.get("core_skills", []) + extracted.get("preferred_skills", []),
        "experience": extracted.get("experience_requirements", {}),
        "experience_range": getattr(job, "experience_range", None),
        "education": extracted.get("educational_requirements", {}),
        "location": f"{job.city or ''}, {job.country or ''}".strip(", ") or ai.get("location", ""),
        "location_type": getattr(job, "location_type", None),
        "job_type": getattr(job, "job_type", None),
        "position_type": getattr(job, "position_type", None),
        "salary_range": {
            "min": float(job.salary_range_min) if show_salary and job.salary_range_min else None,
            "max": float(job.salary_range_max) if show_salary and job.salary_range_max else None,
            "currency": job.salary_currency if show_salary else None,
        } if show_salary else None,
        "salary_visibility": getattr(job, "salary_visibility", "hidden"),
        "created_at": str(job.created_at),
        "hiring_close_date": str(job.hiring_close_date) if getattr(job, "hiring_close_date", None) else None,
    }


@router.get("/jobs/{job_id}/screening-questions")
async def get_public_screening_questions(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public screening questions for a job — no auth required."""
    result = await db.execute(
        select(ScreeningQuestion)
        .where(ScreeningQuestion.jd_id == int(job_id))
        .order_by(ScreeningQuestion.sort_order)
    )
    questions = result.scalars().all()
    return [
        {
            "id": q.id,
            "question": q.question,
            "question_type": q.question_type,
            "options": q.options,
            "required": q.required,
            "sort_order": q.sort_order,
        }
        for q in questions
    ]


@router.get("/jobs/{job_id}/lock-status")
async def get_lock_status(
    job_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if candidate is locked out from re-applying to a job."""
    from app.services.rejection_lock_service import check_rejection_lock
    lock_info = await check_rejection_lock(db, int(user["sub"]), int(job_id))
    if lock_info:
        return lock_info
    return {"locked": False}


def _format_education(edu: dict) -> str:
    degree = edu.get("degree", "")
    field = edu.get("field", "")
    if degree and field:
        return f"{degree} in {field}"
    return degree or field or ""
