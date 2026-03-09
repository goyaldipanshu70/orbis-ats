import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.db.models import JobRequest

logger = logging.getLogger("svc-recruiting")


async def create_request(db: AsyncSession, user: dict, data: dict) -> dict:
    req = JobRequest(
        requested_by=str(user["sub"]),
        requester_name=f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        requester_email=user.get("email", ""),
        requested_role=data["requested_role"],
        team=data.get("team"),
        department=data.get("department"),
        justification=data.get("justification"),
        budget=data.get("budget"),
        budget_currency=data.get("budget_currency", "USD"),
        priority=data.get("priority", "medium"),
        expected_join_date=data.get("expected_join_date"),
        number_of_positions=data.get("number_of_positions", 1),
        job_type=data.get("job_type"),
        location_type=data.get("location_type"),
        location=data.get("location"),
        additional_notes=data.get("additional_notes"),
        skills_required=data.get("skills_required"),
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return _request_to_dict(req)


async def list_requests(db: AsyncSession, status: Optional[str] = None, requested_by: Optional[str] = None) -> List[dict]:
    query = select(JobRequest).order_by(JobRequest.created_at.desc())
    if status:
        query = query.where(JobRequest.status == status)
    if requested_by:
        query = query.where(JobRequest.requested_by == requested_by)
    result = await db.execute(query)
    return [_request_to_dict(r) for r in result.scalars().all()]


async def get_request(db: AsyncSession, request_id: int) -> Optional[dict]:
    result = await db.execute(select(JobRequest).where(JobRequest.id == request_id))
    req = result.scalar_one_or_none()
    return _request_to_dict(req) if req else None


async def review_request(db: AsyncSession, request_id: int, reviewer: str, action: str, comments: Optional[str] = None) -> Optional[dict]:
    """Approve or reject a job request."""
    if action not in ("approved", "rejected"):
        return None
    result = await db.execute(
        update(JobRequest)
        .where(JobRequest.id == request_id, JobRequest.status == "pending")
        .values(
            status=action,
            reviewed_by=reviewer,
            reviewed_at=datetime.utcnow(),
            review_comments=comments,
            updated_at=datetime.utcnow(),
        )
        .returning(JobRequest)
    )
    await db.commit()
    req = result.scalar_one_or_none()
    return _request_to_dict(req) if req else None


async def convert_to_job(db: AsyncSession, request_id: int, job_id: int) -> bool:
    """Mark a request as converted and link to the created job."""
    result = await db.execute(
        update(JobRequest)
        .where(JobRequest.id == request_id)
        .values(status="converted", converted_job_id=job_id, updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


def _request_to_dict(r: JobRequest) -> dict:
    return {
        "id": r.id,
        "requested_by": r.requested_by,
        "requester_name": r.requester_name,
        "requester_email": r.requester_email,
        "requested_role": r.requested_role,
        "team": r.team,
        "department": r.department,
        "justification": r.justification,
        "budget": float(r.budget) if r.budget else None,
        "budget_currency": r.budget_currency,
        "priority": r.priority,
        "expected_join_date": r.expected_join_date,
        "number_of_positions": r.number_of_positions,
        "job_type": r.job_type,
        "location_type": r.location_type,
        "location": r.location,
        "additional_notes": r.additional_notes,
        "skills_required": r.skills_required,
        "status": r.status,
        "reviewed_by": r.reviewed_by,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "review_comments": r.review_comments,
        "converted_job_id": r.converted_job_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
