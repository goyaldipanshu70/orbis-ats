"""AI job status polling endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import get_current_user
from app.services.ai_queue_service import get_job_status, get_ai_status_for_candidate

router = APIRouter()


@router.get("/{job_id}")
async def get_ai_job(
    job_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll AI job status."""
    result = await get_job_status(db, job_id)
    if not result:
        raise HTTPException(status_code=404, detail="AI job not found")
    return result
