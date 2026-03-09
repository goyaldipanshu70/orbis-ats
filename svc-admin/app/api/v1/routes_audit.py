"""Audit log routes — track platform activity."""
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional

from app.db.postgres import get_db
from app.db.models import AuditLog
from app.core.security import get_current_user, is_admin_user

router = APIRouter()


async def log_action(
    db: AsyncSession,
    *,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
):
    """Utility to insert an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.commit()
    return entry


@router.get("/audit-logs")
async def list_audit_logs(
    action: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at))
    total_stmt = select(func.count()).select_from(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
        total_stmt = total_stmt.where(AuditLog.action == action)

    total = (await db.execute(total_stmt)).scalar_one()
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "user_email": l.user_email,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "details": l.details,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


@router.get("/audit-logs/actions")
async def list_audit_actions(
    _=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get distinct action types for filter dropdown."""
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    return [r[0] for r in result.all()]
