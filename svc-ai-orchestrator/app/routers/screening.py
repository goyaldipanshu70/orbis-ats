"""Screening AI endpoints — response scoring."""
import logging
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user
from app.graphs.screening_scoring import screening_scoring_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class ScreeningScoringRequest(BaseModel):
    candidate_id: int
    jd_id: int

class QuestionScore(BaseModel):
    question_id: int
    question: str
    score: int
    reasoning: str

class ScreeningScoringResponse(BaseModel):
    question_scores: list[QuestionScore]
    overall_score: float
    scored_at: str
    execution_id: Optional[str] = None

@router.post("/score", response_model=ScreeningScoringResponse)
async def score_screening_endpoint(
    req: ScreeningScoringRequest,
    user=Depends(get_current_user),
):
    """Score screening responses for a candidate-job pair."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="screening_scoring",
        user_id=user_id,
        input_summary=f"Candidate {req.candidate_id} for Job {req.jd_id}",
    )

    start = time.time()
    result = await screening_scoring_graph.ainvoke({
        "candidate_id": req.candidate_id,
        "jd_id": req.jd_id,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    return ScreeningScoringResponse(
        question_scores=[QuestionScore(**qs) for qs in result.get("question_scores", [])],
        overall_score=result.get("overall_score", 0.0),
        scored_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )
