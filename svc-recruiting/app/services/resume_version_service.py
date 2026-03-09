"""Resume versioning service."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update, func

from app.db.models import ResumeVersion


async def add_resume_version(
    db: AsyncSession,
    resume_url: str,
    application_id: int = None,
    candidate_id: int = None,
) -> dict:
    """Add a new resume version, making it the primary."""
    # Determine next version number
    conditions = []
    if application_id:
        conditions.append(ResumeVersion.application_id == application_id)
    if candidate_id:
        conditions.append(ResumeVersion.candidate_id == candidate_id)

    max_ver = (await db.execute(
        select(func.coalesce(func.max(ResumeVersion.version), 0))
        .where(*conditions)
    )).scalar_one()

    # Unset previous primary
    if conditions:
        await db.execute(
            sql_update(ResumeVersion)
            .where(*conditions)
            .values(is_primary=False)
        )

    version = ResumeVersion(
        application_id=application_id,
        candidate_id=candidate_id,
        resume_url=resume_url,
        version=max_ver + 1,
        is_primary=True,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    return {
        "id": version.id,
        "application_id": version.application_id,
        "candidate_id": version.candidate_id,
        "resume_url": version.resume_url,
        "version": version.version,
        "is_primary": version.is_primary,
        "uploaded_at": str(version.uploaded_at),
    }


async def get_resume_versions(
    db: AsyncSession,
    application_id: int = None,
    candidate_id: int = None,
) -> list:
    """Get all resume versions for an application or candidate."""
    conditions = []
    if application_id:
        conditions.append(ResumeVersion.application_id == application_id)
    if candidate_id:
        conditions.append(ResumeVersion.candidate_id == candidate_id)

    result = await db.execute(
        select(ResumeVersion)
        .where(*conditions)
        .order_by(ResumeVersion.version.desc())
    )
    return [
        {
            "id": v.id,
            "application_id": v.application_id,
            "candidate_id": v.candidate_id,
            "resume_url": v.resume_url,
            "version": v.version,
            "is_primary": v.is_primary,
            "uploaded_at": str(v.uploaded_at),
        }
        for v in result.scalars().all()
    ]


async def set_primary_resume(db: AsyncSession, version_id: int) -> bool:
    """Set a specific version as primary."""
    result = await db.execute(select(ResumeVersion).where(ResumeVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        return False

    # Unset previous primary for same application/candidate
    conditions = []
    if version.application_id:
        conditions.append(ResumeVersion.application_id == version.application_id)
    if version.candidate_id:
        conditions.append(ResumeVersion.candidate_id == version.candidate_id)

    if conditions:
        await db.execute(
            sql_update(ResumeVersion).where(*conditions).values(is_primary=False)
        )

    version.is_primary = True
    await db.commit()
    return True
