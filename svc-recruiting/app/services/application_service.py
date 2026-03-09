"""Business logic for candidate self-service job applications."""
import asyncio
import logging
import math
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update

from app.db.models import JobApplication, JobDescription, CandidateJobEntry
from app.services.email_templates import STATUS_MESSAGES

logger = logging.getLogger("svc-recruiting")


async def create_application(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    user_name: str,
    jd_id: int,
    resume_url: str,
    phone: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    github_url: Optional[str] = None,
    portfolio_url: Optional[str] = None,
    cover_letter: Optional[str] = None,
    source: Optional[str] = "direct",
    referral_code: Optional[str] = None,
) -> JobApplication:
    """Create a new job application (checks for duplicates and valid job)."""
    # Validate job is public + open
    job = (await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.visibility == "public",
            JobDescription.status == "Open",
        )
    )).scalar_one_or_none()
    if not job:
        raise ValueError("Job not found or not accepting applications")

    # Check for duplicate
    existing = (await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == user_id,
            JobApplication.jd_id == jd_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise ValueError("You have already applied to this job")

    now = datetime.utcnow()
    application = JobApplication(
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        jd_id=jd_id,
        resume_url=resume_url,
        phone=phone,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        cover_letter=cover_letter,
        source=source or "direct",
        referral_code=referral_code,
        status="submitted",
        status_message=STATUS_MESSAGES.get("submitted"),
        last_status_updated_at=now,
        applied_at=now,
        updated_at=now,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    # Publish candidate_applied event for real-time notifications
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("candidate_applied", {
            "application_id": application.id,
            "jd_id": jd_id,
            "candidate_name": user_name,
            "candidate_email": user_email,
            "source": source or "direct",
        })
    except Exception as e:
        logger.error("Failed to publish candidate_applied event: %s", e)

    # Enqueue application_received notification (DB queue for retry)
    ai = job.ai_result or {}
    job_title = ai.get("job_title", "Untitled") if isinstance(ai, dict) else "Untitled"
    try:
        from app.services.notification_service import send_notification
        from app.services.email_templates import application_received
        subject, body = application_received(job_title, user_name)
        await send_notification(db, user_email, "application_received", subject, body, user_id=user_id)
    except Exception as e:
        logger.error("Failed to enqueue notification: %s", e)

    # Fire-and-forget: send styled application-received email
    async def _send_app_email():
        try:
            from app.services.email_service import send_application_received
            await send_application_received(user_email, user_name, job_title)
        except Exception:
            pass

    asyncio.create_task(_send_app_email())

    # Fire-and-forget: auto-trigger AI interview if enabled on job
    if job.auto_ai_interview:
        async def _auto_ai_interview():
            try:
                from app.services.ai_interview_service import auto_create_interview_for_application
                await auto_create_interview_for_application(db, application.id)
            except Exception as e:
                logger.error("Auto AI interview trigger failed: %s", e)

        asyncio.create_task(_auto_ai_interview())

    return application


async def link_candidate_to_application(
    db: AsyncSession,
    application_id: int,
    candidate_id: int,
):
    """After AI screening creates a Candidate row, link it back to the application."""
    await db.execute(
        sql_update(JobApplication)
        .where(JobApplication.id == application_id)
        .values(candidate_id=candidate_id, status="screening", updated_at=datetime.utcnow())
    )
    await db.execute(
        sql_update(CandidateJobEntry)
        .where(CandidateJobEntry.id == candidate_id)
        .values(source="portal", application_id=application_id)
    )
    await db.commit()


async def get_my_applications(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Return paginated applications for a candidate user."""
    count_q = select(func.count()).select_from(JobApplication).where(JobApplication.user_id == user_id, JobApplication.deleted_at.is_(None))
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(JobApplication)
        .where(JobApplication.user_id == user_id, JobApplication.deleted_at.is_(None))
        .order_by(JobApplication.applied_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    applications = result.scalars().all()

    # Batch-load all referenced JDs and Candidates in 2 queries instead of N+1
    jd_ids = {app.jd_id for app in applications}
    candidate_ids = {app.candidate_id for app in applications if app.candidate_id}

    jd_map = {}
    if jd_ids:
        jd_result = await db.execute(select(JobDescription).where(JobDescription.id.in_(jd_ids)))
        jd_map = {jd.id: jd for jd in jd_result.scalars().all()}

    cand_map = {}
    if candidate_ids:
        cand_result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id.in_(candidate_ids)))
        cand_map = {c.id: c for c in cand_result.scalars().all()}

    items = []
    for app in applications:
        job = jd_map.get(app.jd_id)
        ai = job.ai_result if job else {}
        job_title = ai.get("job_title", "Untitled") if isinstance(ai, dict) else "Untitled"

        ai_score = None
        recommendation = None
        if app.candidate_id:
            cand = cand_map.get(app.candidate_id)
            if cand and cand.ai_resume_analysis:
                scores = cand.ai_resume_analysis.get("category_scores", {})
                raw_total = scores.get("total_score", 0)
                ai_score = raw_total if isinstance(raw_total, (int, float)) else (raw_total.get("obtained_score", 0) if isinstance(raw_total, dict) else 0)
                recommendation = cand.ai_resume_analysis.get("ai_recommendation", "")

        items.append({
            "id": app.id,
            "jd_id": app.jd_id,
            "job_title": job_title,
            "status": app.status,
            "status_message": app.status_message or STATUS_MESSAGES.get(app.status, ""),
            "pipeline_stage": app.pipeline_stage or "applied",
            "estimated_next_step_date": app.estimated_next_step_date,
            "rejection_reason": app.rejection_reason,
            "last_status_updated_at": str(app.last_status_updated_at) if app.last_status_updated_at else None,
            "applied_at": str(app.applied_at),
            "updated_at": str(app.updated_at),
            "resume_url": app.resume_url,
            "phone": app.phone,
            "linkedin_url": app.linkedin_url,
            "github_url": app.github_url,
            "portfolio_url": app.portfolio_url,
            "cover_letter": app.cover_letter,
            "ai_score": ai_score,
            "recommendation": recommendation,
            "candidate_id": app.candidate_id,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)) if total else 0,
    }


async def get_application_by_id(db: AsyncSession, application_id: int, user_id: int) -> Optional[dict]:
    """Get a single application — only if owned by user_id."""
    app = (await db.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
            JobApplication.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not app:
        return None

    job = (await db.execute(
        select(JobDescription).where(JobDescription.id == app.jd_id)
    )).scalar_one_or_none()
    ai = job.ai_result if job else {}
    job_title = ai.get("job_title", "Untitled") if isinstance(ai, dict) else "Untitled"
    extracted = ai.get("extracted_rubric", {}) if isinstance(ai, dict) else {}

    ai_analysis = None
    if app.candidate_id:
        cand = (await db.execute(
            select(CandidateJobEntry).where(CandidateJobEntry.id == app.candidate_id)
        )).scalar_one_or_none()
        if cand:
            ai_analysis = cand.ai_resume_analysis

    return {
        "id": app.id,
        "jd_id": app.jd_id,
        "job_title": job_title,
        "job_summary": ai.get("summary", "") if isinstance(ai, dict) else "",
        "job_requirements": extracted.get("core_skills", []) + extracted.get("preferred_skills", []),
        "status": app.status,
        "status_message": app.status_message or STATUS_MESSAGES.get(app.status, ""),
        "pipeline_stage": app.pipeline_stage or "applied",
        "estimated_next_step_date": app.estimated_next_step_date,
        "rejection_reason": app.rejection_reason,
        "last_status_updated_at": str(app.last_status_updated_at) if app.last_status_updated_at else None,
        "applied_at": str(app.applied_at),
        "updated_at": str(app.updated_at),
        "resume_url": app.resume_url,
        "phone": app.phone,
        "linkedin_url": app.linkedin_url,
        "github_url": app.github_url,
        "portfolio_url": app.portfolio_url,
        "cover_letter": app.cover_letter,
        "candidate_id": app.candidate_id,
        "ai_analysis": ai_analysis,
    }


async def withdraw_application(db: AsyncSession, application_id: int, user_id: int) -> bool:
    """Withdraw an application — only if still in early stage."""
    app = (await db.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
            JobApplication.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not app:
        return False
    if app.status not in ("submitted", "screening"):
        raise ValueError("Cannot withdraw application in current status")

    await db.execute(
        sql_update(JobApplication)
        .where(JobApplication.id == application_id)
        .values(status="withdrawn", updated_at=datetime.utcnow())
    )
    await db.commit()
    return True


async def get_applications_for_job(
    db: AsyncSession,
    jd_id: int,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """HR view: all portal applications for a specific job."""
    count_q = select(func.count()).select_from(JobApplication).where(JobApplication.jd_id == jd_id, JobApplication.deleted_at.is_(None))
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(JobApplication)
        .where(JobApplication.jd_id == jd_id, JobApplication.deleted_at.is_(None))
        .order_by(JobApplication.applied_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    applications = result.scalars().all()

    # Batch-load all referenced Candidates in 1 query instead of N
    candidate_ids = {app.candidate_id for app in applications if app.candidate_id}
    cand_map = {}
    if candidate_ids:
        cand_result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id.in_(candidate_ids)))
        cand_map = {c.id: c for c in cand_result.scalars().all()}

    items = []
    for app in applications:
        ai_score = None
        recommendation = None
        if app.candidate_id:
            cand = cand_map.get(app.candidate_id)
            if cand and cand.ai_resume_analysis:
                scores = cand.ai_resume_analysis.get("category_scores", {})
                raw_total = scores.get("total_score", 0)
                ai_score = raw_total if isinstance(raw_total, (int, float)) else (raw_total.get("obtained_score", 0) if isinstance(raw_total, dict) else 0)
                recommendation = cand.ai_resume_analysis.get("ai_recommendation", "")

        items.append({
            "id": app.id,
            "user_id": app.user_id,
            "user_email": app.user_email,
            "user_name": app.user_name,
            "status": app.status,
            "applied_at": str(app.applied_at),
            "resume_url": app.resume_url,
            "cover_letter": app.cover_letter,
            "candidate_id": app.candidate_id,
            "ai_score": ai_score,
            "recommendation": recommendation,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)) if total else 0,
    }


async def update_application_status(
    db: AsyncSession,
    application_id: int,
    status: str,
    rejection_reason: str = None,
) -> bool:
    """HR updates application status with auto status_message and notification."""
    valid = {"submitted", "screening", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"}
    if status not in valid:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(sorted(valid))}")

    now = datetime.utcnow()
    values = {
        "status": status,
        "status_message": STATUS_MESSAGES.get(status, ""),
        "last_status_updated_at": now,
        "updated_at": now,
    }
    if rejection_reason and status == "rejected":
        values["rejection_reason"] = rejection_reason

    result = await db.execute(
        sql_update(JobApplication)
        .where(JobApplication.id == application_id)
        .values(**values)
    )
    await db.commit()

    if result.rowcount == 0:
        return False

    # Enqueue notification for status change
    try:
        app = (await db.execute(
            select(JobApplication).where(JobApplication.id == application_id)
        )).scalar_one_or_none()
        if app:
            from app.services.notification_service import send_notification
            from app.services.email_templates import stage_changed, rejection
            job = (await db.execute(
                select(JobDescription).where(JobDescription.id == app.jd_id)
            )).scalar_one_or_none()
            ai = job.ai_result if job else {}
            job_title = ai.get("job_title", "Untitled") if isinstance(ai, dict) else "Untitled"

            if status == "rejected":
                subject, body = rejection(job_title, app.user_name)
            else:
                subject, body = stage_changed(job_title, app.user_name, status)
            await send_notification(db, app.user_email, "stage_changed", subject, body, user_id=app.user_id)
    except Exception as e:
        logger.error("Failed to enqueue status notification: %s", e)

    return True


async def quick_apply(db: AsyncSession, user_id: int, user_email: str, user_name: str, jd_id: int, resume_url: str, phone: str = None) -> JobApplication:
    """One-click apply using stored profile data."""
    return await create_application(
        db,
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        jd_id=jd_id,
        resume_url=resume_url,
        phone=phone,
    )
