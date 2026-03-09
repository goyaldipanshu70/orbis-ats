import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, is_admin_or_hr_user, is_admin_user
from app.db.models import OnboardingTemplate
from app.db.postgres import get_db

logger = logging.getLogger("svc-admin")
router = APIRouter(tags=["Onboarding"])


def _row_to_dict(t: OnboardingTemplate) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description or "",
        "checklist": t.checklist or [],
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("")
async def list_onboarding_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(OnboardingTemplate)
    count_q = select(func.count(OnboardingTemplate.id))

    if search:
        pattern = f"%{search}%"
        filt = or_(OnboardingTemplate.title.ilike(pattern), OnboardingTemplate.description.ilike(pattern))
        q = q.where(filt)
        count_q = count_q.where(filt)

    total = (await db.execute(count_q)).scalar() or 0
    total_pages = max(1, -(-total // page_size))

    q = q.order_by(OnboardingTemplate.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_row_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{template_id}")
async def get_onboarding_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(OnboardingTemplate, template_id)
    if not row:
        raise HTTPException(404, "Onboarding template not found")
    return _row_to_dict(row)


@router.post("")
async def create_onboarding_template(
    body: dict,
    role: str = Depends(is_admin_or_hr_user),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t = OnboardingTemplate(
        title=body["title"],
        description=body.get("description", ""),
        checklist=body.get("checklist", []),
        created_by=int(user["sub"]),
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _row_to_dict(t)


@router.put("/{template_id}")
async def update_onboarding_template(
    template_id: int,
    body: dict,
    role: str = Depends(is_admin_or_hr_user),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(OnboardingTemplate, template_id)
    if not row:
        raise HTTPException(404, "Onboarding template not found")
    for field in ("title", "description", "checklist"):
        if field in body:
            setattr(row, field, body[field])
    await db.commit()
    await db.refresh(row)
    return _row_to_dict(row)


@router.delete("/{template_id}")
async def delete_onboarding_template(
    template_id: int,
    role: str = Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(OnboardingTemplate, template_id)
    if not row:
        raise HTTPException(404, "Onboarding template not found")
    await db.delete(row)
    await db.commit()
    return {"message": "Template deleted"}
