from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services.candidate_service import (
    get_talent_pool,
    get_talent_pool_profile,
    get_candidate_job_history,
    import_candidates_to_job,
    update_candidate_status,
)

router = APIRouter()


def _require_hr_or_admin(user: dict):
    if user.get("role") not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")


class UpdateStatusRequest(BaseModel):
    status: str


@router.get("")
async def list_talent_pool(
    search: Optional[str] = Query(None),
    min_experience: Optional[int] = Query(None),
    max_experience: Optional[int] = Query(None),
    jd_id: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    return await get_talent_pool(
        db,
        search=search,
        min_experience=min_experience,
        max_experience=max_experience,
        jd_id=jd_id,
        sort=sort,
        category=category,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/{profile_id}")
async def get_talent_detail(
    profile_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    profile = await get_talent_pool_profile(db, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return profile


@router.get("/{profile_id}/history")
async def get_talent_history(
    profile_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    return await get_candidate_job_history(db, profile_id)


class AddToJobRequest(BaseModel):
    candidate_ids: Optional[List[str]] = None
    profile_ids: Optional[List[str]] = None
    target_job_id: str


@router.post("/add-to-job")
async def add_talent_to_job(
    body: AddToJobRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    # Support both profile_ids (new) and candidate_ids (backward compat)
    ids = body.profile_ids or body.candidate_ids or []
    if not ids:
        raise HTTPException(status_code=400, detail="profile_ids or candidate_ids required")
    count = await import_candidates_to_job(db, body.target_job_id, ids, user["sub"])
    return {"message": f"{count} candidate(s) added to job", "imported_count": count}


@router.patch("/{profile_id}/status")
async def change_candidate_status(
    profile_id: str,
    body: UpdateStatusRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    try:
        ok = await update_candidate_status(db, profile_id, body.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": f"Status updated to {body.status}"}


class OnboardLeadRequest(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[float] = None
    source: str = "workflow"
    score: Optional[float] = None
    score_breakdown: Optional[dict] = None


@router.post("/onboard-lead")
async def onboard_lead(
    body: OnboardLeadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create or find a CandidateProfile from workflow-generated lead data.

    This endpoint is called internally by svc-workflows (no user auth required for
    service-to-service calls). Returns 409 if profile already exists.
    """
    from app.services.candidate_service import _find_or_create_profile

    profile, was_existing = await _find_or_create_profile(
        db=db,
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        resume_url=None,
        category="lead",
        source=body.source,
        created_by="workflow",
        parsed_metadata={
            "skills": body.skills or [],
            "location": body.location,
            "headline": body.headline,
            "experience_years": body.experience_years,
            "score": body.score,
            "score_breakdown": body.score_breakdown,
        },
        linkedin_url=body.linkedin_url,
        github_url=body.github_url,
        portfolio_url=body.portfolio_url,
    )
    await db.commit()

    if was_existing:
        return {"message": "Profile already exists", "profile_id": profile.id, "was_existing": True}

    return {"message": "Lead onboarded to talent pool", "profile_id": profile.id, "was_existing": False}


@router.delete("/{profile_id}")
async def remove_candidate(
    profile_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    _require_hr_or_admin(user)
    from app.services.candidate_service import delete_candidate
    # For talent pool, deleting the profile means soft-deleting all entries
    from app.db.models import CandidateProfile
    from sqlalchemy import update
    from datetime import datetime
    result = await db.execute(
        update(CandidateProfile)
        .where(CandidateProfile.id == int(profile_id), CandidateProfile.deleted_at.is_(None))
        .values(deleted_at=datetime.utcnow())
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Candidate deleted"}
