"""Endpoints for reading/writing AI result caches on existing tables."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.db.models import JobDescription, CandidateJobEntry, InterviewSchedule

router = APIRouter()


# ── Job Description AI cache ──

@router.get("/job/{jd_id}/generated-jd")
async def get_generated_jd(jd_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(JobDescription.ai_generated_jd).where(JobDescription.id == jd_id))
    return result.scalar_one_or_none() or {}


@router.put("/job/{jd_id}/generated-jd")
async def set_generated_jd(jd_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(JobDescription).where(JobDescription.id == jd_id).values(ai_generated_jd=body))
    await db.commit()
    return {"ok": True}


@router.get("/job/{jd_id}/bias-check")
async def get_bias_check(jd_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(JobDescription.ai_bias_check).where(JobDescription.id == jd_id))
    return result.scalar_one_or_none() or {}


@router.put("/job/{jd_id}/bias-check")
async def set_bias_check(jd_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(JobDescription).where(JobDescription.id == jd_id).values(ai_bias_check=body))
    await db.commit()
    return {"ok": True}


@router.get("/job/{jd_id}/salary")
async def get_salary_estimate(jd_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(JobDescription.ai_salary_estimate).where(JobDescription.id == jd_id))
    return result.scalar_one_or_none() or {}


@router.put("/job/{jd_id}/salary")
async def set_salary_estimate(jd_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(JobDescription).where(JobDescription.id == jd_id).values(ai_salary_estimate=body))
    await db.commit()
    return {"ok": True}


# ── Candidate Job Entry AI cache ──

@router.get("/candidate/{entry_id}/fit-summary")
async def get_fit_summary(entry_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(CandidateJobEntry.ai_fit_summary).where(CandidateJobEntry.id == entry_id))
    return result.scalar_one_or_none() or {}


@router.put("/candidate/{entry_id}/fit-summary")
async def set_fit_summary(entry_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(CandidateJobEntry).where(CandidateJobEntry.id == entry_id).values(ai_fit_summary=body))
    await db.commit()
    return {"ok": True}


@router.get("/candidate/{entry_id}/ranking")
async def get_ranking_score(entry_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(CandidateJobEntry.ai_ranking_score).where(CandidateJobEntry.id == entry_id))
    return result.scalar_one_or_none() or {}


@router.put("/candidate/{entry_id}/ranking")
async def set_ranking_score(entry_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(CandidateJobEntry).where(CandidateJobEntry.id == entry_id).values(ai_ranking_score=body))
    await db.commit()
    return {"ok": True}


@router.get("/candidate/{entry_id}/skills-gap")
async def get_skills_gap(entry_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(CandidateJobEntry.ai_skills_gap).where(CandidateJobEntry.id == entry_id))
    return result.scalar_one_or_none() or {}


@router.put("/candidate/{entry_id}/skills-gap")
async def set_skills_gap(entry_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(CandidateJobEntry).where(CandidateJobEntry.id == entry_id).values(ai_skills_gap=body))
    await db.commit()
    return {"ok": True}


# ── Interview Schedule AI cache ──

@router.get("/schedule/{schedule_id}/questions")
async def get_suggested_questions(schedule_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    result = await db.execute(select(InterviewSchedule.ai_suggested_questions).where(InterviewSchedule.id == schedule_id))
    return result.scalar_one_or_none() or {}


@router.put("/schedule/{schedule_id}/questions")
async def set_suggested_questions(schedule_id: int, body: dict, db: AsyncSession = Depends(get_db), _=Depends(require_hiring_access)):
    await db.execute(update(InterviewSchedule).where(InterviewSchedule.id == schedule_id).values(ai_suggested_questions=body))
    await db.commit()
    return {"ok": True}
