import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, is_admin_or_hr_user, is_admin_user
from app.db.models import Announcement
from app.db.postgres import get_db

logger = logging.getLogger("svc-admin")
router = APIRouter(tags=["Announcements"])


def _row_to_dict(a: Announcement) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "priority": a.priority,
        "pinned": a.pinned,
        "created_by": a.created_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
async def list_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Announcement)
    count_q = select(func.count(Announcement.id))

    if search:
        pattern = f"%{search}%"
        filt = or_(Announcement.title.ilike(pattern), Announcement.content.ilike(pattern))
        q = q.where(filt)
        count_q = count_q.where(filt)

    total = (await db.execute(count_q)).scalar() or 0
    total_pages = max(1, -(-total // page_size))

    q = q.order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_row_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{announcement_id}")
async def get_announcement(
    announcement_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Announcement, announcement_id)
    if not row:
        raise HTTPException(404, "Announcement not found")
    return _row_to_dict(row)


@router.post("")
async def create_announcement(
    body: dict,
    role: str = Depends(is_admin_or_hr_user),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = Announcement(
        title=body["title"],
        content=body.get("content", ""),
        priority=body.get("priority", "normal"),
        pinned=body.get("pinned", False),
        created_by=int(user["sub"]),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _row_to_dict(a)


@router.put("/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    body: dict,
    role: str = Depends(is_admin_or_hr_user),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Announcement, announcement_id)
    if not row:
        raise HTTPException(404, "Announcement not found")
    for field in ("title", "content", "priority", "pinned"):
        if field in body:
            setattr(row, field, body[field])
    await db.commit()
    await db.refresh(row)
    return _row_to_dict(row)


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    role: str = Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Announcement, announcement_id)
    if not row:
        raise HTTPException(404, "Announcement not found")
    await db.delete(row)
    await db.commit()
    return {"message": "Announcement deleted"}
