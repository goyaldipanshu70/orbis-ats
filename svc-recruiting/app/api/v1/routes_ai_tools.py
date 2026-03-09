"""AI Recruiting Toolkit routes — ranking, interview questions, salary intelligence,
skills gap analysis, and screening scoring."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.ai_ranking_service import (
    rank_candidates,
    generate_interview_questions,
    get_salary_intelligence,
    get_skills_gap,
    score_screening,
)

logger = logging.getLogger("svc-recruiting")

router = APIRouter()


@router.get("/rank/{jd_id}")
async def get_candidate_ranking(
    jd_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Composite candidate ranking for a job: resume 40% + interview 30% + feedback 20% + screening 10%."""
    try:
        rankings = await rank_candidates(db, jd_id)
        return {"jd_id": jd_id, "total": len(rankings), "rankings": rankings}
    except Exception as e:
        logger.exception("Candidate ranking failed for jd_id=%s", jd_id)
        raise HTTPException(status_code=500, detail=f"Ranking failed: {str(e)}")


@router.get("/questions/{jd_id}/{candidate_id}")
async def get_interview_questions(
    jd_id: int,
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate tailored interview questions based on job requirements and candidate profile."""
    try:
        questions = await generate_interview_questions(db, jd_id, candidate_id)
        if not questions:
            raise HTTPException(status_code=404, detail="Job or candidate not found")
        return {"jd_id": jd_id, "candidate_id": candidate_id, "questions": questions}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Interview question generation failed for jd_id=%s candidate=%s", jd_id, candidate_id)
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


@router.get("/salary/{jd_id}")
async def get_salary_info(
    jd_id: int,
    country: str = None,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Salary intelligence based on internal benchmark data, with optional country filter."""
    try:
        result = await get_salary_intelligence(db, jd_id, country=country)
        if not result:
            raise HTTPException(status_code=404, detail="Job not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Salary intelligence failed for jd_id=%s", jd_id)
        raise HTTPException(status_code=500, detail=f"Salary lookup failed: {str(e)}")


@router.get("/skills-gap/{jd_id}/{candidate_id}")
async def get_skills_gap_analysis(
    jd_id: int,
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Skills gap analysis between job requirements and candidate profile."""
    try:
        result = await get_skills_gap(db, jd_id, candidate_id)
        if not result:
            raise HTTPException(status_code=404, detail="Job or candidate not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Skills gap analysis failed for jd_id=%s candidate=%s", jd_id, candidate_id)
        raise HTTPException(status_code=500, detail=f"Skills gap analysis failed: {str(e)}")


@router.post("/score-screening/{jd_id}/{candidate_id}")
async def score_screening_responses(
    jd_id: int,
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Score screening responses for a candidate using AI with heuristic fallback."""
    try:
        result = await score_screening(db, jd_id, candidate_id)
        if result is None:
            raise HTTPException(status_code=404, detail="No screening questions found for this job")
        return {"jd_id": jd_id, "candidate_id": candidate_id, "scores": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Screening scoring failed for jd_id=%s candidate=%s", jd_id, candidate_id)
        raise HTTPException(status_code=500, detail=f"Screening scoring failed: {str(e)}")
