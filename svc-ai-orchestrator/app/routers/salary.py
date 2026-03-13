"""Salary estimation AI endpoint."""
import logging
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user
from app.graphs.salary_estimate import salary_estimate_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class SalaryEstimateRequest(BaseModel):
    job_title: str
    location: Optional[str] = None
    country: Optional[str] = None
    seniority: Optional[str] = None
    department: Optional[str] = None

class SalaryEstimateResponse(BaseModel):
    currency: str
    p25: float
    p50: float
    p75: float
    confidence: str
    disclaimer: str
    estimated_at: str
    execution_id: Optional[str] = None

@router.post("/estimate", response_model=SalaryEstimateResponse)
async def estimate_salary_endpoint(
    req: SalaryEstimateRequest,
    user=Depends(get_current_user),
):
    """Estimate salary range for a job title and location."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(403, "Insufficient permissions")

    user_id = str(user["sub"])
    execution_id = await create_execution_log(
        workflow_type="salary_estimate",
        user_id=user_id,
        input_summary=f"Title: {req.job_title}, Location: {req.location or 'N/A'}",
    )

    start = time.time()
    result = await salary_estimate_graph.ainvoke({
        "job_title": req.job_title,
        "location": req.location,
        "country": req.country,
        "seniority": req.seniority,
        "department": req.department,
        "execution_id": execution_id,
    })
    duration = int((time.time() - start) * 1000)

    if result.get("error"):
        await complete_execution_log(execution_id, status="failed", error=result["error"], total_duration_ms=duration)
        raise HTTPException(500, result["error"])

    await complete_execution_log(execution_id, status="completed", total_duration_ms=duration)

    est = result["estimate"]
    return SalaryEstimateResponse(
        currency=est.get("currency", "USD"),
        p25=float(est.get("p25", 0)),
        p50=float(est.get("p50", 0)),
        p75=float(est.get("p75", 0)),
        confidence=est.get("confidence", "medium"),
        disclaimer=est.get("disclaimer", "AI-estimated. Actual salaries may vary."),
        estimated_at=datetime.now(timezone.utc).isoformat(),
        execution_id=execution_id,
    )
