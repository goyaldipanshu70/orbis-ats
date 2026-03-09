import asyncio
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.models import InterviewSchedule, CandidateJobEntry, CandidateProfile, JobDescription
from app.schemas.interview_schedule_schema import InterviewScheduleCreate, InterviewScheduleUpdate
from app.services.candidate_service import move_candidate_stage


STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired", "rejected"]


def _row_to_dict(row: InterviewSchedule) -> dict:
    d = {col.name: getattr(row, col.name) for col in row.__table__.columns}
    # Convert datetime fields to ISO strings
    for key in ("created_at", "updated_at"):
        if d.get(key) and isinstance(d[key], datetime):
            d[key] = d[key].isoformat()
    return d


async def schedule_interview(db: AsyncSession, data: InterviewScheduleCreate, created_by: str) -> dict:
    schedule = InterviewSchedule(
        candidate_id=data.candidate_id,
        jd_id=data.jd_id,
        interview_type=data.interview_type,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        duration_minutes=data.duration_minutes,
        location=data.location,
        interviewer_names=data.interviewer_names,
        status="scheduled",
        notes=data.notes,
        created_by=created_by,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Publish real-time event
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("interview_scheduled", {
            "schedule_id": schedule.id, "candidate_id": data.candidate_id, "jd_id": data.jd_id,
        })
    except Exception:
        pass

    # Move candidate to "interview" stage if currently before it
    result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id == data.candidate_id))
    entry = result.scalar_one_or_none()
    if entry:
        current_stage = entry.pipeline_stage or "applied"
        if current_stage in STAGE_ORDER:
            current_idx = STAGE_ORDER.index(current_stage)
            interview_idx = STAGE_ORDER.index("interview")
            if current_idx < interview_idx:
                await move_candidate_stage(db, data.candidate_id, "interview", created_by, "Auto-moved: interview scheduled")

    # Fire-and-forget: send interview scheduled email
    _fire_interview_email(db, data.candidate_id, data.jd_id, schedule)

    return _row_to_dict(schedule)


async def get_interviews_for_job(db: AsyncSession, jd_id: int) -> list:
    result = await db.execute(
        select(InterviewSchedule)
        .where(InterviewSchedule.jd_id == jd_id)
        .order_by(InterviewSchedule.scheduled_date, InterviewSchedule.scheduled_time)
    )
    return [_row_to_dict(row) for row in result.scalars().all()]


async def get_interviews_for_candidate(db: AsyncSession, candidate_id: int) -> list:
    result = await db.execute(
        select(InterviewSchedule)
        .where(InterviewSchedule.candidate_id == candidate_id)
    )
    return [_row_to_dict(row) for row in result.scalars().all()]


async def get_upcoming_interviews(db: AsyncSession, days_ahead: int = 7) -> list:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    end_date = (datetime.utcnow() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    result = await db.execute(
        select(InterviewSchedule)
        .where(
            InterviewSchedule.status == "scheduled",
            InterviewSchedule.scheduled_date >= today,
            InterviewSchedule.scheduled_date <= end_date,
        )
        .order_by(InterviewSchedule.scheduled_date, InterviewSchedule.scheduled_time)
    )
    return [_row_to_dict(row) for row in result.scalars().all()]


async def update_interview(db: AsyncSession, schedule_id: int, data: InterviewScheduleUpdate) -> Optional[dict]:
    values = {k: v for k, v in data.model_dump().items() if v is not None}
    if not values:
        # Nothing to update, just return current row
        result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
        row = result.scalar_one_or_none()
        return _row_to_dict(row) if row else None

    values["updated_at"] = datetime.utcnow()
    await db.execute(
        update(InterviewSchedule)
        .where(InterviewSchedule.id == schedule_id)
        .values(**values)
    )
    await db.commit()

    result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
    row = result.scalar_one_or_none()
    return _row_to_dict(row) if row else None


async def create_panel(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
    rounds: list,
    created_by: str,
) -> list:
    """Create a full interview panel — one InterviewSchedule per round."""
    schedules = []
    for r in rounds:
        schedule = InterviewSchedule(
            candidate_id=candidate_id,
            jd_id=jd_id,
            interview_type="video",
            scheduled_date=r["scheduled_date"],
            scheduled_time=r["scheduled_time"],
            duration_minutes=r.get("duration_minutes", 60),
            location=r.get("location"),
            interviewer_ids=r.get("interviewer_ids", []),
            interviewer_names=r.get("interviewer_names", []),
            meeting_link=r.get("meeting_link"),
            notes=r.get("notes"),
            round_number=r["round_number"],
            round_type=r["round_type"],
            status="scheduled",
            created_by=created_by,
        )
        db.add(schedule)
        schedules.append(schedule)

    await db.commit()
    for s in schedules:
        await db.refresh(s)

    # Auto-move candidate to interview stage if before it
    try:
        entry_result = await db.execute(
            select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
        )
        entry_obj = entry_result.scalar_one_or_none()
        if entry_obj and entry_obj.pipeline_stage in STAGE_ORDER:
            cur_idx = STAGE_ORDER.index(entry_obj.pipeline_stage)
            interview_idx = STAGE_ORDER.index("interview")
            if cur_idx < interview_idx:
                await move_candidate_stage(db, candidate_id, "interview", created_by)
    except Exception:
        pass

    # Increment total_interviews for assigned interviewers
    try:
        from app.db.models import InterviewerProfile
        all_interviewer_ids = set()
        for r in rounds:
            for iid in r.get("interviewer_ids", []):
                all_interviewer_ids.add(iid)

        for iid in all_interviewer_ids:
            prof_result = await db.execute(
                select(InterviewerProfile).where(InterviewerProfile.user_id == iid)
            )
            p = prof_result.scalar_one_or_none()
            if p:
                p.total_interviews = (p.total_interviews or 0) + 1
        await db.commit()
    except Exception:
        pass

    return [_row_to_dict(s) for s in schedules]


async def get_panel(db: AsyncSession, candidate_id: int, jd_id: int) -> list:
    """Get all interview rounds for a candidate + job."""
    result = await db.execute(
        select(InterviewSchedule).where(
            InterviewSchedule.candidate_id == candidate_id,
            InterviewSchedule.jd_id == jd_id,
        ).order_by(InterviewSchedule.round_number)
    )
    return [_row_to_dict(s) for s in result.scalars().all()]


async def cancel_interview(db: AsyncSession, schedule_id: int) -> Optional[dict]:
    # Fetch the schedule before cancelling so we have the details for the email
    pre_result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
    pre_row = pre_result.scalar_one_or_none()

    await db.execute(
        update(InterviewSchedule)
        .where(InterviewSchedule.id == schedule_id)
        .values(status="cancelled", updated_at=datetime.utcnow())
    )
    await db.commit()

    result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
    row = result.scalar_one_or_none()

    # Fire-and-forget: send cancellation email
    if pre_row:
        _fire_cancellation_email(db, pre_row)

    return _row_to_dict(row) if row else None


async def update_interview_status(db: AsyncSession, schedule_id: int, status: str) -> Optional[dict]:
    await db.execute(
        update(InterviewSchedule)
        .where(InterviewSchedule.id == schedule_id)
        .values(status=status, updated_at=datetime.utcnow())
    )
    await db.commit()

    result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
    row = result.scalar_one_or_none()
    return _row_to_dict(row) if row else None


# ---------------------------------------------------------------------------
# Fire-and-forget email helpers
# ---------------------------------------------------------------------------

async def _resolve_candidate_info(db: AsyncSession, candidate_id: int, jd_id: int) -> tuple:
    """Resolve candidate email/name and job title from the DB.

    Returns (email, name, job_title) or (None, None, None) on failure.
    """
    try:
        entry_result = await db.execute(
            select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
        )
        entry = entry_result.scalar_one_or_none()
        if not entry:
            return None, None, None

        profile_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile or not profile.email:
            return None, None, None

        jd_result = await db.execute(
            select(JobDescription).where(JobDescription.id == jd_id)
        )
        jd = jd_result.scalar_one_or_none()
        ai = jd.ai_result if jd else {}
        job_title = ai.get("job_title", "Open Position") if isinstance(ai, dict) else "Open Position"

        return profile.email, profile.full_name or "Candidate", job_title
    except Exception:
        return None, None, None


def _fire_interview_email(db: AsyncSession, candidate_id: int, jd_id: int, schedule: InterviewSchedule):
    """Schedule a fire-and-forget task to send interview-scheduled email."""
    async def _send():
        try:
            from app.services.email_service import send_interview_scheduled
            email, name, job_title = await _resolve_candidate_info(db, candidate_id, jd_id)
            if not email:
                return
            await send_interview_scheduled(
                candidate_email=email,
                candidate_name=name,
                job_title=job_title,
                date=schedule.scheduled_date,
                time=schedule.scheduled_time,
                interview_type=schedule.interview_type or "video",
                meeting_link=schedule.meeting_link,
            )
        except Exception:
            pass  # fire-and-forget — errors are logged inside email_service

    asyncio.create_task(_send())


def _fire_cancellation_email(db: AsyncSession, schedule: InterviewSchedule):
    """Schedule a fire-and-forget task to send interview-cancelled email."""
    async def _send():
        try:
            from app.services.email_service import send_interview_cancelled
            email, name, job_title = await _resolve_candidate_info(
                db, schedule.candidate_id, schedule.jd_id
            )
            if not email:
                return
            await send_interview_cancelled(
                candidate_email=email,
                candidate_name=name,
                job_title=job_title,
                date=schedule.scheduled_date,
                time=schedule.scheduled_time,
            )
        except Exception:
            pass

    asyncio.create_task(_send())
