from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_hiring_access
from app.schemas.screening_schema import (
    ScreeningQuestionCreate,
    ScreeningQuestionUpdate,
    ScreeningResponseBulk,
)
from app.services.screening_service import (
    get_questions,
    create_question,
    update_question,
    delete_question,
    generate_questions,
    save_responses,
    get_responses,
)

router = APIRouter()


# ── Screening Questions ─────────────────────────────────────────────

@router.get("/job/{jd_id}/screening-questions")
async def list_screening_questions(
    jd_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    questions = await get_questions(db, jd_id)
    return questions


@router.post("/job/{jd_id}/screening-questions")
async def create_screening_question(
    jd_id: int,
    data: ScreeningQuestionCreate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    question = await create_question(db, jd_id, data)
    return question


@router.put("/job/{jd_id}/screening-questions/{q_id}")
async def update_screening_question(
    jd_id: int,
    q_id: int,
    data: ScreeningQuestionUpdate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    question = await update_question(db, jd_id, q_id, data)
    if question is None:
        raise HTTPException(status_code=404, detail="Screening question not found")
    return question


@router.delete("/job/{jd_id}/screening-questions/{q_id}")
async def delete_screening_question(
    jd_id: int,
    q_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_question(db, jd_id, q_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Screening question not found")
    return {"message": "Screening question deleted"}


@router.post("/job/{jd_id}/screening-questions/generate")
async def generate_screening_questions(
    jd_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    questions = await generate_questions(db, jd_id)
    if not questions:
        raise HTTPException(status_code=404, detail="Job not found or generation failed")
    return questions


# ── Screening Responses ─────────────────────────────────────────────

@router.post("/candidates/{candidate_id}/screening-responses")
async def save_screening_responses(
    candidate_id: int,
    data: ScreeningResponseBulk,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    responses = await save_responses(db, candidate_id, data.responses)
    return responses


@router.get("/candidates/{candidate_id}/screening-responses")
async def get_screening_responses(
    candidate_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    responses = await get_responses(db, candidate_id)
    return responses
