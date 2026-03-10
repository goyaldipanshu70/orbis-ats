import logging
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
import httpx
from app.db.postgres import get_db, AsyncSessionLocal
from app.db.models import WorkflowRun, WorkflowNodeRun, ScrapedLead
from app.core.security import require_employee
from app.core.config import settings
from app.services import workflow_service
from app.services.execution_engine import ExecutionEngine

logger = logging.getLogger("svc-workflows")

router = APIRouter()


class RunCreate(BaseModel):
    input_data: Optional[dict] = None


async def _run_workflow_background(workflow_id: int, run_id: int, input_data: dict = None):
    """Background task that executes a workflow run in its own DB session."""
    try:
        async with AsyncSessionLocal() as db:
            workflow = await workflow_service.get_workflow(db, workflow_id)
            if not workflow:
                logger.error("Workflow %d not found for background run", workflow_id)
                return

            result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
            run = result.scalar_one_or_none()
            if not run:
                logger.error("WorkflowRun %d not found", run_id)
                return

            # Attach workflow relationship so the engine can read definition_json
            run.workflow = workflow

            engine = ExecutionEngine(db)
            await engine.execute(workflow, run, input_data)
    except Exception as e:
        logger.exception("Background execution crashed for workflow %d run %d: %s", workflow_id, run_id, e)
        # Mark the run as failed if we can
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
                run = result.scalar_one_or_none()
                if run and run.status in ("pending", "running"):
                    run.status = "failed"
                    run.error_message = f"Background execution crashed: {str(e)[:500]}"
                    run.completed_at = datetime.utcnow()
                    await db.commit()
        except Exception:
            logger.exception("Failed to mark run %d as failed after crash", run_id)


@router.post("/{workflow_id}/run")
async def start_run(
    workflow_id: int,
    body: RunCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Start a workflow run."""
    workflow = await workflow_service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot run workflow with status '{workflow.status}'. Activate it first.",
        )

    # Check concurrent run limit
    active_result = await db.execute(
        select(func.count()).where(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.status.in_(["pending", "running"]),
        )
    )
    active_count = active_result.scalar() or 0
    if active_count >= settings.MAX_CONCURRENT_RUNS:
        raise HTTPException(
            status_code=429,
            detail=f"Workflow already has {active_count} active runs. Max is {settings.MAX_CONCURRENT_RUNS}.",
        )

    run = WorkflowRun(
        workflow_id=workflow_id,
        status="pending",
        trigger_type=workflow.trigger_type or "manual",
        input_data=body.input_data,
        created_at=datetime.utcnow(),
        created_by=str(user["sub"]),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Execute in background so the API responds immediately
    background_tasks.add_task(_run_workflow_background, workflow_id, run.id, body.input_data)

    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "status": run.status,
        "trigger_type": run.trigger_type,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "created_by": run.created_by,
    }


@router.get("/runs")
async def list_all_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List all workflow runs across all workflows."""
    query = select(WorkflowRun)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(WorkflowRun.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    runs = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": [_run_to_dict(r) for r in runs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{workflow_id}/runs")
async def list_runs(
    workflow_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List runs for a workflow."""
    workflow = await workflow_service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    query = select(WorkflowRun).where(WorkflowRun.workflow_id == workflow_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(WorkflowRun.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    runs = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": [_run_to_dict(r) for r in runs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/runs/{run_id}")
async def get_run(
    run_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get run detail with node_runs."""
    result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Fetch node runs
    nr_result = await db.execute(
        select(WorkflowNodeRun)
        .where(WorkflowNodeRun.run_id == run_id)
        .order_by(WorkflowNodeRun.started_at.asc().nulls_last())
    )
    node_runs = nr_result.scalars().all()

    run_dict = _run_to_dict(run)
    run_dict["node_runs"] = [_node_run_to_dict(nr) for nr in node_runs]
    return run_dict


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running workflow."""
    result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel run with status '{run.status}'")

    run.status = "cancelled"
    run.completed_at = datetime.utcnow()
    await db.commit()

    # Also cancel pending node runs
    await db.execute(
        update(WorkflowNodeRun)
        .where(WorkflowNodeRun.run_id == run_id, WorkflowNodeRun.status.in_(["pending", "running"]))
        .values(status="skipped", completed_at=datetime.utcnow())
    )
    await db.commit()

    return {"message": "Run cancelled", "id": run_id}


@router.get("/runs/{run_id}/nodes")
async def get_node_runs(
    run_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get node runs for a workflow run."""
    result = await db.execute(
        select(WorkflowNodeRun)
        .where(WorkflowNodeRun.run_id == run_id)
        .order_by(WorkflowNodeRun.started_at.asc().nulls_last())
    )
    node_runs = result.scalars().all()
    return [_node_run_to_dict(nr) for nr in node_runs]


@router.get("/runs/{run_id}/leads")
async def get_run_leads(
    run_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get scraped leads from a workflow run."""
    query = select(ScrapedLead).where(ScrapedLead.workflow_run_id == run_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(ScrapedLead.score.desc().nulls_last())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    leads = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": [_lead_to_dict(l) for l in leads],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def _run_to_dict(run: WorkflowRun) -> dict:
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "status": run.status,
        "trigger_type": run.trigger_type,
        "input_data": run.input_data,
        "output_data": run.output_data,
        "error_message": run.error_message,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "created_by": run.created_by,
    }


def _node_run_to_dict(nr: WorkflowNodeRun) -> dict:
    return {
        "id": nr.id,
        "run_id": nr.run_id,
        "node_id": nr.node_id,
        "node_type": nr.node_type,
        "status": nr.status,
        "input_data": nr.input_data,
        "output_data": nr.output_data,
        "error_message": nr.error_message,
        "started_at": nr.started_at.isoformat() if nr.started_at else None,
        "completed_at": nr.completed_at.isoformat() if nr.completed_at else None,
        "execution_time_ms": nr.execution_time_ms,
    }


def _lead_to_dict(lead: ScrapedLead) -> dict:
    return {
        "id": lead.id,
        "workflow_run_id": lead.workflow_run_id,
        "name": lead.name,
        "email": lead.email,
        "linkedin_url": lead.linkedin_url,
        "github_url": lead.github_url,
        "portfolio_url": lead.portfolio_url,
        "headline": lead.headline,
        "location": lead.location,
        "skills": lead.skills,
        "experience_years": lead.experience_years,
        "source": lead.source,
        "source_url": lead.source_url,
        "score": lead.score,
        "score_breakdown": lead.score_breakdown,
        "raw_data": lead.raw_data,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
    }


@router.get("/{workflow_id}/stats")
async def get_workflow_stats(
    workflow_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated statistics for a workflow."""
    workflow = await workflow_service.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    base_q = select(WorkflowRun).where(WorkflowRun.workflow_id == workflow_id)

    total = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar() or 0
    completed = (await db.execute(
        select(func.count()).where(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.status == "completed",
        )
    )).scalar() or 0
    failed = (await db.execute(
        select(func.count()).where(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.status == "failed",
        )
    )).scalar() or 0
    completed_with_errors = (await db.execute(
        select(func.count()).where(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.status == "completed_with_errors",
        )
    )).scalar() or 0

    total_leads = (await db.execute(
        select(func.count()).where(
            ScrapedLead.workflow_run_id.in_(
                select(WorkflowRun.id).where(WorkflowRun.workflow_id == workflow_id)
            )
        )
    )).scalar() or 0

    # Average execution time for completed runs
    avg_time_result = await db.execute(
        select(func.avg(
            func.extract("epoch", WorkflowRun.completed_at) -
            func.extract("epoch", WorkflowRun.started_at)
        )).where(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.completed_at.isnot(None),
            WorkflowRun.started_at.isnot(None),
        )
    )
    avg_seconds = avg_time_result.scalar()

    return {
        "total_runs": total,
        "completed": completed,
        "completed_with_errors": completed_with_errors,
        "failed": failed,
        "success_rate": round(completed / total * 100, 1) if total else 0,
        "avg_execution_seconds": round(avg_seconds, 1) if avg_seconds else None,
        "total_leads_found": total_leads,
    }


class AddToTalentPoolRequest(BaseModel):
    lead_ids: List[int]


@router.post("/leads/add-to-talent-pool")
async def add_leads_to_talent_pool(
    body: AddToTalentPoolRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Send selected scraped leads to svc-recruiting talent pool."""
    if not body.lead_ids:
        raise HTTPException(400, "No lead IDs provided")

    result = await db.execute(
        select(ScrapedLead).where(ScrapedLead.id.in_(body.lead_ids))
    )
    leads = result.scalars().all()

    if not leads:
        raise HTTPException(404, "No leads found for given IDs")

    saved = 0
    skipped = 0
    errors = []

    async with httpx.AsyncClient(timeout=30) as client:
        for lead in leads:
            payload = {
                "full_name": lead.name or "Unknown",
                "email": lead.email,
                "linkedin_url": lead.linkedin_url,
                "github_url": lead.github_url,
                "portfolio_url": lead.portfolio_url,
                "headline": lead.headline,
                "location": lead.location,
                "skills": lead.skills,
                "experience_years": lead.experience_years,
                "source": lead.source or "workflow",
                "score": lead.score,
                "score_breakdown": lead.score_breakdown,
            }
            try:
                resp = await client.post(
                    f"{settings.RECRUITING_URL}/api/talent-pool/onboard-lead",
                    json=payload,
                )
                if resp.status_code < 300:
                    data = resp.json()
                    if data.get("was_existing"):
                        skipped += 1
                    else:
                        saved += 1
                else:
                    errors.append({"lead": lead.name, "status": resp.status_code})
            except Exception as e:
                errors.append({"lead": lead.name, "error": str(e)})

    return {
        "message": f"Added {saved} leads to talent pool, {skipped} already existed",
        "saved": saved,
        "skipped": skipped,
        "errors": errors[:5],
    }
