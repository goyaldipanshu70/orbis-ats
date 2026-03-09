"""AI job queue — enqueue, poll status, and process AI tasks via DB-based queue."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update

from app.db.models import AIJob


async def enqueue_ai_job(
    db: AsyncSession,
    job_type: str,
    resource_id: int,
    resource_type: str,
    input_data: dict = None,
) -> int:
    """Create a pending AI job and return its ID."""
    job = AIJob(
        type=job_type,
        resource_id=resource_id,
        resource_type=resource_type,
        input_data=input_data or {},
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job.id


async def get_job_status(db: AsyncSession, job_id: int) -> Optional[dict]:
    """Return AI job status and result."""
    result = await db.execute(select(AIJob).where(AIJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        return None
    return {
        "id": job.id,
        "type": job.type,
        "resource_id": job.resource_id,
        "resource_type": job.resource_type,
        "status": job.status,
        "result": job.result,
        "error": job.error,
        "attempts": job.attempts,
        "created_at": str(job.created_at),
        "updated_at": str(job.updated_at),
    }


async def get_ai_status_for_candidate(db: AsyncSession, candidate_id: int) -> dict:
    """Get latest AI job status for a candidate."""
    result = await db.execute(
        select(AIJob)
        .where(AIJob.resource_id == candidate_id, AIJob.resource_type == "candidate")
        .order_by(AIJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return {"ai_status": "none", "ai_job_id": None}
    return {
        "ai_status": job.status,
        "ai_job_id": job.id,
        "error": job.error,
    }


async def pick_next_pending_job(db: AsyncSession) -> Optional[AIJob]:
    """Pick the oldest pending job and mark it as processing. Returns None if queue is empty."""
    result = await db.execute(
        select(AIJob)
        .where(AIJob.status == "pending")
        .order_by(AIJob.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    job = result.scalar_one_or_none()
    if not job:
        return None

    job.status = "processing"
    job.attempts += 1
    job.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)
    return job


async def complete_ai_job(db: AsyncSession, job_id: int, result_data: dict):
    """Mark job as completed with result."""
    await db.execute(
        sql_update(AIJob)
        .where(AIJob.id == job_id)
        .values(status="completed", result=result_data, updated_at=datetime.utcnow())
    )
    await db.commit()


async def fail_ai_job(db: AsyncSession, job_id: int, error: str, max_retries: int = 3):
    """Mark job as failed or reset to pending for retry."""
    result = await db.execute(select(AIJob).where(AIJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        return

    if job.attempts < max_retries:
        job.status = "pending"
        job.error = error
    else:
        job.status = "failed"
        job.error = error
    job.updated_at = datetime.utcnow()
    await db.commit()
