from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.lead_service import (
    create_lead_list,
    get_lead_lists,
    get_lead_list,
    delete_lead_list,
    add_leads,
    update_lead,
    delete_lead,
    get_lead_stats,
    push_leads_to_campaign,
)

router = APIRouter()


# ── Request schemas ──────────────────────────────────────────────────────


class CreateLeadListRequest(BaseModel):
    name: str
    description: Optional[str] = None
    source: str = "manual"
    jd_id: Optional[int] = None


class LeadData(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    skills: Optional[list] = None
    experience_years: Optional[int] = None
    relevance_score: Optional[float] = None
    profile_data: Optional[dict] = None
    notes: Optional[str] = None


class AddLeadsRequest(BaseModel):
    leads: List[LeadData]


class UpdateLeadRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    relevance_score: Optional[float] = None


class PushToCampaignRequest(BaseModel):
    campaign_id: int


# ── Lead Lists ───────────────────────────────────────────────────────────


@router.post("/lists")
async def create_list(
    req: CreateLeadListRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await create_lead_list(
        db,
        name=req.name,
        source=req.source,
        created_by=str(user["sub"]),
        description=req.description,
        jd_id=req.jd_id,
    )


@router.get("/lists")
async def list_lists(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_lead_lists(db, page, page_size, status, jd_id)


@router.get("/lists/{list_id}")
async def get_list_detail(
    list_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await get_lead_list(db, list_id)
    if not result:
        raise HTTPException(404, "Lead list not found")
    return result


@router.delete("/lists/{list_id}")
async def remove_list(
    list_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    if not await delete_lead_list(db, list_id):
        raise HTTPException(404, "Lead list not found")
    return {"message": "Lead list deleted"}


# ── Leads ────────────────────────────────────────────────────────────────


@router.post("/lists/{list_id}/leads")
async def add_leads_to_list(
    list_id: int,
    req: AddLeadsRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    # Verify list exists
    ll = await get_lead_list(db, list_id)
    if not ll:
        raise HTTPException(404, "Lead list not found")
    return await add_leads(db, list_id, [l.model_dump() for l in req.leads])


@router.put("/leads/{lead_id}")
async def update_lead_endpoint(
    lead_id: int,
    req: UpdateLeadRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    data = req.model_dump(exclude_none=True)
    result = await update_lead(db, lead_id, data)
    if not result:
        raise HTTPException(404, "Lead not found")
    return result


@router.delete("/leads/{lead_id}")
async def remove_lead(
    lead_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    if not await delete_lead(db, lead_id):
        raise HTTPException(404, "Lead not found")
    return {"message": "Lead deleted"}


# ── Stats & Campaign Push ────────────────────────────────────────────────


@router.post("/leads/{lead_id}/add-to-talent-pool")
async def add_lead_to_talent_pool(
    lead_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Convert a lead into a CandidateProfile in the talent pool."""
    from app.services.candidate_service import _find_or_create_profile
    from app.db.models import Lead
    from sqlalchemy import select as sa_select

    row = await db.execute(sa_select(Lead).where(Lead.id == lead_id))
    lead = row.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")

    profile, was_existing = await _find_or_create_profile(
        db=db,
        email=lead.email,
        full_name=lead.name,
        phone=lead.phone if hasattr(lead, "phone") else None,
        resume_url=None,
        category="lead",
        source=lead.source_platform or "lead_generation",
        created_by=str(user["sub"]),
        parsed_metadata={
            "skills": lead.skills if hasattr(lead, "skills") else [],
            "current_title": lead.title if hasattr(lead, "title") else None,
            "current_company": lead.company if hasattr(lead, "company") else None,
            "location": lead.location if hasattr(lead, "location") else None,
        },
    )

    # Mark lead as converted
    lead.status = "converted"
    await db.commit()

    return {
        "message": "Lead added to talent pool" if not was_existing else "Lead already exists in talent pool",
        "profile_id": profile.id,
        "was_existing": was_existing,
    }


@router.get("/stats")
async def lead_stats(
    list_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_lead_stats(db, list_id)


@router.post("/lists/{list_id}/push-to-campaign")
async def push_to_campaign(
    list_id: int,
    req: PushToCampaignRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await push_leads_to_campaign(db, list_id, req.campaign_id)
