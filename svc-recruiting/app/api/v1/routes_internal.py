from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.postgres import get_db
from app.db.models import JobDescription, CandidateJobEntry
from app.services.candidate_service import _find_or_create_profile
from app.core.security import verify_internal_key

router = APIRouter()


@router.get("/internal/stats", dependencies=[Depends(verify_internal_key)])
async def get_internal_stats(db: AsyncSession = Depends(get_db)):
    """Internal endpoint for admin service to fetch recruiting statistics."""
    total_jobs = (await db.execute(select(func.count()).select_from(JobDescription))).scalar_one()
    total_candidates = (await db.execute(select(func.count()).select_from(CandidateJobEntry))).scalar_one()
    return {"total_jobs": total_jobs, "total_candidates": total_candidates}


class EnsureProfileRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"
    parsed_metadata: Optional[dict] = None


@router.post("/internal/ensure-profile", dependencies=[Depends(verify_internal_key)])
async def ensure_profile(body: EnsureProfileRequest, db: AsyncSession = Depends(get_db)):
    """Service-to-service: create or find a CandidateProfile by email."""
    profile, was_existing = await _find_or_create_profile(
        db=db,
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        resume_url=None,
        category="Other",
        source=body.source,
        created_by="system",
        parsed_metadata=body.parsed_metadata,
    )
    await db.commit()
    return {"profile_id": profile.id, "was_existing": was_existing}
