"""Router: POST /orchestrator/agent/query — Hiring Agent LangGraph execution."""
import time
import uuid
import logging
from typing import Optional, Union

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.hiring_agent import hiring_agent_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class AgentQueryRequest(BaseModel):
    query: str
    conversation_history: Optional[list[dict]] = None
    web_search_enabled: bool = False
    file_context: Optional[str] = None
    provider: Optional[str] = None
    conversation_id: Optional[str] = None


class AgentQueryResponse(BaseModel):
    answer: str
    data: Optional[Union[dict, list]] = None
    data_type: Optional[str] = None
    actions: Optional[list[dict]] = None
    execution_id: str
    iteration_count: int = 0
    provider: str = ""


@router.post("/query", response_model=AgentQueryResponse)
async def query_agent(req: AgentQueryRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["sub"])
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("email", "User")
    user_role = user.get("role", "recruiter")
    provider = req.provider or settings.HIRING_AGENT_PROVIDER or settings.DEFAULT_LLM_PROVIDER

    # Create execution log
    execution_id = await create_execution_log(
        workflow_type="hiring_agent",
        user_id=user_id,
        provider=provider,
        model=settings.OPENAI_MODEL if provider == "openai" else settings.ANTHROPIC_MODEL,
        input_summary=req.query[:500],
    )

    start = time.time()

    # Build initial messages from conversation history
    messages = []
    if req.conversation_history:
        for msg in req.conversation_history[-20:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append(HumanMessage(content=content) if role == "user" else type("AIMsg", (), {"content": content, "type": "ai"})())

    # Add current query
    user_content = req.query
    if req.file_context:
        user_content = f"{req.query}\n\n---\n**Attached file content:**\n{req.file_context}"
    messages.append(HumanMessage(content=user_content))

    try:
        # Run the LangGraph
        result = await hiring_agent_graph.ainvoke({
            "messages": messages,
            "execution_id": execution_id,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role,
            "conversation_id": req.conversation_id,
            "db_context": "",
            "tools_called": [],
            "iteration_count": 0,
            "max_iterations": 5,
            "final_answer": None,
            "structured_data": None,
            "web_search_enabled": req.web_search_enabled,
            "file_context": req.file_context,
            "provider": provider,
            "error": None,
        })

        duration = int((time.time() - start) * 1000)

        # Complete execution log
        await complete_execution_log(
            execution_id=execution_id,
            status="completed",
            output_summary=(result.get("final_answer") or "")[:500],
            total_duration_ms=duration,
            iteration_count=result.get("iteration_count", 0),
            node_count=result.get("iteration_count", 0) + 2,  # context + planner iterations + finalizer
        )

        return AgentQueryResponse(
            answer=result.get("final_answer") or "",
            data=result.get("structured_data"),
            data_type=result.get("structured_data", {}).get("type") if result.get("structured_data") else None,
            actions=result.get("tools_called") if result.get("tools_called") else None,
            execution_id=execution_id,
            iteration_count=result.get("iteration_count", 0),
            provider=provider,
        )

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        logger.exception("Hiring agent graph execution failed")
        await complete_execution_log(
            execution_id=execution_id,
            status="failed",
            total_duration_ms=duration,
            error=str(e),
        )
        return AgentQueryResponse(
            answer=f"I encountered an error processing your request. Please try again.",
            execution_id=execution_id,
            provider=provider,
        )
