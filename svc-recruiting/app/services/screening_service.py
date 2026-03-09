import json
import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.db.models import ScreeningQuestion, ScreeningResponse, JobDescription

logger = logging.getLogger("svc-recruiting")
from app.schemas.screening_schema import (
    ScreeningQuestionCreate,
    ScreeningQuestionUpdate,
    ScreeningResponseCreate,
)
from app.core.config import settings
from app.core.http_client import get_ai_client


def _question_to_dict(q: ScreeningQuestion) -> dict:
    return {
        "id": q.id,
        "jd_id": q.jd_id,
        "question": q.question,
        "question_type": q.question_type,
        "options": q.options,
        "required": q.required,
        "ai_generated": q.ai_generated,
        "sort_order": q.sort_order,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


def _response_to_dict(r: ScreeningResponse) -> dict:
    return {
        "id": r.id,
        "candidate_id": r.candidate_id,
        "question_id": r.question_id,
        "response": r.response,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def get_questions(db: AsyncSession, jd_id: int) -> List[dict]:
    result = await db.execute(
        select(ScreeningQuestion)
        .where(ScreeningQuestion.jd_id == jd_id)
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
    )
    return [_question_to_dict(q) for q in result.scalars().all()]


async def create_question(
    db: AsyncSession, jd_id: int, data: ScreeningQuestionCreate
) -> dict:
    question = ScreeningQuestion(
        jd_id=jd_id,
        question=data.question,
        question_type=data.question_type,
        options=data.options,
        required=data.required,
        ai_generated=False,
        sort_order=data.sort_order,
        created_at=datetime.utcnow(),
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return _question_to_dict(question)


async def update_question(
    db: AsyncSession, jd_id: int, question_id: int, data: ScreeningQuestionUpdate
) -> Optional[dict]:
    result = await db.execute(
        select(ScreeningQuestion).where(
            ScreeningQuestion.id == question_id,
            ScreeningQuestion.jd_id == jd_id,
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        return None

    update_values = data.model_dump(exclude_unset=True)
    if not update_values:
        return _question_to_dict(question)

    await db.execute(
        update(ScreeningQuestion)
        .where(ScreeningQuestion.id == question_id, ScreeningQuestion.jd_id == jd_id)
        .values(**update_values)
    )
    await db.commit()

    result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    return _question_to_dict(question) if question else None


async def delete_question(db: AsyncSession, jd_id: int, question_id: int) -> bool:
    result = await db.execute(
        delete(ScreeningQuestion).where(
            ScreeningQuestion.id == question_id,
            ScreeningQuestion.jd_id == jd_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


async def generate_questions(db: AsyncSession, jd_id: int) -> List[dict]:
    """Read the job's ai_result, call svc-ai-chat to generate screening questions, save them."""
    result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = result.scalar_one_or_none()
    if not jd:
        return []

    ai_result = jd.ai_result or {}
    job_title = ai_result.get("job_title", "Unknown")
    summary = ai_result.get("summary", "")
    extracted_rubric = ai_result.get("extracted_rubric", {})
    core_skills = extracted_rubric.get("core_skills", [])
    preferred_skills = extracted_rubric.get("preferred_skills", [])

    jd_context = (
        f"Job Title: {job_title}\n"
        f"Summary: {summary}\n"
        f"Core Skills: {', '.join(core_skills) if core_skills else 'N/A'}\n"
        f"Preferred Skills: {', '.join(preferred_skills) if preferred_skills else 'N/A'}"
    )

    prompt = (
        f"Based on the following job description, generate exactly 5 screening questions "
        f"that a recruiter should ask candidates during the initial screening phase.\n\n"
        f"{jd_context}\n\n"
        f"Return your response as a JSON array of objects, each with these fields:\n"
        f'- "question": the screening question text\n'
        f'- "question_type": one of "text", "multiple_choice", or "yes_no"\n'
        f'- "options": an array of option strings if question_type is "multiple_choice", otherwise null\n'
        f'- "required": true\n\n'
        f"Return ONLY the JSON array, no other text."
    )

    try:
        client = get_ai_client()
        response = await client.post(
            f"{settings.AI_CHAT_URL}/chat/complete",
            json={
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        data = response.json()

        # Extract the assistant's reply
        ai_text = data.get("content", "") or data.get("message", "") or ""
        if isinstance(ai_text, list):
            # Handle structured content blocks
            ai_text = " ".join(
                block.get("text", "") for block in ai_text if isinstance(block, dict)
            )

        # Parse JSON from the AI response — strip markdown fences if present
        ai_text = ai_text.strip()
        if ai_text.startswith("```"):
            lines = ai_text.split("\n")
            # Remove first and last lines (fences)
            lines = [l for l in lines if not l.strip().startswith("```")]
            ai_text = "\n".join(lines)

        questions_data = json.loads(ai_text)
    except Exception as e:
        logger.warning("AI screening question generation failed: %s", e)
        # Fallback: generate generic questions
        questions_data = [
            {"question": f"What interests you about the {job_title} role?", "question_type": "text", "options": None, "required": True},
            {"question": "How many years of relevant experience do you have?", "question_type": "text", "options": None, "required": True},
            {"question": "Are you available to start within the next 30 days?", "question_type": "yes_no", "options": None, "required": True},
            {"question": "What are your salary expectations?", "question_type": "text", "options": None, "required": True},
            {"question": "Are you authorized to work in the country where this position is based?", "question_type": "yes_no", "options": None, "required": True},
        ]

    saved_questions = []
    for idx, q_data in enumerate(questions_data[:5]):
        question = ScreeningQuestion(
            jd_id=jd_id,
            question=q_data.get("question", ""),
            question_type=q_data.get("question_type", "text"),
            options=q_data.get("options"),
            required=q_data.get("required", True),
            ai_generated=True,
            sort_order=idx,
            created_at=datetime.utcnow(),
        )
        db.add(question)
        saved_questions.append(question)

    await db.commit()
    for q in saved_questions:
        await db.refresh(q)

    return [_question_to_dict(q) for q in saved_questions]


async def save_responses(
    db: AsyncSession, candidate_id: int, responses: List[ScreeningResponseCreate]
) -> List[dict]:
    """Bulk upsert screening responses for a candidate."""
    saved = []
    for resp in responses:
        # Try to find existing response for this candidate+question pair
        result = await db.execute(
            select(ScreeningResponse).where(
                ScreeningResponse.candidate_id == candidate_id,
                ScreeningResponse.question_id == resp.question_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            await db.execute(
                update(ScreeningResponse)
                .where(ScreeningResponse.id == existing.id)
                .values(response=resp.response, created_at=datetime.utcnow())
            )
        else:
            new_resp = ScreeningResponse(
                candidate_id=candidate_id,
                question_id=resp.question_id,
                response=resp.response,
                created_at=datetime.utcnow(),
            )
            db.add(new_resp)

    await db.commit()

    # Fetch all responses for this candidate
    return await get_responses(db, candidate_id)


async def get_responses(db: AsyncSession, candidate_id: int) -> List[dict]:
    result = await db.execute(
        select(ScreeningResponse).where(
            ScreeningResponse.candidate_id == candidate_id
        )
    )
    return [_response_to_dict(r) for r in result.scalars().all()]
