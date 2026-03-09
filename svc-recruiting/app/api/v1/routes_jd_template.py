from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services.jd_template_service import (
    create_template, list_templates, get_template, update_template,
    delete_template, get_categories, increment_usage,
)
from typing import Optional

router = APIRouter()


@router.post("")
async def create_jd_template(
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if not body.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    return await create_template(db, body, user["sub"])


@router.get("")
async def list_jd_templates(
    category: Optional[str] = Query(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await list_templates(db, category)


@router.get("/categories")
async def list_template_categories(
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_categories(db)


@router.get("/{template_id}")
async def get_jd_template(
    template_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    t = await get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.put("/{template_id}")
async def update_jd_template(
    template_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    t = await update_template(db, template_id, body)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.delete("/{template_id}")
async def delete_jd_template(
    template_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_template(db, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deactivated"}


@router.post("/{template_id}/use")
async def use_jd_template(
    template_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    t = await get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    await increment_usage(db, template_id)
    return t
