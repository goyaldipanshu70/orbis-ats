from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.postgres import get_db
from app.core.security import get_current_user, require_hiring_access
from app.services.referral_service import (
    create_referral_link,
    get_links,
    track_click,
    get_leaderboard,
    get_my_referrals,
)

router = APIRouter()


class CreateLinkRequest(BaseModel):
    jd_id: int


# ── Referral Links ─────────────────────────────────────────────────


@router.post("/links")
async def create_link(
    data: CreateLinkRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    link = await create_referral_link(db, data.jd_id, user)
    return link


@router.get("/links")
async def list_links(
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    links = await get_links(db, jd_id=jd_id)
    return links


# ── Public Tracking ────────────────────────────────────────────────


@router.get("/track/{code}")
async def track_referral_click(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """PUBLIC endpoint — no auth required. Increments click count and returns job info."""
    result = await track_click(db, code)
    if not result:
        raise HTTPException(status_code=404, detail="Referral link not found or inactive")
    return result


# ── Leaderboard & My Referrals ─────────────────────────────────────


@router.get("/leaderboard")
async def referral_leaderboard(
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_leaderboard(db)


@router.get("/mine")
async def my_referrals(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_my_referrals(db, user["sub"])


# ── Reward Management ─────────────────────────────────────────────


@router.put("/{referral_id}/reward")
async def update_reward(
    referral_id: int,
    body: dict,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Update reward info for a referral (HR/admin only)."""
    from app.services.referral_service import update_referral_reward
    result = await update_referral_reward(db, referral_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Referral not found")
    return result
