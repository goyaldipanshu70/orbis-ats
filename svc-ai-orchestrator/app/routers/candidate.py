"""Candidate AI endpoints — fit summary, ranking, skills gap."""
import logging
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user
from app.db.postgres import recruiting_db_session
from app.graphs.candidate_fit import candidate_fit_graph
from app.graphs.candidate_ranking import candidate_ranking_graph
from app.graphs.skills_gap import skills_gap_graph
from app.nodes.candidate.context_gatherer import gather_candidate_context
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class FitSummaryRequest(BaseModel):
    candidate_id: int
    jd_id: int


class StrengthItem(BaseModel):
    point: str
    evidence: str


class FitSummaryResponse(BaseModel):
    rating: str
    strengths: list[StrengthItem]
    concerns: list[str]
    recommendation: str
    generated_at: str
    execution_id: Optional[str] = None


class RankRequest(BaseModel):
    jd_id: int


class RankingItem(BaseModel):
    candidate_id: int
    candidate_name: str
    rank: int
    composite: float
    breakdown: dict
    weights: dict


class RankResponse(BaseModel):
    rankings: list[RankingItem]
    ranked_at: str
    execution_id: Optional[str] = None


class SkillsGapRequest(BaseModel):
    candidate_id: int
    jd_id: int


class MatchedSkill(BaseModel):
    required_skill: str
    candidate_skill: str
    confidence: float


class SkillsGapResponse(BaseModel):
    match_pct: int
    matched: list[MatchedSkill]
    missing: list[str]
    bonus: list[str]
    analyzed_at: str
    execution_id: Optional[str] = None


@router.post("/fit-summary", response_model=FitSummaryResponse)
async def fit_summary_endpoint(
    req: FitSummaryRequest,
    user=Depends(get_current_user),
):
    """Generate a candidate fit summary for a specific job."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="candidate_fit",
        user_id=user_id,
        input_summary=f"Candidate {req.candidate_id} for Job {req.jd_id}",
    )

    async with recruiting_db_session() as db:
        context = await gather_candidate_context(db, req.candidate_id, req.jd_id)

    if context.get("error"):
        await complete_execution_log(execution_id, status="failed", error=context["error"])
        raise HTTPException(404, context["error"])

    context["execution_id"] = execution_id
    start = time.time()
    result = await candidate_fit_graph.ainvoke(context)
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    summary = result["fit_summary"]
    return FitSummaryResponse(
        rating=summary.get("rating", "Moderate"),
        strengths=[StrengthItem(**s) for s in summary.get("strengths", [])],
        concerns=summary.get("concerns", []),
        recommendation=summary.get("recommendation", ""),
        generated_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )


@router.post("/rank", response_model=RankResponse)
async def rank_candidates_endpoint(
    req: RankRequest,
    user=Depends(get_current_user),
):
    """Rank all candidates for a job."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="candidate_ranking",
        user_id=user_id,
        input_summary=f"Job {req.jd_id}",
    )

    start = time.time()
    result = await candidate_ranking_graph.ainvoke({
        "jd_id": req.jd_id,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    return RankResponse(
        rankings=[RankingItem(**r) for r in result.get("rankings", [])],
        ranked_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )


@router.post("/skills-gap", response_model=SkillsGapResponse)
async def skills_gap_endpoint(
    req: SkillsGapRequest,
    user=Depends(get_current_user),
):
    """Analyze skills gap between candidate and job requirements."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="skills_gap",
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
    required_skills = job.get("core_skills", []) + job.get("preferred_skills", [])
    candidate_skills = (
        resume.get("highlighted_skills", []) +
        resume.get("metadata", {}).get("skills", [])
    )

    start = time.time()
    result = await skills_gap_graph.ainvoke({
        "candidate_id": req.candidate_id,
        "jd_id": req.jd_id,
        "required_skills": required_skills,
        "candidate_skills": candidate_skills,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    gap = result["skills_gap"]
    return SkillsGapResponse(
        match_pct=gap["match_pct"],
        matched=[MatchedSkill(**m) for m in gap["matched"]],
        missing=gap["missing"],
        bonus=gap["bonus"],
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )
