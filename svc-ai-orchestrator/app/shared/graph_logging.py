"""Node execution logger — records each node's execution to the NodeExecution table."""
import json
import logging
import time
import uuid
from datetime import datetime
from functools import wraps
from typing import Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ExecutionLog, NodeExecution
from app.db.postgres import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _truncate(data, max_len: int = 2000) -> Optional[str]:
    if data is None:
        return None
    try:
        text = json.dumps(data, default=str)
    except (TypeError, ValueError):
        text = str(data)
    return text[:max_len] if len(text) > max_len else text


async def create_execution_log(
    workflow_type: str,
    user_id: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    input_summary: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> str:
    """Create a new execution log entry and return its execution_id."""
    execution_id = uuid.uuid4().hex[:16]
    async with AsyncSessionLocal() as db:
        log = ExecutionLog(
            workflow_type=workflow_type,
            execution_id=execution_id,
            user_id=user_id,
            status="running",
            provider=provider,
            model=model,
            input_summary=_truncate(input_summary, 500),
            metadata_=metadata,
        )
        db.add(log)
        await db.commit()
    return execution_id


async def complete_execution_log(
    execution_id: str,
    status: str = "completed",
    output_summary: Optional[str] = None,
    total_tokens: Optional[int] = None,
    total_duration_ms: Optional[int] = None,
    node_count: int = 0,
    iteration_count: int = 0,
    error: Optional[str] = None,
):
    """Mark an execution log as completed/failed."""
    async with AsyncSessionLocal() as db:
        from sqlalchemy import update
        await db.execute(
            update(ExecutionLog)
            .where(ExecutionLog.execution_id == execution_id)
            .values(
                status=status,
                output_summary=_truncate(output_summary, 500),
                total_tokens=total_tokens,
                total_duration_ms=total_duration_ms,
                node_count=node_count,
                iteration_count=iteration_count,
                error=error,
                completed_at=datetime.utcnow(),
            )
        )
        await db.commit()


async def log_node_execution(
    execution_id: str,
    node_name: str,
    node_type: Optional[str] = None,
    status: str = "completed",
    input_data: Optional[dict] = None,
    output_data: Optional[dict] = None,
    duration_ms: Optional[int] = None,
    tokens_used: Optional[int] = None,
    retry_count: int = 0,
    error: Optional[str] = None,
):
    """Log a single node execution."""
    async with AsyncSessionLocal() as db:
        node = NodeExecution(
            execution_id=execution_id,
            node_name=node_name,
            node_type=node_type,
            status=status,
            input_data=input_data,
            output_data=output_data,
            duration_ms=duration_ms,
            tokens_used=tokens_used,
            retry_count=retry_count,
            error=error,
        )
        db.add(node)
        await db.commit()


def logged_node(node_name: str, node_type: str = "data_load"):
    """Decorator that wraps a graph node function with execution logging."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(state: dict) -> dict:
            execution_id = state.get("execution_id", "unknown")
            start = time.time()
            try:
                result = await func(state)
                duration = int((time.time() - start) * 1000)
                await log_node_execution(
                    execution_id=execution_id,
                    node_name=node_name,
                    node_type=node_type,
                    status="completed",
                    duration_ms=duration,
                )
                return result
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                await log_node_execution(
                    execution_id=execution_id,
                    node_name=node_name,
                    node_type=node_type,
                    status="failed",
                    duration_ms=duration,
                    error=str(e),
                )
                raise
        return wrapper
    return decorator
