from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access, require_employee
from app.services.analytics_service import (
    get_pipeline_funnel,
    get_time_to_hire,
    get_source_effectiveness,
    get_hiring_velocity,
    get_offer_acceptance_rate,
    get_interviewer_load,
    get_rejection_reasons,
    get_recruiter_performance,
    get_time_in_stage,
    get_analytics_summary,
    get_job_board_performance,
    get_scheduling_lag,
)

router = APIRouter()


@router.get("/analytics/funnel")
async def funnel(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_pipeline_funnel(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch funnel data: {e}")


@router.get("/analytics/time-to-hire")
async def time_to_hire(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_time_to_hire(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch time-to-hire data: {e}")


@router.get("/analytics/source-effectiveness")
async def source_effectiveness(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_source_effectiveness(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch source effectiveness data: {e}")


@router.get("/analytics/velocity")
async def velocity(
    jd_id: Optional[int] = Query(None),
    period: Optional[str] = Query("month"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_hiring_velocity(db, jd_id=jd_id, period=period, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hiring velocity data: {e}")


@router.get("/analytics/offer-rate")
async def offer_rate(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_offer_acceptance_rate(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch offer acceptance rate: {e}")


@router.get("/analytics/interviewer-load")
async def interviewer_load(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_interviewer_load(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interviewer load data: {e}")


@router.get("/analytics/rejection-reasons")
async def rejection_reasons(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_rejection_reasons(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch rejection reasons: {e}")


@router.get("/analytics/recruiter-performance")
async def recruiter_performance(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_recruiter_performance(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recruiter performance: {e}")


@router.get("/analytics/time-in-stage")
async def time_in_stage(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_time_in_stage(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch time in stage data: {e}")


@router.get("/analytics/summary")
async def analytics_summary(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_analytics_summary(db, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics summary: {e}")


@router.get("/analytics/job-board-performance")
async def job_board_performance(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_job_board_performance(db, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch job board performance: {e}")


@router.get("/analytics/scheduling-lag")
async def scheduling_lag(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_scheduling_lag(db, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scheduling lag: {e}")


@router.get("/analytics/ai-interviews")
async def ai_interview_analytics(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.services.analytics_service import get_ai_interview_analytics
        return await get_ai_interview_analytics(db, jd_id=jd_id, date_from=date_from, date_to=date_to)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch AI interview analytics: {e}")


@router.get("/analytics/job-attractiveness/{jd_id}")
async def job_attractiveness(
    jd_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analytics_service import get_job_attractiveness
    return await get_job_attractiveness(db, jd_id)


@router.get("/analytics/source-analytics")
async def source_analytics(
    jd_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analytics_service import get_application_source_analytics
    df = datetime.fromisoformat(date_from) if date_from else None
    dt = datetime.fromisoformat(date_to) if date_to else None
    return await get_application_source_analytics(db, jd_id, df, dt)


@router.get("/analytics/compatibility/{jd_id}/{candidate_id}")
async def compatibility_score(
    jd_id: int,
    candidate_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analytics_service import get_compatibility_score
    return await get_compatibility_score(db, candidate_id, jd_id)
