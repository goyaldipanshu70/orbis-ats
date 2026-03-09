import logging
import math
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.db.models import JobDescription, CandidateJobEntry, InterviewEvaluation
from app.core.config import settings
from app.core.http_client import get_ai_client

logger = logging.getLogger("svc-recruiting")
from app.schemas.interview_schema import (
    InterviewAIResult,
    InterviewEvaluationResponse,
    ScoreDetailedBreakdown,
    InterviewDetailedAIResult
)


async def evaluate_and_save_interview(db: AsyncSession, candidate_id: str, transcript_url: str):
    cand_result = await db.execute(select(CandidateJobEntry).where(CandidateJobEntry.id == int(candidate_id)))
    entry = cand_result.scalar_one_or_none()
    if not entry:
        raise ValueError("Candidate not found")

    jd_id = entry.jd_id
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    if not jd:
        raise ValueError("JD not found")

    payload = {
        "transcript_file_link": transcript_url,
        "parsed_jd": jd.ai_result,
        "parsed_resume": entry.ai_resume_analysis,
        "rubric_text": jd.rubric_text or "",
        "model_answer_text": jd.model_answer_text or ""
    }

    client = get_ai_client()
    response = await client.post(f"{settings.AI_INTERVIEW_URL}/interview/analyze", json=payload)
    response.raise_for_status()
    ai_result_raw = response.json()

    ai_result = InterviewAIResult(**ai_result_raw)
    ai_result = ai_result.model_dump()

    score_dict = {
        "technical_competency": 25,
        "core_qualifications": 15,
        "communication_skills": 20,
        "problem_solving": 15,
        "domain_knowledge": 15,
        "teamwork_culture_fit": 10,
        "total_score": 100
    }

    score_brk = ai_result["score_breakdown"]

    # Clamp scores and build detailed breakdown
    clamped_total = 0
    for score_brk_key, score_brk_value in list(score_brk.items()):
        if score_brk_key in score_dict:
            clamped = max(0, min(score_brk_value, score_dict[score_brk_key]))
            ai_result["score_breakdown"][score_brk_key] = {
                "obtained_score": clamped,
                "max_score": score_dict[score_brk_key]
            }
            clamped_total += clamped

    # Recompute total AFTER clamping
    ai_result["score_breakdown"]["total_score"] = {
        "obtained_score": clamped_total,
        "max_score": 100
    }

    eval_doc = InterviewEvaluation(
        candidate_id=int(candidate_id),
        jd_id=jd_id,
        ai_interview_result=ai_result,
    )
    db.add(eval_doc)

    await db.execute(
        update(CandidateJobEntry).where(CandidateJobEntry.id == int(candidate_id)).values(interview_status=True)
    )

    await db.commit()
    await db.refresh(eval_doc)

    return {
        "evaluation_id": str(eval_doc.id),
        **ai_result
    }


async def get_interview_evaluations_for_job(db: AsyncSession, job_id: str, page: int = 1, page_size: int = 20) -> dict:
    # Single JOIN query instead of N+1 loop
    where = InterviewEvaluation.jd_id == int(job_id)
    total = (await db.execute(select(func.count()).select_from(InterviewEvaluation).where(where))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(
        select(InterviewEvaluation).where(where).order_by(InterviewEvaluation.id.desc()).offset(offset).limit(page_size)
    )

    evaluations_list = []
    for evaluation in result.scalars().all():
        raw_score_data = evaluation.ai_interview_result.get("score_breakdown", {})
        try:
            score_breakdown_data = ScoreDetailedBreakdown(**raw_score_data)
        except Exception as e:
            logger.warning("Skipping evaluation due to invalid score_breakdown: %s", e)
            continue

        ai_res = evaluation.ai_interview_result
        eval_response_data = {
            "evaluation_id": str(evaluation.id),
            "candidate_name": ai_res.get("candidate_name", "N/A"),
            "position": ai_res.get("position", "N/A"),
            "score_breakdown": score_breakdown_data,
            "strongest_competency": ai_res.get("strongest_competency"),
            "area_for_development": ai_res.get("area_for_development"),
            "overall_impression": ai_res.get("overall_impression"),
            "cultural_fit": ai_res.get("cultural_fit"),
            "available_to_start": ai_res.get("available_to_start"),
            "willing_to_work_weekends": ai_res.get("willing_to_work_weekends"),
            "ai_recommendation": ai_res.get("ai_recommendation"),
            "red_flags": ai_res.get("red_flags", []),
            "notes": ai_res.get("notes")
        }
        evaluations_list.append(InterviewEvaluationResponse(**eval_response_data))

    return {
        "items": evaluations_list,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


async def get_interview_evaluation_for_candidate(db: AsyncSession, candidate_id: str) -> InterviewDetailedAIResult:
    result = await db.execute(
        select(InterviewEvaluation).where(InterviewEvaluation.candidate_id == int(candidate_id))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise ValueError("Interview not found")
    return evaluation.ai_interview_result
