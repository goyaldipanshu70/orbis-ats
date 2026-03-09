"""Router: POST /orchestrator/resume/score — Resume Scoring LangGraph execution."""
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.resume_scoring import resume_scoring_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class ResumeScoringRequest(BaseModel):
    resume_url: str
    parsed_jd: dict = {}
    rubric_text: str = ""
    provider: Optional[str] = None


class ResumeScoringResponse(BaseModel):
    metadata: Optional[dict] = None
    category_scores: Optional[dict] = None
    ai_recommendation: Optional[str] = None
    highlighted_skills: Optional[list] = None
    red_flags: Optional[list] = None
    notes: Optional[str] = None
    execution_id: str
    error: Optional[str] = None


@router.post("/score", response_model=ResumeScoringResponse)
async def score_resume(req: ResumeScoringRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["sub"])
    provider = req.provider or settings.RESUME_SCORING_PROVIDER or settings.DEFAULT_LLM_PROVIDER

    execution_id = await create_execution_log(
        workflow_type="resume_scoring",
        user_id=user_id,
        provider=provider,
        input_summary=f"Resume: {req.resume_url}",
    )

    start = time.time()

    try:
        result = await resume_scoring_graph.ainvoke({
            "execution_id": execution_id,
            "resume_url": req.resume_url,
            "resume_text": None,
            "parsed_jd": req.parsed_jd,
            "rubric_text": req.rubric_text,
            "metadata": None,
            "category_scores": None,
            "ai_recommendation": None,
            "highlighted_skills": None,
            "red_flags": None,
            "notes": None,
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

        return ResumeScoringResponse(
            metadata=result.get("metadata"),
            category_scores=result.get("category_scores"),
            ai_recommendation=result.get("ai_recommendation"),
            highlighted_skills=result.get("highlighted_skills"),
            red_flags=result.get("red_flags"),
            notes=result.get("notes"),
            execution_id=execution_id,
            error=result.get("error"),
        )

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        logger.exception("Resume scoring graph failed")
        await complete_execution_log(
            execution_id=execution_id,
            status="failed",
            total_duration_ms=duration,
            error=str(e),
        )
        return ResumeScoringResponse(execution_id=execution_id, error=str(e))
