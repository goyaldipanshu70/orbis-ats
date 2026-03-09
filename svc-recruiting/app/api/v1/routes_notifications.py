from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import get_current_user
from app.services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_read,
    get_unread_count,
    send_multi_channel_notification,
)

router = APIRouter()


class SendNotificationRequest(BaseModel):
    user_id: int
    user_email: str = ""
    type: str
    subject: str
    body: str
    channels: Optional[List[str]] = None
    metadata: Optional[dict] = None


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(user["sub"])
    return await get_user_notifications(db, user_id, unread_only, page, page_size)


@router.get("/unread-count")
async def unread_notification_count(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(user["sub"])
    count = await get_unread_count(db, user_id)
    return {"unread_count": count}


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(user["sub"])
    if not await mark_notification_read(db, notification_id, user_id):
        raise HTTPException(404, "Notification not found")
    return {"message": "Marked as read"}


@router.put("/mark-all-read")
async def mark_all_notifications_read(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(user["sub"])
    count = await mark_all_read(db, user_id)
    return {"marked": count}


@router.post("/send")
async def send_notification_endpoint(
    req: SendNotificationRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a notification (admin/system use)."""
    result = await send_multi_channel_notification(
        db,
        user_id=req.user_id,
        user_email=req.user_email,
        notification_type=req.type,
        subject=req.subject,
        body=req.body,
        channels=req.channels,
        metadata=req.metadata,
    )
    return result
