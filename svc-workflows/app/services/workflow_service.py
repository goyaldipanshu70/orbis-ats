import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, desc
from app.db.models import Workflow, WorkflowRun

logger = logging.getLogger("svc-workflows")


async def create_workflow(
    db: AsyncSession,
    name: str,
    description: str,
    definition_json: dict,
    trigger_type: str,
    trigger_config: dict,
    created_by: str,
) -> Workflow:
    workflow = Workflow(
        name=name,
        description=description,
        definition_json=definition_json or {"nodes": [], "edges": []},
        status="draft",
        trigger_type=trigger_type,
        trigger_config=trigger_config,
        created_by=created_by,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


async def list_workflows(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    created_by: Optional[str] = None,
) -> dict:
    query = select(Workflow).where(Workflow.deleted_at.is_(None))

    if status:
        query = query.where(Workflow.status == status)
    if search:
        query = query.where(Workflow.name.ilike(f"%{search}%"))
    if created_by:
        query = query.where(Workflow.created_by == created_by)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(Workflow.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    workflows = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    # Batch-load run counts and last_run_at to avoid N+1 queries
    workflow_ids = [w.id for w in workflows]
    run_counts = {}
    last_run_dates = {}
    if workflow_ids:
        count_result = await db.execute(
            select(WorkflowRun.workflow_id, func.count(WorkflowRun.id))
            .where(WorkflowRun.workflow_id.in_(workflow_ids))
            .group_by(WorkflowRun.workflow_id)
        )
        for wid, cnt in count_result.all():
            run_counts[wid] = cnt

        last_run_result = await db.execute(
            select(WorkflowRun.workflow_id, func.max(WorkflowRun.created_at))
            .where(WorkflowRun.workflow_id.in_(workflow_ids))
            .group_by(WorkflowRun.workflow_id)
        )
        for wid, last_at in last_run_result.all():
            last_run_dates[wid] = last_at

    items = []
    for w in workflows:
        last_run = last_run_dates.get(w.id)
        items.append({
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "definition_json": w.definition_json,
            "status": w.status,
            "trigger_type": w.trigger_type,
            "trigger_config": w.trigger_config,
            "created_by": w.created_by,
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "runs_count": run_counts.get(w.id, 0),
            "last_run_at": last_run.isoformat() if last_run else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


async def get_workflow(db: AsyncSession, workflow_id: int) -> Optional[Workflow]:
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_workflow_dict(db: AsyncSession, workflow_id: int) -> Optional[dict]:
    workflow = await get_workflow(db, workflow_id)
    if not workflow:
        return None
    return await _workflow_to_dict(db, workflow)


async def update_workflow(
    db: AsyncSession,
    workflow_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    definition_json: Optional[dict] = None,
    status: Optional[str] = None,
    trigger_type: Optional[str] = None,
    trigger_config: Optional[dict] = None,
) -> Optional[Workflow]:
    workflow = await get_workflow(db, workflow_id)
    if not workflow:
        return None

    if name is not None:
        workflow.name = name
    if description is not None:
        workflow.description = description
    if definition_json is not None:
        workflow.definition_json = definition_json
    if status is not None:
        workflow.status = status
    if trigger_type is not None:
        workflow.trigger_type = trigger_type
    if trigger_config is not None:
        workflow.trigger_config = trigger_config

    workflow.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(workflow)
    return workflow


async def delete_workflow(db: AsyncSession, workflow_id: int) -> bool:
    workflow = await get_workflow(db, workflow_id)
    if not workflow:
        return False
    workflow.deleted_at = datetime.utcnow()
    await db.commit()
    return True


async def duplicate_workflow(db: AsyncSession, workflow_id: int, created_by: str) -> Optional[Workflow]:
    original = await get_workflow(db, workflow_id)
    if not original:
        return None

    copy = Workflow(
        name=f"{original.name} (Copy)",
        description=original.description,
        definition_json=original.definition_json,
        status="draft",
        trigger_type=original.trigger_type,
        trigger_config=original.trigger_config,
        created_by=created_by,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy


async def _workflow_to_dict(db: AsyncSession, workflow: Workflow) -> dict:
    # Count runs and get last run date
    run_count_result = await db.execute(
        select(func.count()).where(WorkflowRun.workflow_id == workflow.id)
    )
    runs_count = run_count_result.scalar() or 0

    last_run_result = await db.execute(
        select(func.max(WorkflowRun.created_at)).where(WorkflowRun.workflow_id == workflow.id)
    )
    last_run_at = last_run_result.scalar()

    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "definition_json": workflow.definition_json,
        "status": workflow.status,
        "trigger_type": workflow.trigger_type,
        "trigger_config": workflow.trigger_config,
        "created_by": workflow.created_by,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "runs_count": runs_count,
        "last_run_at": last_run_at.isoformat() if last_run_at else None,
    }
