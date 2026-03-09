import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services import workflow_service
from app.services.template_service import get_templates, get_template_by_id
from app.services.node_registry_service import get_node_types

logger = logging.getLogger("svc-workflows")

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    definition_json: Optional[dict] = None
    trigger_type: Optional[str] = "manual"
    trigger_config: Optional[dict] = None
    template_id: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    definition_json: Optional[dict] = None
    status: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None


@router.get("/node-types")
async def list_node_types(user: dict = Depends(require_employee)):
    """Return all available node types with metadata."""
    return get_node_types()


@router.get("/templates")
async def list_templates(user: dict = Depends(require_employee)):
    """List workflow templates (hardcoded starter templates)."""
    return get_templates()


@router.post("")
async def create_workflow(
    body: WorkflowCreate,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workflow, optionally from a template."""
    definition_json = body.definition_json

    if body.template_id:
        template = get_template_by_id(body.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        definition_json = template["definition_json"]
        if not body.name or body.name == "":
            body.name = template["name"]
        if not body.description:
            body.description = template["description"]

    workflow = await workflow_service.create_workflow(
        db=db,
        name=body.name,
        description=body.description or "",
        definition_json=definition_json or {"nodes": [], "edges": []},
        trigger_type=body.trigger_type or "manual",
        trigger_config=body.trigger_config,
        created_by=str(user["sub"]),
    )
    result = await workflow_service.get_workflow_dict(db, workflow.id)
    return result


@router.get("")
async def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """List workflows with pagination."""
    return await workflow_service.list_workflows(
        db=db, page=page, page_size=page_size, status=status, search=search
    )


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Get workflow detail."""
    result = await workflow_service.get_workflow_dict(db, workflow_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: int,
    body: WorkflowUpdate,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Update workflow."""
    workflow = await workflow_service.update_workflow(
        db=db,
        workflow_id=workflow_id,
        name=body.name,
        description=body.description,
        definition_json=body.definition_json,
        status=body.status,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config,
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await workflow_service.get_workflow_dict(db, workflow.id)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete workflow."""
    deleted = await workflow_service.delete_workflow(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow deleted"}


@router.post("/{workflow_id}/duplicate")
async def duplicate_workflow(
    workflow_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate an existing workflow."""
    copy = await workflow_service.duplicate_workflow(db, workflow_id, created_by=str(user["sub"]))
    if not copy:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await workflow_service.get_workflow_dict(db, copy.id)
