"""Router: POST /orchestrator/rag/query — RAG Workflow LangGraph execution."""
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.config import settings
from app.graphs.rag_workflow import rag_workflow_graph
from app.shared.graph_logging import create_execution_log, complete_execution_log

logger = logging.getLogger(__name__)
router = APIRouter()


class RAGQueryRequest(BaseModel):
    query: str
    history: Optional[list[dict]] = None
    department_ids: Optional[list[int]] = None
    top_k: int = 5
    provider: Optional[str] = None


class RAGQueryResponse(BaseModel):
    answer: Optional[str] = None
    sources: Optional[list[dict]] = None
    execution_id: str
    error: Optional[str] = None


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(req: RAGQueryRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["sub"])
    provider = req.provider or settings.RAG_PROVIDER or settings.DEFAULT_LLM_PROVIDER

    execution_id = await create_execution_log(
        workflow_type="rag",
        user_id=user_id,
        provider=provider,
        input_summary=req.query[:500],
    )

    start = time.time()

    try:
        result = await rag_workflow_graph.ainvoke({
            "execution_id": execution_id,
            "query": req.query,
            "query_embedding": None,
            "retrieved_chunks": None,
            "reranked_chunks": None,
            "context_text": "",
            "answer": None,
            "sources": None,
            "history": req.history,
            "department_ids": req.department_ids,
            "top_k": req.top_k,
            "error": None,
            "provider": provider,
        })

        duration = int((time.time() - start) * 1000)

        status = "completed" if not result.get("error") else "failed"
        await complete_execution_log(
            execution_id=execution_id,
            status=status,
            total_duration_ms=duration,
            output_summary=(result.get("answer") or "")[:500],
        )

        return RAGQueryResponse(
            answer=result.get("answer"),
            sources=result.get("sources"),
            execution_id=execution_id,
            error=result.get("error"),
        )

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        logger.exception("RAG workflow graph failed")
        await complete_execution_log(
            execution_id=execution_id,
            status="failed",
            total_duration_ms=duration,
            error=str(e),
        )
        return RAGQueryResponse(execution_id=execution_id, error=str(e))
