from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_hiring_access
from app.schemas.screening_schema import (
    ScreeningQuestionCreate,
    ScreeningQuestionUpdate,
    ScreeningResponseBulk,
    TemplateQuestionCreate,
)
from app.services.screening_service import (
    get_questions,
    create_question,
    update_question,
    delete_question,
    generate_questions,
    save_responses,
    get_responses,
    get_responses_with_questions,
    get_template_questions,
    create_template_question,
    delete_template_question,
    add_template_to_job,
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


@router.get("/candidates/{candidate_id}/screening-responses/detailed")
async def get_screening_responses_detailed(
    candidate_id: int,
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get screening responses with question text and knockout evaluation."""
    return await get_responses_with_questions(db, candidate_id, jd_id=jd_id)


# ── Template Questions ──────────────────────────────────────────────

@router.get("/screening-templates")
async def list_template_questions(
    category: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_template_questions(db, category)


@router.post("/screening-templates")
async def create_template(
    data: TemplateQuestionCreate,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await create_template_question(db, data.model_dump(), created_by=str(user["sub"]))


@router.delete("/screening-templates/{template_id}")
async def delete_template(
    template_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    # Only admin or the creator can delete templates
    role = user.get("role", "")
    user_id = str(user["sub"])
    deleted = await delete_template_question(db, template_id, user_id=user_id, is_admin=(role == "admin"))
    if deleted is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not deleted:
        raise HTTPException(status_code=403, detail="Only admins or the template creator can delete templates")
    return {"message": "Template deleted"}


@router.post("/job/{jd_id}/screening-questions/from-template/{template_id}")
async def add_template_question_to_job(
    jd_id: int,
    template_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Copy a template question into this job's screening questions."""
    question = await add_template_to_job(db, jd_id, template_id)
    if not question:
        raise HTTPException(status_code=404, detail="Template not found")
    return question
