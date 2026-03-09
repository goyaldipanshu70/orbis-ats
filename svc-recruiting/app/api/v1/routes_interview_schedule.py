from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_hiring_access, require_employee
from app.schemas.interview_schedule_schema import InterviewScheduleCreate, InterviewScheduleUpdate, InterviewStatusUpdate
from app.services.interview_schedule_service import (
    schedule_interview,
    get_interviews_for_job,
    get_interviews_for_candidate,
    get_upcoming_interviews,
    update_interview,
    update_interview_status,
)
from app.services.feedback_service import submit_feedback, get_feedback_for_schedule

router = APIRouter()


@router.post("/schedule")
async def create_interview_schedule(
    data: InterviewScheduleCreate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await schedule_interview(db, data, created_by=user["sub"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule/job/{jd_id}")
async def list_interviews_for_job(
    jd_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_interviews_for_job(db, jd_id)


@router.get("/schedule/candidate/{candidate_id}")
async def list_interviews_for_candidate(
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_interviews_for_candidate(db, candidate_id)


@router.get("/schedule/upcoming")
async def list_upcoming_interviews(
    days_ahead: int = Query(7, ge=1, le=90),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_upcoming_interviews(db, days_ahead)


@router.put("/schedule/{schedule_id}")
async def update_interview_schedule(
    schedule_id: int,
    data: InterviewScheduleUpdate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await update_interview(db, schedule_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Interview schedule not found")
    return result


@router.put("/schedule/{schedule_id}/status")
async def change_interview_status(
    schedule_id: int,
    data: InterviewStatusUpdate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await update_interview_status(db, schedule_id, data.status)
    if result is None:
        raise HTTPException(status_code=404, detail="Interview schedule not found")
    return result


# ── Interview Feedback ────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    rating: int
    recommendation: str
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    notes: Optional[str] = None
    criteria_scores: Optional[Dict[str, Any]] = None
    rubric_scores: Optional[Dict[str, Any]] = None


@router.post("/schedule/{schedule_id}/feedback")
async def submit_interview_feedback(
    schedule_id: int,
    body: FeedbackRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Submit feedback for an interview round."""
    try:
        result = await submit_feedback(
            db,
            schedule_id=schedule_id,
            interviewer_id=user["sub"],
            interviewer_name=f"{user['first_name']} {user['last_name']}",
            rating=body.rating,
            recommendation=body.recommendation,
            strengths=body.strengths,
            concerns=body.concerns,
            notes=body.notes,
            criteria_scores=body.criteria_scores,
            rubric_scores=body.rubric_scores,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        err_msg = str(e).lower()
        if "foreign key" in err_msg or "violates" in err_msg or "not present" in err_msg:
            raise HTTPException(status_code=404, detail="Interview schedule not found")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule/{schedule_id}/feedback")
async def get_interview_feedback(
    schedule_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Get all feedback for an interview schedule."""
    return await get_feedback_for_schedule(db, schedule_id)


@router.get("/feedback/candidate/{candidate_id}/{jd_id}")
async def get_candidate_aggregate_feedback(
    candidate_id: int,
    jd_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive feedback across all interview rounds for a candidate + job."""
    from app.services.feedback_service import get_aggregate_feedback
    return await get_aggregate_feedback(db, candidate_id, jd_id)


# ── Interview Panel Builder ──────────────────────────────────────────────────

from app.schemas.interview_schedule_schema import PanelCreateRequest


@router.post("/panel")
async def create_interview_panel(
    body: PanelCreateRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    from app.services.interview_schedule_service import create_panel
    rounds_data = [r.model_dump() for r in body.rounds]
    result = await create_panel(db, body.candidate_id, body.jd_id, rounds_data, user["sub"])
    return {"rounds": result, "message": f"{len(result)} interview round(s) scheduled"}


@router.get("/panel/{candidate_id}/{jd_id}")
async def get_interview_panel(
    candidate_id: int,
    jd_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    from app.services.interview_schedule_service import get_panel
    return await get_panel(db, candidate_id, jd_id)


@router.post("/schedule/{schedule_id}/reschedule")
async def reschedule_interview(
    schedule_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Reschedule an interview, storing history."""
    from app.db.models import InterviewSchedule, InterviewRescheduleHistory
    from sqlalchemy import select, update as sql_update

    new_date = body.get("new_date")
    new_time = body.get("new_time")
    reason = body.get("reason")
    if not new_date or not new_time:
        raise HTTPException(status_code=400, detail="new_date and new_time are required")

    # Get current schedule
    result = await db.execute(select(InterviewSchedule).where(InterviewSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Save reschedule history
    history = InterviewRescheduleHistory(
        schedule_id=schedule_id,
        old_date=schedule.scheduled_date,
        old_time=schedule.scheduled_time,
        new_date=new_date,
        new_time=new_time,
        reason=reason,
        rescheduled_by=user["sub"],
        rescheduled_by_role=user.get("role"),
    )
    db.add(history)

    # Update the schedule
    from datetime import datetime
    await db.execute(
        sql_update(InterviewSchedule)
        .where(InterviewSchedule.id == schedule_id)
        .values(
            scheduled_date=new_date,
            scheduled_time=new_time,
            reschedule_count=InterviewSchedule.reschedule_count + 1,
            reschedule_reason=reason,
            original_date=schedule.original_date or schedule.scheduled_date,
            original_time=schedule.original_time or schedule.scheduled_time,
            updated_at=datetime.utcnow(),
        )
    )
    await db.commit()
    return {"message": "Interview rescheduled", "new_date": new_date, "new_time": new_time}


@router.get("/schedule/{schedule_id}/reschedule-history")
async def get_reschedule_history(
    schedule_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    from app.db.models import InterviewRescheduleHistory
    from sqlalchemy import select
    result = await db.execute(
        select(InterviewRescheduleHistory)
        .where(InterviewRescheduleHistory.schedule_id == schedule_id)
        .order_by(InterviewRescheduleHistory.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": h.id,
            "old_date": h.old_date,
            "old_time": h.old_time,
            "new_date": h.new_date,
            "new_time": h.new_time,
            "reason": h.reason,
            "rescheduled_by": h.rescheduled_by,
            "rescheduled_by_role": h.rescheduled_by_role,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in rows
    ]
