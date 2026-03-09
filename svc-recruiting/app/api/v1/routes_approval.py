from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.postgres import get_db
from app.core.security import require_hiring_access, require_hr_or_admin
from app.db.models import JobApproval, JobDescription

router = APIRouter()


class RejectBody(BaseModel):
    comments: Optional[str] = None


def _approval_to_dict(a: JobApproval) -> dict:
    return {
        "id": a.id,
        "job_id": a.job_id,
        "requested_by": a.requested_by,
        "approved_by": a.approved_by,
        "status": a.status,
        "comments": a.comments,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.post("/{job_id}/request")
async def request_approval(
    job_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    # Verify job exists
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == job_id, JobDescription.deleted_at.is_(None))
    )
    jd = jd_result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="Job not found")

    # Create approval request
    approval = JobApproval(
        job_id=job_id,
        requested_by=str(user["sub"]),
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(approval)

    # Update job approval_status
    await db.execute(
        update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="pending")
    )

    await db.commit()
    await db.refresh(approval)
    return _approval_to_dict(approval)


@router.post("/{job_id}/approve")
async def approve_job(
    job_id: int,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Find the most recent pending approval for this job
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id, JobApproval.status == "pending")
        .order_by(JobApproval.created_at.desc())
        .limit(1)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="No pending approval found for this job")

    # Update approval
    await db.execute(
        update(JobApproval)
        .where(JobApproval.id == approval.id)
        .values(status="approved", approved_by=str(user["sub"]))
    )

    # Update job approval_status
    await db.execute(
        update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="approved")
    )

    await db.commit()

    # Re-fetch updated approval
    refreshed = await db.execute(
        select(JobApproval).where(JobApproval.id == approval.id)
    )
    updated = refreshed.scalar_one_or_none()
    return _approval_to_dict(updated)


@router.post("/{job_id}/reject")
async def reject_job(
    job_id: int,
    body: RejectBody,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Find the most recent pending approval for this job
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id, JobApproval.status == "pending")
        .order_by(JobApproval.created_at.desc())
        .limit(1)
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="No pending approval found for this job")

    # Update approval
    await db.execute(
        update(JobApproval)
        .where(JobApproval.id == approval.id)
        .values(
            status="rejected",
            approved_by=str(user["sub"]),
            comments=body.comments,
        )
    )

    # Update job approval_status
    await db.execute(
        update(JobDescription)
        .where(JobDescription.id == job_id)
        .values(approval_status="rejected")
    )

    await db.commit()

    # Re-fetch updated approval
    refreshed = await db.execute(
        select(JobApproval).where(JobApproval.id == approval.id)
    )
    updated = refreshed.scalar_one_or_none()
    return _approval_to_dict(updated)


@router.get("/pending")
async def list_pending_approvals(
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobApproval, JobDescription)
        .join(JobDescription, JobApproval.job_id == JobDescription.id)
        .where(JobApproval.status == "pending")
        .order_by(JobApproval.created_at.desc())
    )
    rows = result.all()

    items = []
    for row in rows:
        approval: JobApproval = row.JobApproval
        jd: JobDescription = row.JobDescription
        ai_result = jd.ai_result or {}
        job_title = ai_result.get("job_title", "Untitled Job") if isinstance(ai_result, dict) else "Untitled Job"

        item = _approval_to_dict(approval)
        item["job_title"] = job_title
        items.append(item)

    return items


@router.get("/{job_id}")
async def list_approvals(
    job_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobApproval)
        .where(JobApproval.job_id == job_id)
        .order_by(JobApproval.created_at.desc())
    )
    approvals = result.scalars().all()
    return [_approval_to_dict(a) for a in approvals]
