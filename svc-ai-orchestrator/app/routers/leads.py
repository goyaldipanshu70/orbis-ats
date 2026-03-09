"""Router: POST /orchestrator/leads/discover — Lead Generation LangGraph execution."""
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.lead_gen import lead_gen_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class LeadDiscoverRequest(BaseModel):
    role: str
    skills: list[str] = []
    location: Optional[str] = None
    experience_min: Optional[int] = None
    platforms: list[str] = ["linkedin", "github"]
    jd_id: Optional[int] = None
    jd_context: Optional[str] = None
    provider: Optional[str] = None
    max_results: int = 20


class LeadDiscoverResponse(BaseModel):
    leads: list[dict]
    platforms_searched: list[str]
    total_found: int
    execution_id: str
    provider: str


@router.post("/discover", response_model=LeadDiscoverResponse)
async def discover_leads(req: LeadDiscoverRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["sub"])
    user_role = user.get("role", "recruiter")
    provider = req.provider or settings.LEAD_GEN_PROVIDER or settings.DEFAULT_LLM_PROVIDER

    # Create execution log
    execution_id = await create_execution_log(
        workflow_type="lead_generation",
        user_id=user_id,
        provider=provider,
        model=settings.OPENAI_MODEL if provider == "openai" else settings.ANTHROPIC_MODEL,
        input_summary=f"Lead search: {req.role} | skills={req.skills} | location={req.location}",
    )

    start = time.time()

    search_criteria = {
        "role": req.role,
        "skills": req.skills,
        "location": req.location or "",
        "experience_min": req.experience_min,
        "platforms": req.platforms,
        "jd_context": req.jd_context or "",
    }

    try:
        result = await lead_gen_graph.ainvoke({
            "messages": [HumanMessage(content=f"Find candidates for: {req.role}")],
            "execution_id": execution_id,
            "user_id": user_id,
            "user_role": user_role,
            "provider": provider,
            "search_criteria": search_criteria,
            "jd_id": req.jd_id,
            "raw_search_results": [],
            "extracted_profiles": [],
            "scored_leads": [],
            "iteration_count": 0,
            "max_iterations": 1,
            "platforms_searched": [],
            "error": None,
        })

        duration = int((time.time() - start) * 1000)

        scored_leads = result.get("scored_leads", [])
        # Limit to max_results
        leads = scored_leads[:req.max_results]
        platforms_searched = result.get("platforms_searched", [])

        await complete_execution_log(
            execution_id=execution_id,
            status="completed",
            output_summary=f"Found {len(leads)} leads across {', '.join(platforms_searched)}",
            total_duration_ms=duration,
            iteration_count=result.get("iteration_count", 0),
            node_count=4,
        )

        return LeadDiscoverResponse(
            leads=leads,
            platforms_searched=platforms_searched,
            total_found=len(leads),
            execution_id=execution_id,
            provider=provider,
        )

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        logger.exception("Lead generation graph execution failed")
        await complete_execution_log(
            execution_id=execution_id,
            status="failed",
            total_duration_ms=duration,
            error=str(e),
        )
        return LeadDiscoverResponse(
            leads=[],
            platforms_searched=[],
            total_found=0,
            execution_id=execution_id,
            provider=provider,
        )
