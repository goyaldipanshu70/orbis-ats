"""CRUD + test endpoints for user-defined custom node types."""
import logging
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgres import get_db
from app.db.models import CustomNodeType
from app.core.security import require_hr_or_admin, require_employee
from app.nodes.custom_executor import create_custom_node_class

logger = logging.getLogger(__name__)
router = APIRouter()


class CustomNodeCreate(BaseModel):
    node_type: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z][a-z0-9_]*$')
    category: str = Field(..., pattern=r'^(trigger|search|ai|processing|action)$')
    display_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    config_schema: Optional[dict] = {}
    execution_code: str = Field(..., min_length=1)
    status: Optional[str] = Field("draft", pattern=r'^(draft|published)$')


class CustomNodeUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, pattern=r'^(trigger|search|ai|processing|action)$')
    config_schema: Optional[dict] = None
    execution_code: Optional[str] = None
    status: Optional[str] = Field(None, pattern=r'^(draft|published)$')


class TestNodeRequest(BaseModel):
    execution_code: str
    config_schema: Optional[dict] = {}
    config: Optional[dict] = {}
    input_data: Optional[dict] = {}


@router.post("")
async def create_custom_node(
    body: CustomNodeCreate,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.nodes import NODE_REGISTRY
    if body.node_type in NODE_REGISTRY:
        raise HTTPException(400, f"Node type '{body.node_type}' conflicts with a built-in node")

    existing = await db.execute(
        select(CustomNodeType).where(CustomNodeType.node_type == body.node_type)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Custom node type '{body.node_type}' already exists")

    try:
        create_custom_node_class(
            node_type=body.node_type,
            category=body.category,
            display_name=body.display_name,
            description=body.description or "",
            config_schema=body.config_schema or {},
            execution_code=body.execution_code,
        )
    except ValueError as e:
        raise HTTPException(422, f"Code compilation error: {e}")

    node = CustomNodeType(
        node_type=body.node_type,
        category=body.category,
        display_name=body.display_name,
        description=body.description or "",
        config_schema=body.config_schema or {},
        execution_code=body.execution_code,
        status=body.status or "draft",
        created_by=str(user.get("sub", "")),
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)

    return {
        "id": node.id,
        "node_type": node.node_type,
        "category": node.category,
        "display_name": node.display_name,
        "description": node.description,
        "config_schema": node.config_schema,
        "status": node.status,
        "created_at": node.created_at.isoformat() if node.created_at else None,
    }


@router.get("")
async def list_custom_nodes(
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomNodeType).order_by(CustomNodeType.created_at.desc())
    )
    nodes = result.scalars().all()
    return [
        {
            "id": n.id,
            "node_type": n.node_type,
            "category": n.category,
            "display_name": n.display_name,
            "description": n.description,
            "config_schema": n.config_schema,
            "status": n.status,
            "created_by": n.created_by,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }
        for n in nodes
    ]


@router.get("/{node_id}")
async def get_custom_node(
    node_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    node = await db.get(CustomNodeType, node_id)
    if not node:
        raise HTTPException(404, "Custom node not found")
    return {
        "id": node.id,
        "node_type": node.node_type,
        "category": node.category,
        "display_name": node.display_name,
        "description": node.description,
        "config_schema": node.config_schema,
        "execution_code": node.execution_code,
        "status": node.status,
        "created_by": node.created_by,
        "created_at": node.created_at.isoformat() if node.created_at else None,
        "updated_at": node.updated_at.isoformat() if node.updated_at else None,
    }


@router.put("/{node_id}")
async def update_custom_node(
    node_id: int,
    body: CustomNodeUpdate,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    node = await db.get(CustomNodeType, node_id)
    if not node:
        raise HTTPException(404, "Custom node not found")

    updates = body.model_dump(exclude_unset=True)

    if "execution_code" in updates:
        try:
            create_custom_node_class(
                node_type=node.node_type,
                category=updates.get("category", node.category),
                display_name=updates.get("display_name", node.display_name),
                description=updates.get("description", node.description),
                config_schema=updates.get("config_schema", node.config_schema) or {},
                execution_code=updates["execution_code"],
            )
        except ValueError as e:
            raise HTTPException(422, f"Code compilation error: {e}")

    for key, value in updates.items():
        setattr(node, key, value)

    await db.commit()
    await db.refresh(node)

    return {
        "id": node.id,
        "node_type": node.node_type,
        "category": node.category,
        "display_name": node.display_name,
        "description": node.description,
        "config_schema": node.config_schema,
        "status": node.status,
        "updated_at": node.updated_at.isoformat() if node.updated_at else None,
    }


@router.delete("/{node_id}")
async def delete_custom_node(
    node_id: int,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    node = await db.get(CustomNodeType, node_id)
    if not node:
        raise HTTPException(404, "Custom node not found")
    await db.delete(node)
    await db.commit()
    return {"ok": True}


@router.post("/test")
async def test_custom_node(
    body: TestNodeRequest,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        cls = create_custom_node_class(
            node_type="__test__",
            category="processing",
            display_name="Test Node",
            description="",
            config_schema=body.config_schema or {},
            execution_code=body.execution_code,
        )
    except ValueError as e:
        return {"success": False, "error": f"Compilation error: {e}", "output": None}

    try:
        instance = cls(config=body.config or {}, db=db, run=None)
        result = await asyncio.wait_for(instance.execute(body.input_data or {}), timeout=10)
        return {
            "success": True,
            "error": None,
            "output": result,
            "lead_count": len(result.get("leads", [])),
        }
    except asyncio.TimeoutError:
        return {"success": False, "error": "Execution timed out (10s limit)", "output": None}
    except Exception as e:
        return {"success": False, "error": str(e), "output": None}
