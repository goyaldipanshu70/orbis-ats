import json
import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.db.models import ScreeningQuestion, ScreeningResponse, ScreeningTemplateQuestion, JobDescription, CandidateJobEntry

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
        "is_knockout": q.is_knockout,
        "knockout_condition": q.knockout_condition,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


def _template_to_dict(t: ScreeningTemplateQuestion) -> dict:
    return {
        "id": t.id,
        "question": t.question,
        "question_type": t.question_type,
        "options": t.options,
        "category": t.category,
        "is_knockout": t.is_knockout,
        "knockout_condition": t.knockout_condition,
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
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
        is_knockout=data.is_knockout,
        knockout_condition=data.knockout_condition,
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
    """Read the job's ai_result, call svc-ai-chat to generate screening questions, save them.
    Clears existing AI-generated questions before generating new ones."""
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
        f"You are an experienced HR recruiter. Generate exactly 5 practical screening questions "
        f"for candidates applying to this role. Focus on questions that help quickly qualify or "
        f"disqualify candidates in a real-world hiring scenario.\n\n"
        f"{jd_context}\n\n"
        f"Include a mix of:\n"
        f"- Logistics (notice period, availability, work authorization, relocation)\n"
        f"- Compensation (current CTC/salary, salary expectations)\n"
        f"- Experience (years of relevant experience, specific tech/skill proficiency)\n"
        f"- Eligibility (visa needs, background check, shift flexibility)\n\n"
        f"Return your response as a JSON array of objects, each with:\n"
        f'- "question": the screening question text\n'
        f'- "question_type": one of "text", "multiple_choice", or "yes_no"\n'
        f'- "options": array of option strings if multiple_choice, otherwise null\n'
        f'- "required": true\n'
        f'- "is_knockout": true if a wrong answer should auto-disqualify the candidate\n'
        f'- "knockout_condition": if is_knockout is true, specify condition like "equals:No" or "equals:Yes"\n\n'
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

        ai_text = data.get("content", "") or data.get("message", "") or ""
        if isinstance(ai_text, list):
            ai_text = " ".join(
                block.get("text", "") for block in ai_text if isinstance(block, dict)
            )

        ai_text = ai_text.strip()
        if ai_text.startswith("```"):
            lines = ai_text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            ai_text = "\n".join(lines)

        questions_data = json.loads(ai_text)
    except Exception as e:
        logger.warning("AI screening question generation failed: %s", e)
        questions_data = [
            {"question": "What is your notice period / earliest available start date?", "question_type": "text", "options": None, "required": True, "is_knockout": False},
            {"question": "What are your salary expectations for this role?", "question_type": "text", "options": None, "required": True, "is_knockout": False},
            {"question": "How many years of relevant experience do you have?", "question_type": "text", "options": None, "required": True, "is_knockout": False},
            {"question": "Are you authorized to work in the country where this position is based?", "question_type": "yes_no", "options": None, "required": True, "is_knockout": True, "knockout_condition": "equals:No"},
            {"question": "What is your reason for looking for a job change?", "question_type": "text", "options": None, "required": True, "is_knockout": False},
        ]

    # Clear existing AI-generated questions now that we have replacements ready
    await db.execute(
        delete(ScreeningQuestion).where(
            ScreeningQuestion.jd_id == jd_id,
            ScreeningQuestion.ai_generated == True,
        )
    )
    await db.flush()

    # Get max sort_order of existing (manual) questions
    max_sort_result = await db.execute(
        select(func.max(ScreeningQuestion.sort_order)).where(ScreeningQuestion.jd_id == jd_id)
    )
    max_sort = max_sort_result.scalar() or 0

    saved_questions = []
    for idx, q_data in enumerate(questions_data[:5]):
        question = ScreeningQuestion(
            jd_id=jd_id,
            question=q_data.get("question", ""),
            question_type=q_data.get("question_type", "text"),
            options=q_data.get("options"),
            required=q_data.get("required", True),
            ai_generated=True,
            sort_order=max_sort + idx + 1,
            is_knockout=q_data.get("is_knockout", False),
            knockout_condition=q_data.get("knockout_condition"),
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
    # Validate question_ids belong to the candidate's job
    entry_result = await db.execute(
        select(CandidateJobEntry.jd_id).where(CandidateJobEntry.id == candidate_id)
    )
    jd_id = entry_result.scalar_one_or_none()
    if jd_id and responses:
        question_ids = [r.question_id for r in responses]
        valid_result = await db.execute(
            select(ScreeningQuestion.id).where(
                ScreeningQuestion.id.in_(question_ids),
                ScreeningQuestion.jd_id == jd_id,
            )
        )
        valid_ids = set(valid_result.scalars().all())
        responses = [r for r in responses if r.question_id in valid_ids]

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
                .values(response=resp.response)
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


async def get_responses_with_questions(db: AsyncSession, candidate_id: int, jd_id: Optional[int] = None) -> List[dict]:
    """Get responses joined with question text for display, optionally scoped to a job."""
    query = (
        select(ScreeningResponse, ScreeningQuestion)
        .join(ScreeningQuestion, ScreeningResponse.question_id == ScreeningQuestion.id)
        .where(ScreeningResponse.candidate_id == candidate_id)
    )
    if jd_id is not None:
        query = query.where(ScreeningQuestion.jd_id == jd_id)
    result = await db.execute(
        query.order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
    )
    rows = result.all()
    return [
        {
            "id": resp.id,
            "question_id": resp.question_id,
            "question": q.question,
            "question_type": q.question_type,
            "options": q.options,
            "is_knockout": q.is_knockout,
            "knockout_condition": q.knockout_condition,
            "response": resp.response,
            "is_disqualified": _check_knockout(q, resp.response),
            "created_at": resp.created_at.isoformat() if resp.created_at else None,
        }
        for resp, q in rows
    ]


def _check_knockout(question: ScreeningQuestion, response: str) -> bool:
    """Check if a response triggers a knockout condition."""
    if not question.is_knockout or not question.knockout_condition:
        return False
    if response is None:
        return False
    condition = question.knockout_condition
    resp_lower = response.strip().lower()
    if condition.startswith("equals:"):
        target = condition[7:].strip().lower()
        return resp_lower == target
    if condition.startswith("not_equals:"):
        target = condition[11:].strip().lower()
        return resp_lower != target
    if condition.startswith("less_than:"):
        try:
            return float(resp_lower) < float(condition[10:].strip())
        except (ValueError, TypeError):
            return False
    if condition.startswith("must_be:"):
        targets = [t.strip().lower() for t in condition[8:].split(",")]
        return resp_lower not in targets
    # Legacy alias
    if condition.startswith("not_in:"):
        targets = [t.strip().lower() for t in condition[7:].split(",")]
        return resp_lower not in targets
    return False


# ── Template Questions ──────────────────────────────────────────────

async def get_template_questions(db: AsyncSession, category: Optional[str] = None) -> List[dict]:
    query = select(ScreeningTemplateQuestion).order_by(ScreeningTemplateQuestion.category, ScreeningTemplateQuestion.id)
    if category:
        query = query.where(ScreeningTemplateQuestion.category == category)
    result = await db.execute(query)
    return [_template_to_dict(t) for t in result.scalars().all()]


async def create_template_question(db: AsyncSession, data: dict, created_by: Optional[str] = None) -> dict:
    tpl = ScreeningTemplateQuestion(
        question=data["question"],
        question_type=data.get("question_type", "text"),
        options=data.get("options"),
        category=data.get("category", "general"),
        is_knockout=data.get("is_knockout", False),
        knockout_condition=data.get("knockout_condition"),
        created_by=created_by,
        created_at=datetime.utcnow(),
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return _template_to_dict(tpl)


async def delete_template_question(db: AsyncSession, template_id: int, user_id: Optional[str] = None, is_admin: bool = False) -> Optional[bool]:
    """Delete a template question. Returns None if not found, False if forbidden, True if deleted."""
    result = await db.execute(
        select(ScreeningTemplateQuestion).where(ScreeningTemplateQuestion.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        return None
    # Only admin or the creator can delete
    if not is_admin and tpl.created_by and tpl.created_by != user_id:
        return False
    # System templates (created_by=NULL) can only be deleted by admin
    if not is_admin and tpl.created_by is None:
        return False
    await db.execute(
        delete(ScreeningTemplateQuestion).where(ScreeningTemplateQuestion.id == template_id)
    )
    await db.commit()
    return True


async def add_template_to_job(db: AsyncSession, jd_id: int, template_id: int) -> Optional[dict]:
    """Copy a template question into a job's screening questions."""
    result = await db.execute(
        select(ScreeningTemplateQuestion).where(ScreeningTemplateQuestion.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        return None

    max_sort_result = await db.execute(
        select(func.max(ScreeningQuestion.sort_order)).where(ScreeningQuestion.jd_id == jd_id)
    )
    max_sort = max_sort_result.scalar() or 0

    question = ScreeningQuestion(
        jd_id=jd_id,
        question=tpl.question,
        question_type=tpl.question_type,
        options=tpl.options,
        required=True,
        ai_generated=False,
        sort_order=max_sort + 1,
        is_knockout=tpl.is_knockout,
        knockout_condition=tpl.knockout_condition,
        created_at=datetime.utcnow(),
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return _question_to_dict(question)
