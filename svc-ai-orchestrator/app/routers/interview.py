"""Router: POST /orchestrator/interview/evaluate — Interview Evaluation LangGraph execution."""
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.interview_eval import interview_eval_graph
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
