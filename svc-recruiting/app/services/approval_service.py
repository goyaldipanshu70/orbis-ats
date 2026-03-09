"""Job approval workflow service."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update

from app.db.models import JobApproval, JobDescription


async def request_approval(db: AsyncSession, job_id: int, requested_by: str) -> dict:
    """Create an approval request for a job."""
    # Set job approval status to pending
    await db.execute(
        sql_update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="pending", approval_required=True)
    )

    approval = JobApproval(
        job_id=job_id,
        requested_by=requested_by,
        status="pending",
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)

    return {
        "id": approval.id,
        "job_id": approval.job_id,
        "requested_by": approval.requested_by,
        "status": approval.status,
        "created_at": str(approval.created_at),
    }


async def approve_job(db: AsyncSession, job_id: int, approved_by: str, comments: str = None) -> dict:
    """Approve a job — updates latest pending approval and job status."""
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id, JobApproval.status == "pending")
        .order_by(JobApproval.created_at.desc())
        .limit(1)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise ValueError("No pending approval found for this job")

    approval.approved_by = approved_by
    approval.status = "approved"
    approval.comments = comments

    await db.execute(
        sql_update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="approved")
    )

    await db.commit()
    return {"message": "Job approved", "approval_id": approval.id}


async def reject_job(db: AsyncSession, job_id: int, approved_by: str, comments: str = None) -> dict:
    """Reject a job — updates latest pending approval and job status."""
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id, JobApproval.status == "pending")
        .order_by(JobApproval.created_at.desc())
        .limit(1)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise ValueError("No pending approval found for this job")

    approval.approved_by = approved_by
    approval.status = "rejected"
    approval.comments = comments

    await db.execute(
        sql_update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="rejected")
    )

    await db.commit()
    return {"message": "Job rejected", "approval_id": approval.id}


async def get_approvals_for_job(db: AsyncSession, job_id: int) -> list:
    """Get approval history for a job."""
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id)
        .order_by(JobApproval.created_at.desc())
    )
    approvals = result.scalars().all()
    return [
        {
            "id": a.id,
            "job_id": a.job_id,
            "requested_by": a.requested_by,
            "approved_by": a.approved_by,
            "status": a.status,
            "comments": a.comments,
            "created_at": str(a.created_at),
        }
        for a in approvals
    ]


async def get_pending_approvals(db: AsyncSession) -> list:
    """Get all jobs with pending approval status."""
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.approval_status == "pending", JobDescription.deleted_at.is_(None))
        .order_by(JobDescription.created_at.desc())
    )
    jobs = result.scalars().all()
    items = []
    for j in jobs:
        ai = j.ai_result or {}
        items.append({
            "job_id": j.id,
            "job_title": ai.get("job_title", "Untitled"),
            "user_id": j.user_id,
            "approval_status": j.approval_status,
            "created_at": str(j.created_at),
        })
    return items
