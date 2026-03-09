import logging
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import Optional

logger = logging.getLogger("svc-recruiting")
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.core.config import settings
from app.services.candidate_service import (
    get_profiles,
    get_profile_by_id,
    update_profile,
    update_candidate_status,
    get_candidate_job_history,
    _find_or_create_profile,
    derive_category,
)
from app.schemas.candidate_schema import CandidateProfileUpdate, CandidateProfileCreate
from app.utils.file_validation import validate_resume_upload, ALLOWED_EXTENSIONS

router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/parse-resume")
async def parse_resume_for_profile(
    resume_file: UploadFile = File(...),
    user: dict = Depends(require_employee),
):
    """Upload a resume and extract metadata via AI — for HR/employee use."""
    from app.core.http_client import get_ai_client

    contents = await resume_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    # Validate real file type via magic bytes
    await validate_resume_upload(resume_file, contents)

    ext = os.path.splitext(resume_file.filename or "")[1].lower()
    file_ext = ext or ".pdf"
    temp_filename = f"temp_{uuid4()}{file_ext}"
    resume_path = os.path.join(settings.UPLOAD_BASE, "resume", temp_filename)
    os.makedirs(os.path.dirname(resume_path), exist_ok=True)
    with open(resume_path, "wb") as f:
        f.write(contents)

    resume_url = f"{settings.BACKEND_DOMAIN}/files/resume/{temp_filename}"

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_RESUME_URL}/resume/extract-metadata",
            json={"resume_file_link": resume_url},
        )
        resp.raise_for_status()
        metadata = resp.json()
    except Exception as e:
        logger.warning("Resume metadata extraction failed: %s", e)
        metadata = {}

    return {
        "metadata": metadata,
        "resume_url": resume_url,
        "temp_filename": temp_filename,
    }


@router.post("")
async def create_profile(
    body: CandidateProfileCreate,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    category = body.category or derive_category(body.current_role or "")
    meta: dict = body.parsed_metadata.copy() if body.parsed_metadata else {}
    if body.current_role:
        meta["current_role"] = body.current_role
    if body.linkedin_url:
        meta["linkedin_url"] = body.linkedin_url
    if body.github_url:
        meta["github_url"] = body.github_url
    if body.portfolio_url:
        meta["portfolio_url"] = body.portfolio_url
    profile, was_existing = await _find_or_create_profile(
        db=db,
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        resume_url=body.resume_url,
        category=category,
        source="manual",
        created_by=user["sub"],
        parsed_metadata=meta or None,
        linkedin_url=body.linkedin_url,
        github_url=body.github_url,
        portfolio_url=body.portfolio_url,
    )
    if body.notes:
        profile.notes = body.notes
    await db.commit()
    await db.refresh(profile)

    result = {"id": profile.id, "full_name": profile.full_name, "email": profile.email, "was_existing": was_existing}

    if was_existing:
        from app.services.duplicate_detection_service import check_duplicate_candidate
        dup = await check_duplicate_candidate(
            db,
            email=body.email,
            phone=body.phone,
            linkedin_url=body.linkedin_url,
            github_url=body.github_url,
        )
        result["duplicate_info"] = dup

    return result


@router.get("")
async def list_profiles(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_profiles(db, search=search, category=category, status=status, page=page, page_size=page_size)


@router.get("/{profile_id}")
async def get_profile(
    profile_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    result = await get_profile_by_id(db, profile_id)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result


@router.put("/{profile_id}")
async def update_profile_endpoint(
    profile_id: int,
    body: CandidateProfileUpdate,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    ok = await update_profile(db, profile_id, body.model_dump(exclude_none=True))
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile updated"}


@router.patch("/{profile_id}/status")
async def change_profile_status(
    profile_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    status = body.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
    try:
        ok = await update_candidate_status(db, str(profile_id), status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": f"Status updated to {status}"}


@router.get("/{profile_id}/jobs")
async def get_profile_jobs(
    profile_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_candidate_job_history(db, str(profile_id))
