from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hr_or_admin, require_interviewer
from app.core.config import settings
from app.services.interviewer_service import (
    create_interviewer_profile,
    get_interviewers,
    get_interviewer_by_id,
    update_interviewer,
    toggle_interviewer_status,
    get_my_interviews,
    get_interviewer_stats,
)
from app.schemas.interviewer_schema import (
    InterviewerInviteRequest,
    InterviewerProfileUpdate,
)

router = APIRouter()


@router.post("/invite")
async def invite_interviewer(
    body: InterviewerInviteRequest,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """HR invites an interviewer — creates user in auth + profile in recruiting."""
    from app.core.http_client import get_ai_client

    client = get_ai_client()
    try:
        auth_resp = await client.post(
            f"{settings.AUTH_URL}/api/auth/invite",
            json={
                "email": body.email,
                "first_name": body.first_name,
                "last_name": body.last_name,
                "role": "interviewer",
            },
        )
        auth_resp.raise_for_status()
        auth_data = auth_resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create auth user: {e}")

    profile = await create_interviewer_profile(
        db,
        user_id=auth_data["user_id"],
        email=body.email,
        full_name=f"{body.first_name} {body.last_name}",
        specializations=body.specializations,
        seniority=body.seniority,
        department=body.department,
    )

    return {
        "profile_id": profile.id,
        "user_id": auth_data["user_id"],
        "invite_url": auth_data["invite_url"],
        "message": "Interviewer invited. Share the invite URL with them.",
    }


@router.get("")
async def list_interviewers(
    search: Optional[str] = Query(None),
    specialization: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    active_only: bool = Query(True),
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    return await get_interviewers(db, search=search, specialization=specialization, department=department, active_only=active_only)


@router.get("/me/interviews")
async def my_interviews(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_interviewer),
    db: AsyncSession = Depends(get_db),
):
    return await get_my_interviews(db, int(user["sub"]), status=status)


@router.get("/me/stats")
async def my_stats(
    user: dict = Depends(require_interviewer),
    db: AsyncSession = Depends(get_db),
):
    return await get_interviewer_stats(db, int(user["sub"]))


@router.get("/{profile_id}")
async def get_profile(
    profile_id: int,
    user: dict = Depends(require_interviewer),
    db: AsyncSession = Depends(get_db),
):
    result = await get_interviewer_by_id(db, profile_id)
    if not result:
        raise HTTPException(status_code=404, detail="Interviewer profile not found")
    return result


@router.put("/{profile_id}")
async def update_profile(
    profile_id: int,
    body: InterviewerProfileUpdate,
    user: dict = Depends(require_interviewer),
    db: AsyncSession = Depends(get_db),
):
    ok = await update_interviewer(db, profile_id, body.model_dump(exclude_none=True))
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile updated"}


@router.patch("/{profile_id}/status")
async def change_status(
    profile_id: int,
    body: dict,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active is required")
    ok = await toggle_interviewer_status(db, profile_id, is_active)
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": f"Interviewer {'activated' if is_active else 'deactivated'}"}
