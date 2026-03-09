from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_employee, require_hiring_access
from app.services.candidate_service import (
    evaluate_and_save_candidate,
    evaluate_and_save_multiple_candidates,
    get_candidate_by_id,
    delete_candidate,
    update_candidate_screening_status,
    update_candidate_onboard_status,
    get_candidates,
    get_candidates_for_import,
    search_candidates_global,
    import_candidates_to_job,
    move_candidate_stage,
    bulk_move_candidates,
    get_candidates_by_pipeline,
    get_stage_history,
)
from app.services.ai_queue_service import get_ai_status_for_candidate
from app.services.feedback_service import get_feedback_summary
from app.services.csv_import_service import preview_csv, import_csv
import json
from app.schemas.candidate_schema import (
    CandidateUploadResponse,
    CandidateJobEntryResponse,
    ImportCandidatesRequest,
    MultipleCandidateUploadResponse,
    CheckDuplicateRequest,
    CheckDuplicateResponse,
    CandidateProfileUpdate,
)
from app.db.models import CandidateProfile
from datetime import datetime
from app.core.config import settings
from app.utils.file_validation import validate_resume_upload, ALLOWED_EXTENSIONS
from uuid import uuid4
import os

router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/check-duplicate", response_model=CheckDuplicateResponse)
async def check_duplicate(
    body: CheckDuplicateRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Pre-check for duplicate candidates before uploading."""
    from app.services.duplicate_detection_service import check_duplicate_candidate
    dup = await check_duplicate_candidate(
        db,
        email=body.email,
        phone=body.phone,
        linkedin_url=body.linkedin_url,
        github_url=body.github_url,
    )
    if dup:
        return {"is_duplicate": True, "duplicate_info": dup}
    return {"is_duplicate": False}


@router.post("/upload", response_model=CandidateUploadResponse)
async def upload_candidate_resume(
    resume_file: UploadFile = File(...),
    jd_id: str = Form(...),
    use_rubric: bool = Form(True),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    contents = await resume_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate real file type via magic bytes
    await validate_resume_upload(resume_file, contents)

    file_extension = os.path.splitext(resume_file.filename or "")[1] or ".pdf"
    resume_filename = f"{uuid4()}_{resume_file.filename if resume_file.filename else f'resume{file_extension}'}"
    resume_path = os.path.join(settings.UPLOAD_BASE, "resume", resume_filename)

    os.makedirs(os.path.dirname(resume_path), exist_ok=True)
    with open(resume_path, "wb") as f:
        f.write(contents)

    base_url = settings.BACKEND_DOMAIN
    resume_url = f"{base_url}/files/resume/{resume_filename}"

    result = await evaluate_and_save_candidate(db, user["sub"], jd_id, resume_url, use_rubric)

    return result


@router.post("/upload-multiple", response_model=MultipleCandidateUploadResponse)
async def upload_multiple_candidate_resumes(
    resume_files: List[UploadFile] = File(...),
    jd_id: str = Form(...),
    use_rubric: bool = Form(True),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    if len(resume_files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files allowed per upload")

    # Validate each file's real MIME type via magic bytes before proceeding
    for file in resume_files:
        file_contents = await file.read()
        if len(file_contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{file.filename}' too large. Maximum size is 10 MB.")
        await validate_resume_upload(file, file_contents)
        # Seek back so downstream code can re-read the file
        await file.seek(0)

    results = await evaluate_and_save_multiple_candidates(
        db=db,
        user_id=user["sub"],
        jd_id=jd_id,
        resume_files=resume_files,
        use_rubric=use_rubric
    )

    return results


@router.put("/screening")
async def screen_candidate(
    candidate_id: str = Form(...),
    screening: bool = Form(...),
    current_user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    await update_candidate_screening_status(db, candidate_id, screening)
    return {"message": "Candidate screening status updated successfully"}


@router.get("")
async def list_candidates(
    jd_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    return await get_candidates(db, jd_id=jd_id, page=page, page_size=page_size)


@router.get("/id/{candidate_id}", response_model=CandidateJobEntryResponse)
async def retrieve_candidate(
    candidate_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    candidate = await get_candidate_by_id(db, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.delete("/{candidate_id}")
async def remove_candidate(
    candidate_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    deleted_by = f"{user['first_name']} {user['last_name']}"
    success = await delete_candidate(db, candidate_id, deleted_by=deleted_by)
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found or already deleted")
    return {"message": "Candidate deleted successfully"}


class OnboardRequest(BaseModel):
    onboard: bool = True


@router.put("/{candidate_id}/onboard")
async def onboard_candidate(
    candidate_id: str,
    body: OnboardRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    success = await update_candidate_onboard_status(db, candidate_id, body.onboard)
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": f"Candidate {'onboarded' if body.onboard else 'removed from onboarding'}"}


@router.get("/import")
async def get_candidates_for_import_endpoint(
    job_id: str = Query(..., description="Job ID to get candidates from"),
    category: Optional[str] = Query(None, description="Filter by candidate category"),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    return await get_candidates_for_import(db, job_id, category=category)


@router.get("/search")
async def search_candidates_endpoint(
    q: str = Query("", description="Search query for candidate name or email"),
    exclude_jd_id: str = Query(..., description="Job ID to exclude from results"),
    category: Optional[str] = Query(None, description="Filter by candidate category"),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await search_candidates_global(db, q, exclude_jd_id, limit, category=category)


@router.post("/import")
async def import_candidates(
    payload: ImportCandidatesRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    count = await import_candidates_to_job(
        db,
        payload.target_job_id,
        payload.candidate_ids,
        user["sub"]
    )
    return {
        "message": "Candidates imported successfully",
        "imported_count": count
    }


@router.put("/bulk-stage")
async def bulk_move(
    body: dict,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    candidate_ids = body.get("candidate_ids", [])
    stage = body.get("stage")
    notes = body.get("notes")
    changed_by = f"{user['first_name']} {user['last_name']}"
    await bulk_move_candidates(db, candidate_ids, stage, changed_by, notes)
    return {"message": f"Moved {len(candidate_ids)} candidates to {stage}"}


@router.get("/pipeline/{jd_id}")
async def get_pipeline(
    jd_id: str,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_candidates_by_pipeline(db, jd_id)


@router.put("/{candidate_id}/stage")
async def move_stage(
    candidate_id: int,
    body: dict,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    stage = body.get("stage")
    notes = body.get("notes")
    hired_location_id = body.get("hired_location_id")
    changed_by = f"{user['first_name']} {user['last_name']}"
    await move_candidate_stage(db, candidate_id, stage, changed_by, notes, hired_location_id=hired_location_id)
    return {"message": f"Candidate moved to {stage}"}


@router.get("/{candidate_id}/history")
async def get_history(
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_stage_history(db, candidate_id)


@router.get("/{candidate_id}/ai-status")
async def get_candidate_ai_status(
    candidate_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Poll AI processing status for a candidate."""
    return await get_ai_status_for_candidate(db, candidate_id)


@router.get("/{candidate_id}/feedback")
async def get_candidate_feedback(
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Get all interview feedback for a candidate."""
    return await get_feedback_summary(db, candidate_id)


@router.post("/{profile_id}/photo")
async def upload_profile_photo(
    profile_id: int,
    photo: UploadFile = File(...),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile photo for a candidate."""
    contents = await photo.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit for photos
        raise HTTPException(status_code=413, detail="Photo too large. Maximum size is 5 MB.")

    # Validate it's an image
    if not photo.content_type or not photo.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(photo.filename or "")[1] or ".jpg"
    filename = f"{uuid4()}{ext}"
    photo_path = os.path.join(settings.UPLOAD_BASE, "photos", filename)
    os.makedirs(os.path.dirname(photo_path), exist_ok=True)
    with open(photo_path, "wb") as f:
        f.write(contents)

    photo_url = f"{settings.BACKEND_DOMAIN}/files/photos/{filename}"

    # Update profile
    from sqlalchemy import update as sql_update
    result = await db.execute(
        sql_update(CandidateProfile).where(CandidateProfile.id == profile_id).values(photo_url=photo_url, updated_at=datetime.utcnow())
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {"photo_url": photo_url}


@router.put("/profiles/{profile_id}")
async def update_profile(
    profile_id: int,
    body: CandidateProfileUpdate,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Update candidate profile fields."""
    from sqlalchemy import update as sql_update
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.utcnow()
    result = await db.execute(
        sql_update(CandidateProfile).where(CandidateProfile.id == profile_id, CandidateProfile.deleted_at.is_(None)).values(**update_data)
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile updated successfully"}


@router.post("/csv-preview")
async def csv_preview(
    file: UploadFile = File(...),
    user: dict = Depends(require_employee),
):
    """Parse CSV and return headers + preview rows for field mapping."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")
    return preview_csv(contents)


@router.post("/csv-import")
async def csv_import(
    file: UploadFile = File(...),
    field_mapping: str = Form(...),
    jd_id: Optional[str] = Form(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Import candidates from CSV with field mapping."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    try:
        mapping = json.loads(field_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid field_mapping JSON")

    parsed_jd_id = int(jd_id) if jd_id else None
    result = await import_csv(db, parsed_jd_id, contents, mapping, user["sub"])
    return result
