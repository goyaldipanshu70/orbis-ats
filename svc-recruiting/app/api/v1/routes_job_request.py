from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services.job_request_service import create_request, list_requests, get_request, review_request, convert_to_job
from typing import Optional

router = APIRouter()


@router.post("")
async def create_job_request(
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if not body.get("requested_role"):
        raise HTTPException(status_code=400, detail="requested_role is required")
    return await create_request(db, user, body)


@router.get("")
async def list_job_requests(
    status: Optional[str] = Query(None),
    mine: bool = Query(False),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    requested_by = str(user["sub"]) if mine else None
    return await list_requests(db, status=status, requested_by=requested_by)


@router.get("/{request_id}")
async def get_job_request(
    request_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    req = await get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/review")
async def review_job_request(
    request_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    action = body.get("action")
    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'rejected'")
    reviewer = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    result = await review_request(db, request_id, reviewer, action, body.get("comments"))
    if not result:
        raise HTTPException(status_code=404, detail="Request not found or already reviewed")
    return result


@router.post("/{request_id}/convert")
async def convert_request_to_job(
    request_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    job_id = body.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required")
    ok = await convert_to_job(db, request_id, int(job_id))
    if not ok:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Request converted to job"}
