from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_current_user, require_hiring_access, require_hr_or_admin
from app.db.postgres import get_db
from app.schemas.offer_schema import OfferCreate, OfferUpdate, OfferStatusUpdate
from app.services.offer_service import (
    create_offer,
    get_offers_for_job,
    get_offer,
    update_offer,
    render_offer,
    send_offer,
    update_offer_status,
)

# Router for job-scoped offer endpoints: /api/job/{jd_id}/offers
job_offers_router = APIRouter()

# Router for offer-specific endpoints: /api/offers/{offer_id}
offers_router = APIRouter()


# ── Job-scoped endpoints ──────────────────────────────────────────────


@job_offers_router.post("/{jd_id}/offers")
async def create_offer_endpoint(
    jd_id: int,
    data: OfferCreate,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await create_offer(db, jd_id, data, created_by=user["sub"])
    return result


@job_offers_router.get("/{jd_id}/offers")
async def list_offers_endpoint(
    jd_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_offers_for_job(db, jd_id)


# ── Offer-specific endpoints ─────────────────────────────────────────


@offers_router.get("/{offer_id}")
async def get_offer_endpoint(
    offer_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    offer = await get_offer(db, offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@offers_router.put("/{offer_id}")
async def update_offer_endpoint(
    offer_id: int,
    data: OfferUpdate,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    offer = await update_offer(db, offer_id, data)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@offers_router.post("/{offer_id}/send")
async def send_offer_endpoint(
    offer_id: int,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    offer = await send_offer(db, offer_id, sent_by=user["sub"])
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@offers_router.put("/{offer_id}/status")
async def update_offer_status_endpoint(
    offer_id: int,
    data: OfferStatusUpdate,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        offer = await update_offer_status(db, offer_id, data.status, changed_by=user["sub"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@offers_router.get("/{offer_id}/preview")
async def preview_offer_endpoint(
    offer_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    rendered = await render_offer(db, offer_id)
    if rendered is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"offer_id": offer_id, "rendered_content": rendered}
