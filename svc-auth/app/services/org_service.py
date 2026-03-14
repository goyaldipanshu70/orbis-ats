# svc-auth/app/services/org_service.py
from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.models import OrgRelationship, User
from datetime import datetime


async def get_org_tree(db: AsyncSession) -> list:
    """Get all org relationships as a flat list. Frontend builds the tree."""
    result = await db.execute(
        select(
            OrgRelationship.id,
            OrgRelationship.user_id,
            OrgRelationship.reports_to,
            OrgRelationship.department,
            OrgRelationship.title,
            User.first_name,
            User.last_name,
            User.email,
            User.role,
        ).outerjoin(User, OrgRelationship.user_id == User.id)
        .order_by(OrgRelationship.department, User.first_name)
    )
    rows = result.all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "reports_to": r.reports_to,
            "department": r.department,
            "title": r.title,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "email": r.email,
            "role": r.role,
        }
        for r in rows
    ]


async def get_direct_reports(db: AsyncSession, manager_user_id: int) -> list:
    """Get all users who report directly to a given manager."""
    result = await db.execute(
        select(OrgRelationship, User)
        .join(User, OrgRelationship.user_id == User.id)
        .where(OrgRelationship.reports_to == manager_user_id)
    )
    rows = result.all()
    return [
        {
            "user_id": rel.user_id,
            "department": rel.department,
            "title": rel.title,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
        }
        for rel, user in rows
    ]


async def get_reporting_chain(db: AsyncSession, user_id: int) -> list:
    """Walk up the tree to get the full reporting chain (user -> manager -> ... -> root)."""
    chain = []
    current_id = user_id
    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        result = await db.execute(
            select(OrgRelationship).where(OrgRelationship.user_id == current_id)
        )
        rel = result.scalar_one_or_none()
        if not rel:
            break
        chain.append({"user_id": rel.user_id, "reports_to": rel.reports_to, "department": rel.department, "title": rel.title})
        current_id = rel.reports_to
    return chain


async def set_reporting(db: AsyncSession, user_id: int, reports_to: int | None, department: str | None = None, title: str | None = None):
    """Set or update who a user reports to."""
    result = await db.execute(
        select(OrgRelationship).where(OrgRelationship.user_id == user_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.reports_to = reports_to
        if department is not None:
            existing.department = department
        if title is not None:
            existing.title = title
        existing.updated_at = datetime.utcnow()
    else:
        db.add(OrgRelationship(user_id=user_id, reports_to=reports_to, department=department, title=title))
    await db.commit()


async def remove_from_org(db: AsyncSession, user_id: int):
    """Remove a user from the org tree."""
    result = await db.execute(
        select(OrgRelationship).where(OrgRelationship.user_id == user_id)
    )
    rel = result.scalar_one_or_none()
    if rel:
        # Reassign their direct reports to their manager
        reports = (await db.execute(
            select(OrgRelationship).where(OrgRelationship.reports_to == user_id)
        )).scalars().all()
        for report in reports:
            report.reports_to = rel.reports_to
        await db.delete(rel)
        await db.commit()


async def get_all_subordinates(db: AsyncSession, manager_user_id: int) -> list[int]:
    """Get all user IDs in the subtree under a manager (recursive)."""
    all_ids = []
    queue = [manager_user_id]
    visited = set()
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        result = await db.execute(
            select(OrgRelationship.user_id).where(OrgRelationship.reports_to == current)
        )
        report_ids = [r[0] for r in result.all()]
        all_ids.extend(report_ids)
        queue.extend(report_ids)
    return all_ids
