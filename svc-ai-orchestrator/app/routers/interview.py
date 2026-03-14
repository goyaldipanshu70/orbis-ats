"""Router: POST /orchestrator/interview/evaluate — Interview Evaluation LangGraph execution."""
import time
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.interview_eval import interview_eval_graph
from app.graphs.interview_questions import interview_questions_graph
from app.nodes.candidate.context_gatherer import gather_candidate_context
from app.db.postgres import recruiting_db_session
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class InterviewEvalRequest(BaseModel):
    transcript_url: str
    parsed_jd: dict = {}
    parsed_resume: dict = {}
    rubric_text: str = ""
    model_answer_text: str = ""
    provider: Optional[str] = None


class InterviewEvalResponse(BaseModel):
    score_breakdown: Optional[dict] = None
    ai_recommendation: Optional[str] = None
    red_flags: Optional[list] = None
    overall_impression: Optional[str] = None
    execution_id: str
    error: Optional[str] = None


@router.post("/evaluate", response_model=InterviewEvalResponse)
async def evaluate_interview(req: InterviewEvalRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["sub"])
    provider = req.provider or settings.INTERVIEW_EVAL_PROVIDER or settings.DEFAULT_LLM_PROVIDER

    execution_id = await create_execution_log(
        workflow_type="interview_eval",
        user_id=user_id,
        provider=provider,
        input_summary=f"Transcript: {req.transcript_url}",
    )

    start = time.time()

    try:
        result = await interview_eval_graph.ainvoke({
            "execution_id": execution_id,
            "transcript_url": req.transcript_url,
            "transcript_text": None,
            "parsed_jd": req.parsed_jd,
            "parsed_resume": req.parsed_resume,
            "rubric_text": req.rubric_text,
            "model_answer_text": req.model_answer_text,
            "score_breakdown": None,
            "ai_recommendation": None,
            "red_flags": None,
            "overall_impression": None,
            "retry_count": 0,
            "error": None,
            "provider": provider,
        })

        duration = int((time.time() - start) * 1000)

        status = "completed" if not result.get("error") else "failed"
        await complete_execution_log(
            execution_id=execution_id,
            status=status,
            total_duration_ms=duration,
            error=result.get("error"),
        )

        return InterviewEvalResponse(
            score_breakdown=result.get("score_breakdown"),
            ai_recommendation=result.get("ai_recommendation"),
            red_flags=result.get("red_flags"),
            overall_impression=result.get("overall_impression"),
            execution_id=execution_id,
            error=result.get("error"),
        )

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        logger.exception("Interview eval graph failed")
        await complete_execution_log(
            execution_id=execution_id,
            status="failed",
            total_duration_ms=duration,
            error=str(e),
        )
        return InterviewEvalResponse(execution_id=execution_id, error=str(e))


class InterviewQuestionsRequest(BaseModel):
    candidate_id: int
    jd_id: int
    interview_type: Optional[str] = "general"

class QuestionItem(BaseModel):
    question: str
    type: str
    rationale: str

class InterviewQuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    generated_at: str
    execution_id: Optional[str] = None

@router.post("/questions", response_model=InterviewQuestionsResponse)
async def generate_interview_questions_endpoint(
    req: InterviewQuestionsRequest,
    user=Depends(get_current_user),
):
    """Generate tailored interview questions for a candidate-job pair."""
    role = user.get("role")
    if role not in ("admin", "hr", "hiring_manager", "interviewer"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="interview_questions",
        user_id=user_id,
        input_summary=f"Candidate {req.candidate_id} for Job {req.jd_id}",
    )

    async with recruiting_db_session() as db:
        context = await gather_candidate_context(db, req.candidate_id, req.jd_id)

    if context.get("error"):
        await complete_execution_log(execution_id, status="failed", error=context["error"])
        raise HTTPException(404, context["error"])

    job = context.get("job_context", {})
    resume = context.get("resume_analysis", {})
    candidate_ctx = context.get("candidate_context", {})
    candidate_ctx["summary"] = resume.get("metadata", {}).get("summary", "")

    # Get missing skills for targeted questions
    skills_gap = []
    required = job.get("core_skills", [])
    candidate_skills = resume.get("highlighted_skills", [])
    if required and candidate_skills:
        cand_lower = {s.lower() for s in candidate_skills}
        skills_gap = [s for s in required if s.lower() not in cand_lower]

    start = time.time()
    result = await interview_questions_graph.ainvoke({
        "candidate_id": req.candidate_id,
        "jd_id": req.jd_id,
        "interview_type": req.interview_type,
        "job_context": job,
        "candidate_context": candidate_ctx,
        "skills_gap": skills_gap,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    return InterviewQuestionsResponse(
        questions=[QuestionItem(**q) for q in result.get("questions", [])],
        generated_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )
