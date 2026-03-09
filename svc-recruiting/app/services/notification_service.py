"""Email notification queue service — DB-based async email delivery."""
import asyncio
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update

from app.db.models import Notification

logger = logging.getLogger("svc-recruiting")

_running = False
_task: asyncio.Task = None


async def send_notification(
    db: AsyncSession,
    user_email: str,
    notification_type: str,
    subject: str,
    body: str,
    user_id: int = None,
) -> int:
    """Enqueue a notification for delivery."""
    notification = Notification(
        user_id=user_id,
        user_email=user_email,
        type=notification_type,
        subject=subject,
        body=body,
        status="pending",
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification.id


async def process_pending_notifications(db: AsyncSession):
    """Pick and send one pending notification."""
    result = await db.execute(
        select(Notification)
        .where(Notification.status == "pending")
        .order_by(Notification.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False

    try:
        from app.utils.email_client import send_email
        await send_email(notification.subject, notification.body, notification.user_email)
        notification.status = "sent"
        notification.sent_at = datetime.utcnow()
    except Exception as e:
        notification.status = "failed"
        notification.error = str(e)
        logger.error("Notification send failed: %s", e)

    await db.commit()

    # Publish real-time event
    if notification.user_id:
        try:
            from app.services.event_bus import publish_user_event
            await publish_user_event(notification.user_id, "notification_delivered", {
                "notification_id": notification.id, "type": notification.type,
                "status": notification.status, "subject": notification.subject,
            })
        except Exception:
            pass

    return True


async def get_notifications(
    db: AsyncSession,
    user_id: int = None,
    status: str = None,
    limit: int = 50,
) -> list:
    """Get notifications with optional filters."""
    conditions = []
    if user_id is not None:
        conditions.append(Notification.user_id == user_id)
    if status:
        conditions.append(Notification.status == status)

    query = select(Notification).where(*conditions).order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)

    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "user_email": n.user_email,
            "type": n.type,
            "subject": n.subject,
            "status": n.status,
            "sent_at": str(n.sent_at) if n.sent_at else None,
            "error": n.error,
            "created_at": str(n.created_at),
        }
        for n in result.scalars().all()
    ]


async def _notification_worker_loop():
    """Background loop to process pending notifications."""
    from app.db.postgres import AsyncSessionLocal
    global _running
    while _running:
        try:
            async with AsyncSessionLocal() as db:
                processed = await process_pending_notifications(db)
                if not processed:
                    await asyncio.sleep(5)
        except Exception as e:
            logger.error("Notification worker error: %s", e)
            await asyncio.sleep(10)


async def start_notification_worker():
    """Start the notification background worker."""
    global _running, _task
    if _running:
        return
    _running = True
    _task = asyncio.create_task(_notification_worker_loop())
    logger.info("Notification background worker started")


async def stop_notification_worker():
    """Stop the notification background worker."""
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
    logger.info("Notification background worker stopped")


# ── In-App Notification Center ─────────────────────────────────────────


async def send_in_app_notification(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    subject: str,
    body: str,
    metadata: dict = None,
) -> int:
    """Create an in-app notification and publish real-time event."""
    notification = Notification(
        user_id=user_id,
        user_email="",  # not needed for in_app
        type=notification_type,
        subject=subject,
        body=body,
        channel="in_app",
        status="delivered",
        sent_at=datetime.utcnow(),
        extra_data=metadata,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    # Publish real-time event
    try:
        from app.services.event_bus import publish_user_event
        await publish_user_event(user_id, "new_notification", {
            "id": notification.id,
            "type": notification_type,
            "subject": subject,
            "body": body,
            "metadata": metadata,
            "created_at": notification.created_at.isoformat(),
        })
    except Exception:
        pass

    return notification.id


async def get_user_notifications(
    db: AsyncSession,
    user_id: int,
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Get paginated in-app notifications for a user."""
    from sqlalchemy import func as sqlfunc
    conditions = [Notification.user_id == user_id, Notification.channel == "in_app"]
    if unread_only:
        conditions.append(Notification.is_read == False)

    total = (await db.execute(
        select(sqlfunc.count(Notification.id)).where(*conditions)
    )).scalar() or 0

    unread_count = (await db.execute(
        select(sqlfunc.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.channel == "in_app",
            Notification.is_read == False,
        )
    )).scalar() or 0

    q = (select(Notification)
         .where(*conditions)
         .order_by(Notification.created_at.desc())
         .offset((page - 1) * page_size)
         .limit(page_size))
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_notification_to_dict(n) for n in rows],
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
    }


async def mark_notification_read(db: AsyncSession, notification_id: int, user_id: int) -> bool:
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    return True


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    """Mark all unread in-app notifications as read for a user."""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.channel == "in_app",
            Notification.is_read == False,
        )
    )
    notifications = result.scalars().all()
    count = 0
    for n in notifications:
        n.is_read = True
        n.read_at = datetime.utcnow()
        count += 1
    if count:
        await db.commit()
    return count


async def get_unread_count(db: AsyncSession, user_id: int) -> int:
    """Get the count of unread in-app notifications for a user."""
    from sqlalchemy import func as sqlfunc
    return (await db.execute(
        select(sqlfunc.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.channel == "in_app",
            Notification.is_read == False,
        )
    )).scalar() or 0


def _notification_to_dict(n: Notification) -> dict:
    """Convert a Notification ORM object to a dict for JSON response."""
    return {
        "id": n.id,
        "user_id": n.user_id,
        "type": n.type,
        "subject": n.subject,
        "body": n.body,
        "channel": n.channel if hasattr(n, "channel") else "email",
        "is_read": n.is_read if hasattr(n, "is_read") else False,
        "read_at": n.read_at.isoformat() if hasattr(n, "read_at") and n.read_at else None,
        "metadata": n.extra_data if hasattr(n, "extra_data") else None,
        "status": n.status,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


async def send_multi_channel_notification(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    notification_type: str,
    subject: str,
    body: str,
    channels: list[str] = None,
    metadata: dict = None,
) -> dict:
    """Send notification across multiple channels (email, in_app, etc.)."""
    if channels is None:
        channels = ["in_app", "email"]

    results = {}

    if "in_app" in channels:
        nid = await send_in_app_notification(db, user_id, notification_type, subject, body, metadata)
        results["in_app"] = nid

    if "email" in channels and user_email:
        nid = await send_notification(db, user_email, notification_type, subject, body, user_id)
        results["email"] = nid

    return results


async def notify_event(event_type: str, user_id: int, user_email: str, data: dict):
    """Convenience function to send event-triggered notifications."""
    from app.db.postgres import AsyncSessionLocal

    templates = {
        "candidate_applied": ("New Application", "A new candidate has applied for {job_title}"),
        "interview_scheduled": ("Interview Scheduled", "Interview scheduled for {candidate_name} - {job_title}"),
        "interview_rescheduled": ("Interview Rescheduled", "Interview rescheduled for {candidate_name}"),
        "offer_sent": ("Offer Sent", "An offer has been sent to {candidate_name}"),
        "offer_accepted": ("Offer Accepted", "{candidate_name} has accepted the offer for {job_title}"),
        "new_job_request": ("New Job Request", "A new job request has been submitted: {job_title}"),
        "stage_changed": ("Pipeline Update", "{candidate_name} moved to {new_stage} stage"),
    }

    template = templates.get(event_type)
    if not template:
        return

    subject = template[0]
    try:
        body = template[1].format(**data)
    except KeyError:
        body = template[1]

    try:
        async with AsyncSessionLocal() as db:
            await send_multi_channel_notification(
                db,
                user_id=user_id,
                user_email=user_email,
                notification_type=event_type,
                subject=subject,
                body=body,
                channels=["in_app"],
                metadata=data,
            )
    except Exception as e:
        logger.warning("Failed to send event notification: %s", e)
