"""Router: GET /orchestrator/executions — Execution log viewer."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.postgres import get_db
from app.db.models import ExecutionLog, NodeExecution
from app.schemas.execution import (
    ExecutionLogResponse,
    ExecutionDetailResponse,
    NodeExecutionResponse,
    PaginatedExecutionsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PaginatedExecutionsResponse)
async def list_executions(
    workflow_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List execution logs with optional filters and pagination."""
    user_id = str(user["sub"])
    user_role = user.get("role", "")

    # Build query
    query = select(ExecutionLog)
    count_query = select(func.count()).select_from(ExecutionLog)

    # Non-admin users can only see their own executions
    if user_role != "admin":
        query = query.where(ExecutionLog.user_id == user_id)
        count_query = count_query.where(ExecutionLog.user_id == user_id)

    if workflow_type:
        query = query.where(ExecutionLog.workflow_type == workflow_type)
        count_query = count_query.where(ExecutionLog.workflow_type == workflow_type)

    if status:
        query = query.where(ExecutionLog.status == status)
        count_query = count_query.where(ExecutionLog.status == status)

    total = (await db.execute(count_query)).scalar_one()
    total_pages = (total + page_size - 1) // page_size

    results = (await db.execute(
        query.order_by(desc(ExecutionLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return PaginatedExecutionsResponse(
        items=[ExecutionLogResponse.model_validate(r) for r in results],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{execution_id}", response_model=ExecutionDetailResponse)
async def get_execution_detail(
    execution_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed execution log with node execution timeline."""
    user_id = str(user["sub"])
    user_role = user.get("role", "")

    query = select(ExecutionLog).where(ExecutionLog.execution_id == execution_id)
    if user_role != "admin":
        query = query.where(ExecutionLog.user_id == user_id)

    result = (await db.execute(query)).scalar_one_or_none()
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Execution not found")

    # Get node executions
    nodes = (await db.execute(
        select(NodeExecution)
        .where(NodeExecution.execution_id == execution_id)
        .order_by(NodeExecution.created_at)
    )).scalars().all()

    response = ExecutionDetailResponse.model_validate(result)
    response.nodes = [NodeExecutionResponse.model_validate(n) for n in nodes]
    return response


@router.get("/stats/summary")
async def execution_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get execution statistics summary."""
    user_id = str(user["sub"])
    user_role = user.get("role", "")

    base_filter = []
    if user_role != "admin":
        base_filter.append(ExecutionLog.user_id == user_id)

    # Total executions
    total = (await db.execute(
        select(func.count()).select_from(ExecutionLog).where(*base_filter)
    )).scalar_one()

    # By status
    completed = (await db.execute(
        select(func.count()).select_from(ExecutionLog)
        .where(*base_filter, ExecutionLog.status == "completed")
    )).scalar_one()

    failed = (await db.execute(
        select(func.count()).select_from(ExecutionLog)
        .where(*base_filter, ExecutionLog.status == "failed")
    )).scalar_one()

    # Average duration
    avg_duration = (await db.execute(
        select(func.avg(ExecutionLog.total_duration_ms))
        .where(*base_filter, ExecutionLog.status == "completed")
    )).scalar_one()

    # By workflow type
    type_counts = {}
    for wtype in ["hiring_agent", "resume_scoring", "interview_eval", "rag"]:
        count = (await db.execute(
            select(func.count()).select_from(ExecutionLog)
            .where(*base_filter, ExecutionLog.workflow_type == wtype)
        )).scalar_one()
        type_counts[wtype] = count

    return {
        "total": total,
        "completed": completed,
        "failed": failed,
        "success_rate": round(completed / total * 100, 1) if total > 0 else 0,
        "avg_duration_ms": int(avg_duration) if avg_duration else 0,
        "by_workflow": type_counts,
    }
