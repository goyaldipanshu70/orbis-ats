"""JD generation and bias check endpoints."""
import logging
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user
from app.graphs.jd_generation import jd_generation_graph
from app.graphs.jd_bias_check import jd_bias_check_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class JDGenerateRequest(BaseModel):
    job_title: str
    department: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
    additional_context: Optional[str] = None

class JDGenerateResponse(BaseModel):
    summary: str
    responsibilities: list[str]
    requirements: list[str]
    qualifications: list[str]
    benefits: list[str]
    generated_at: str
    execution_id: Optional[str] = None


class BiasCheckRequest(BaseModel):
    text: str

class BiasFlag(BaseModel):
    phrase: str
    type: str
    suggestion: str
    start: int = 0
    end: int = 0

class BiasCheckResponse(BaseModel):
    score: int
    flags: list[BiasFlag]
    checked_at: str
    execution_id: Optional[str] = None


@router.post("/generate", response_model=JDGenerateResponse)
async def generate_jd_endpoint(
    req: JDGenerateRequest,
    user=Depends(get_current_user),
):
    """Generate a job description from a title and optional context."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="jd_generation",
        user_id=user_id,
        input_summary=f"Title: {req.job_title}",
    )

    start = time.time()
    result = await jd_generation_graph.ainvoke({
        "job_title": req.job_title,
        "department": req.department,
        "seniority": req.seniority,
        "location": req.location,
        "additional_context": req.additional_context,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    jd = result["generated_jd"]
    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    return JDGenerateResponse(
        summary=jd.get("summary", ""),
        responsibilities=jd.get("responsibilities", []),
        requirements=jd.get("requirements", []),
        qualifications=jd.get("qualifications", []),
        benefits=jd.get("benefits", []),
        generated_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )


@router.post("/bias-check", response_model=BiasCheckResponse)
async def bias_check_endpoint(
    req: BiasCheckRequest,
    user=Depends(get_current_user),
):
    """Check job description text for biased language."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="jd_bias_check",
        user_id=user_id,
        input_summary=f"Text length: {len(req.text)}",
    )

    start = time.time()
    result = await jd_bias_check_graph.ainvoke({
        "text": req.text,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    return BiasCheckResponse(
        score=result.get("score", 100),
        flags=[BiasFlag(**f) for f in result.get("flags", [])],
        checked_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )
