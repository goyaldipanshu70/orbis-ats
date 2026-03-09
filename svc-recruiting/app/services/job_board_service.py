import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.models import JobBoardPosting

logger = logging.getLogger("svc-recruiting")


def _posting_to_dict(p: JobBoardPosting) -> dict:
    return {
        "id": p.id,
        "jd_id": p.jd_id,
        "board_name": p.board_name,
        "status": p.status,
        "external_url": p.external_url,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "views": p.views,
        "applications": p.applications,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


async def publish_to_board(db: AsyncSession, jd_id: int, board_name: str) -> dict:
    """Create a job board posting with status=published and a generated external URL."""
    external_url = f"https://{board_name}.com/jobs/{jd_id}"
    posting = JobBoardPosting(
        jd_id=jd_id,
        board_name=board_name,
        status="published",
        external_url=external_url,
        published_at=datetime.utcnow(),
        views=0,
        applications=0,
        created_at=datetime.utcnow(),
    )
    db.add(posting)
    await db.commit()
    await db.refresh(posting)
    return _posting_to_dict(posting)


async def remove_posting(db: AsyncSession, posting_id: int) -> Optional[dict]:
    """Set a posting's status to 'removed'."""
    result = await db.execute(
        select(JobBoardPosting).where(JobBoardPosting.id == posting_id)
    )
    posting = result.scalar_one_or_none()
    if not posting:
        return None

    await db.execute(
        update(JobBoardPosting)
        .where(JobBoardPosting.id == posting_id)
        .values(status="removed")
    )
    await db.commit()

    # Refresh to return updated state
    result = await db.execute(
        select(JobBoardPosting).where(JobBoardPosting.id == posting_id)
    )
    posting = result.scalar_one_or_none()
    return _posting_to_dict(posting) if posting else None


async def get_postings(db: AsyncSession, jd_id: int) -> List[dict]:
    """List all job board postings for a given job."""
    result = await db.execute(
        select(JobBoardPosting)
        .where(JobBoardPosting.jd_id == jd_id)
        .order_by(JobBoardPosting.created_at.desc())
    )
    return [_posting_to_dict(p) for p in result.scalars().all()]
