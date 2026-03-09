"""Interviewer CRUD service — profile management, interview lookups, and stats."""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, cast, text
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

from app.db.models import (
    InterviewerProfile,
    InterviewSchedule,
    InterviewerFeedback,
    CandidateJobEntry,
    CandidateProfile,
    JobDescription,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _profile_to_dict(p: InterviewerProfile) -> dict:
    """Convert an InterviewerProfile row to a plain dict."""
    return {
        "id": p.id,
        "user_id": p.user_id,
        "email": p.email,
        "full_name": p.full_name,
        "specializations": p.specializations or [],
        "seniority": p.seniority,
        "department": p.department,
        "max_interviews_per_week": p.max_interviews_per_week,
        "is_active": p.is_active,
        "total_interviews": p.total_interviews,
        "avg_rating_given": p.avg_rating_given,
        "created_at": p.created_at.isoformat() if isinstance(p.created_at, datetime) else str(p.created_at),
        "updated_at": p.updated_at.isoformat() if isinstance(p.updated_at, datetime) else str(p.updated_at),
    }


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def create_interviewer_profile(
    db: AsyncSession,
    user_id: int,
    email: str,
    full_name: str,
    specializations: list | None = None,
    seniority: str | None = None,
    department: str | None = None,
) -> InterviewerProfile:
    """Create a new interviewer profile (one per user_id)."""
    profile = InterviewerProfile(
        user_id=user_id,
        email=email,
        full_name=full_name,
        specializations=specializations or [],
        seniority=seniority,
        department=department,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def get_interviewers(
    db: AsyncSession,
    search: str | None = None,
    specialization: str | None = None,
    department: str | None = None,
    active_only: bool = True,
) -> List[dict]:
    """List interviewer profiles with optional filters."""
    q = select(InterviewerProfile)

    if active_only:
        q = q.where(InterviewerProfile.is_active.is_(True))

    if search:
        pattern = f"%{search}%"
        q = q.where(
            InterviewerProfile.full_name.ilike(pattern)
            | InterviewerProfile.email.ilike(pattern)
        )

    if specialization:
        # JSONB containment: specializations @> '["value"]'
        q = q.where(
            InterviewerProfile.specializations.op("@>")(
                cast([specialization], PG_JSONB)
            )
        )

    if department:
        q = q.where(InterviewerProfile.department == department)

    q = q.order_by(InterviewerProfile.full_name)
    result = await db.execute(q)
    return [_profile_to_dict(p) for p in result.scalars().all()]


async def get_interviewer_by_id(
    db: AsyncSession, profile_id: int
) -> Optional[dict]:
    """Fetch a single interviewer profile by its primary key."""
    result = await db.execute(
        select(InterviewerProfile).where(InterviewerProfile.id == profile_id)
    )
    row = result.scalar_one_or_none()
    return _profile_to_dict(row) if row else None


async def get_interviewer_by_user_id(
    db: AsyncSession, user_id: int
) -> Optional[dict]:
    """Fetch a single interviewer profile by user_id."""
    result = await db.execute(
        select(InterviewerProfile).where(InterviewerProfile.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    return _profile_to_dict(row) if row else None


async def update_interviewer(
    db: AsyncSession, profile_id: int, data: dict
) -> bool:
    """Update allowed fields on an interviewer profile. Returns True if found."""
    allowed = {
        "email", "full_name", "specializations", "seniority",
        "department", "max_interviews_per_week",
    }
    values = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not values:
        # Check row exists even with nothing to update
        result = await db.execute(
            select(InterviewerProfile.id).where(InterviewerProfile.id == profile_id)
        )
        return result.scalar_one_or_none() is not None

    values["updated_at"] = datetime.utcnow()
    result = await db.execute(
        update(InterviewerProfile)
        .where(InterviewerProfile.id == profile_id)
        .values(**values)
    )
    await db.commit()
    return result.rowcount > 0


async def toggle_interviewer_status(
    db: AsyncSession, profile_id: int, is_active: bool
) -> bool:
    """Activate or deactivate an interviewer. Returns True if found."""
    result = await db.execute(
        update(InterviewerProfile)
        .where(InterviewerProfile.id == profile_id)
        .values(is_active=is_active, updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


# ---------------------------------------------------------------------------
# My interviews (for the logged-in interviewer)
# ---------------------------------------------------------------------------

async def get_my_interviews(
    db: AsyncSession,
    user_id: int,
    status: str | None = None,
) -> List[dict]:
    """Return interview schedules where *user_id* is in interviewer_ids.

    Each schedule is enriched with candidate_name, job_title, and
    whether this interviewer has already submitted feedback.
    """
    q = select(InterviewSchedule).where(
        # JSONB containment: interviewer_ids @> '[<user_id>]'
        InterviewSchedule.interviewer_ids.op("@>")(cast([user_id], PG_JSONB))
    )

    if status:
        q = q.where(InterviewSchedule.status == status)

    q = q.order_by(InterviewSchedule.scheduled_date.desc())
    result = await db.execute(q)
    schedules = result.scalars().all()

    out: list[dict] = []
    for s in schedules:
        # --- Enrich with candidate name & job title ---
        candidate_name = None
        job_title = None

        if s.candidate_id:
            entry_res = await db.execute(
                select(CandidateJobEntry).where(CandidateJobEntry.id == s.candidate_id)
            )
            entry = entry_res.scalar_one_or_none()
            if entry:
                # Candidate name via profile
                profile_res = await db.execute(
                    select(CandidateProfile.full_name).where(
                        CandidateProfile.id == entry.profile_id
                    )
                )
                candidate_name = profile_res.scalar_one_or_none()

                # Job title via JD ai_result
                jd_res = await db.execute(
                    select(JobDescription.ai_result).where(
                        JobDescription.id == entry.jd_id
                    )
                )
                ai_result = jd_res.scalar_one_or_none()
                if ai_result and isinstance(ai_result, dict):
                    job_title = ai_result.get("job_title")

        # --- Check if feedback already submitted by this interviewer ---
        fb_res = await db.execute(
            select(InterviewerFeedback.id).where(
                InterviewerFeedback.schedule_id == s.id,
                InterviewerFeedback.interviewer_id == str(user_id),
            )
        )
        feedback_submitted = fb_res.scalar_one_or_none() is not None

        out.append({
            "id": s.id,
            "candidate_id": s.candidate_id,
            "jd_id": s.jd_id,
            "interview_type": s.interview_type,
            "scheduled_date": s.scheduled_date,
            "scheduled_time": s.scheduled_time,
            "duration_minutes": s.duration_minutes,
            "location": s.location,
            "interviewer_ids": s.interviewer_ids,
            "interviewer_names": s.interviewer_names,
            "status": s.status,
            "notes": s.notes,
            "meeting_link": s.meeting_link,
            "round_number": s.round_number,
            "round_type": s.round_type,
            "created_at": s.created_at.isoformat() if isinstance(s.created_at, datetime) else str(s.created_at),
            "updated_at": s.updated_at.isoformat() if isinstance(s.updated_at, datetime) else str(s.updated_at),
            # enriched fields
            "candidate_name": candidate_name,
            "job_title": job_title,
            "feedback_submitted": feedback_submitted,
        })

    return out


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_interviewer_stats(db: AsyncSession, user_id: int) -> dict:
    """Aggregate statistics for one interviewer (by user_id)."""

    # --- Upcoming interviews (status = "scheduled") ---
    upcoming_res = await db.execute(
        select(func.count(InterviewSchedule.id)).where(
            InterviewSchedule.interviewer_ids.op("@>")(cast([user_id], PG_JSONB)),
            InterviewSchedule.status == "scheduled",
        )
    )
    upcoming_count = upcoming_res.scalar() or 0

    # --- Completed this month ---
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    completed_res = await db.execute(
        select(func.count(InterviewSchedule.id)).where(
            InterviewSchedule.interviewer_ids.op("@>")(cast([user_id], PG_JSONB)),
            InterviewSchedule.status == "completed",
            InterviewSchedule.updated_at >= first_of_month,
        )
    )
    completed_this_month = completed_res.scalar() or 0

    # --- Pending feedback: completed schedules where this user hasn't submitted feedback ---
    completed_sched_res = await db.execute(
        select(InterviewSchedule.id).where(
            InterviewSchedule.interviewer_ids.op("@>")(cast([user_id], PG_JSONB)),
            InterviewSchedule.status == "completed",
        )
    )
    completed_ids = [row[0] for row in completed_sched_res.all()]

    pending_feedback = 0
    if completed_ids:
        fb_res = await db.execute(
            select(InterviewerFeedback.schedule_id).where(
                InterviewerFeedback.schedule_id.in_(completed_ids),
                InterviewerFeedback.interviewer_id == str(user_id),
            )
        )
        submitted_ids = {row[0] for row in fb_res.all()}
        pending_feedback = len(set(completed_ids) - submitted_ids)

    # --- Average rating given ---
    avg_res = await db.execute(
        select(func.avg(InterviewerFeedback.rating)).where(
            InterviewerFeedback.interviewer_id == str(user_id)
        )
    )
    avg_raw = avg_res.scalar()
    avg_rating_given = round(float(avg_raw), 2) if avg_raw is not None else None

    # --- Total interviews from profile ---
    profile_res = await db.execute(
        select(InterviewerProfile.total_interviews).where(
            InterviewerProfile.user_id == user_id
        )
    )
    total_interviews = profile_res.scalar() or 0

    return {
        "upcoming_count": upcoming_count,
        "completed_this_month": completed_this_month,
        "pending_feedback": pending_feedback,
        "avg_rating_given": avg_rating_given,
        "total_interviews": total_interviews,
    }
