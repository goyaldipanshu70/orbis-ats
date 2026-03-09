"""Job access control service — manage team members per job."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete

from app.db.models import JobMember


async def add_job_member(db: AsyncSession, job_id: int, user_id: int, role: str = "viewer") -> dict:
    """Add a team member to a job."""
    valid_roles = {"viewer", "editor", "owner"}
    if role not in valid_roles:
        raise ValueError(f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    # Check if already a member
    existing = (await db.execute(
        select(JobMember).where(JobMember.job_id == job_id, JobMember.user_id == user_id)
    )).scalar_one_or_none()

    if existing:
        existing.role = role
        await db.commit()
        return {"id": existing.id, "job_id": job_id, "user_id": user_id, "role": role}

    member = JobMember(job_id=job_id, user_id=user_id, role=role)
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return {
        "id": member.id,
        "job_id": member.job_id,
        "user_id": member.user_id,
        "role": member.role,
        "created_at": str(member.created_at),
    }


async def remove_job_member(db: AsyncSession, job_id: int, user_id: int) -> bool:
    """Remove a team member from a job."""
    result = await db.execute(
        sql_delete(JobMember).where(JobMember.job_id == job_id, JobMember.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def get_job_members(db: AsyncSession, job_id: int) -> list:
    """Get all members of a job."""
    result = await db.execute(
        select(JobMember).where(JobMember.job_id == job_id).order_by(JobMember.created_at.asc())
    )
    return [
        {
            "id": m.id,
            "job_id": m.job_id,
            "user_id": m.user_id,
            "role": m.role,
            "created_at": str(m.created_at),
        }
        for m in result.scalars().all()
    ]


async def check_job_access(db: AsyncSession, job_id: int, user_id: int) -> bool:
    """Check if a user has access to a job."""
    result = (await db.execute(
        select(JobMember).where(JobMember.job_id == job_id, JobMember.user_id == user_id)
    )).scalar_one_or_none()
    return result is not None
