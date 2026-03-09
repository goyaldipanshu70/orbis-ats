from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.linkedin_service import (
    post_job_to_linkedin,
    get_linkedin_profile,
    send_linkedin_message,
)

router = APIRouter()


@router.post("/post-job")
async def post_job(
    payload: dict,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Post a job to LinkedIn as a UGC post."""
    job_data = payload.get("job_data", {})
    if not job_data.get("title"):
        raise HTTPException(status_code=400, detail="job_data.title is required")

    try:
        result = await post_job_to_linkedin(int(user["sub"]), job_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile")
async def linkedin_profile(
    url: str = Query(..., description="LinkedIn profile URL"),
    user: dict = Depends(require_hiring_access),
):
    """Fetch a LinkedIn profile by URL."""
    try:
        result = await get_linkedin_profile(url, int(user["sub"]))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message")
async def linkedin_message(
    payload: dict,
    user: dict = Depends(require_hiring_access),
):
    """Send a LinkedIn direct message (stub - requires partnership)."""
    recipient_urn = payload.get("recipient_urn", "")
    message = payload.get("message", "")
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    result = await send_linkedin_message(int(user["sub"]), recipient_urn, message)
    return result
