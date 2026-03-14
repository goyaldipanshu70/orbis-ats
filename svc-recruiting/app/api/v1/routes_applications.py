"""Job application endpoints — candidate self-service + HR management."""
import logging
import os
import json
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query

logger = logging.getLogger("svc-recruiting")
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.postgres import get_db
from app.core.security import get_current_user, require_candidate, require_employee
from app.core.config import settings
from app.utils.file_validation import validate_resume_upload, ALLOWED_EXTENSIONS

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
from app.services.application_service import (
    create_application,
    link_candidate_to_application,
    get_my_applications,
    get_application_by_id,
    withdraw_application,
    get_applications_for_job,
    update_application_status,
    quick_apply,
)
from app.services.candidate_service import evaluate_and_save_candidate
from app.services.screening_service import save_responses
from app.services.resume_version_service import add_resume_version, get_resume_versions

router = APIRouter()


# ── Candidate endpoints ──────────────────────────────────────────────────────

@router.post("/parse-resume")
async def parse_resume(
    resume_file: UploadFile = File(...),
    user: dict = Depends(require_candidate),
):
    """Upload a resume and extract metadata via AI (name, email, phone, links, skills)."""
    from app.core.http_client import get_ai_client

    # Read with size limit
    contents = await resume_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate real file type via magic bytes
    await validate_resume_upload(resume_file, contents)

    # Save to temp path
    ext = os.path.splitext(resume_file.filename or "")[1].lower()
    file_ext = ext or ".pdf"
    temp_filename = f"temp_{uuid4()}{file_ext}"
    resume_path = os.path.join(settings.UPLOAD_BASE, "resume", temp_filename)
    os.makedirs(os.path.dirname(resume_path), exist_ok=True)
    with open(resume_path, "wb") as f:
        f.write(contents)

    resume_url = f"{settings.BACKEND_DOMAIN}/files/resume/{temp_filename}"

    # Call svc-ai-resume for metadata extraction
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
async def apply_to_job(
    resume_file: UploadFile = File(...),
    jd_id: str = Form(...),
    phone: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    cover_letter: Optional[str] = Form(None),
    screening_responses: Optional[str] = Form(None),
    source: Optional[str] = Form("direct"),
    referral_code: Optional[str] = Form(None),
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """Submit a job application with resume. Triggers AI screening automatically."""
    # Read with size limit
    contents = await resume_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate real file type via magic bytes
    await validate_resume_upload(resume_file, contents)

    # Save resume file
    ext = os.path.splitext(resume_file.filename or "")[1].lower()
    file_ext = ext or ".pdf"
    resume_filename = f"{uuid4()}_{resume_file.filename or f'resume{file_ext}'}"
    resume_path = os.path.join(settings.UPLOAD_BASE, "resume", resume_filename)
    os.makedirs(os.path.dirname(resume_path), exist_ok=True)
    with open(resume_path, "wb") as f:
        f.write(contents)
    resume_url = f"{settings.BACKEND_DOMAIN}/files/resume/{resume_filename}"

    # Check rejection lock
    from app.services.rejection_lock_service import check_rejection_lock
    lock_info = await check_rejection_lock(db, int(user["sub"]), int(jd_id))
    if lock_info:
        raise HTTPException(status_code=403, detail={"code": "rejection_lock", **lock_info})

    # Check duplicate application (cross-user by contact info)
    from app.services.duplicate_detection_service import check_duplicate_application
    dup_info = await check_duplicate_application(
        db,
        email=user["email"],
        phone=phone,
        linkedin=linkedin_url,
        github=github_url,
        portfolio=portfolio_url,
        exclude_user_id=int(user["sub"]),
    )
    if dup_info:
        raise HTTPException(status_code=409, detail={"code": "duplicate_detected", "duplicate_info": dup_info})

    # Create application record
    try:
        application = await create_application(
            db,
            user_id=int(user["sub"]),
            user_email=user["email"],
            user_name=f"{user['first_name']} {user['last_name']}",
            jd_id=int(jd_id),
            resume_url=resume_url,
            phone=phone,
            linkedin_url=linkedin_url,
            github_url=github_url,
            portfolio_url=portfolio_url,
            cover_letter=cover_letter,
            source=source,
            referral_code=referral_code,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger AI screening (async — returns immediately)
    candidate_id = None
    ai_status = "processing"
    ai_job_id = None
    try:
        result = await evaluate_and_save_candidate(
            db,
            user_id="portal",
            jd_id=jd_id,
            resume_url=resume_url,
            use_rubric=True,
            async_ai=True,
        )
        candidate_id = int(result["candidate_id"])
        ai_job_id = result.get("ai_job_id")
        await link_candidate_to_application(db, application.id, candidate_id)
    except Exception as e:
        ai_status = "failed"
        logger.error("AI screening failed for application %s: %s", application.id, e)

    # Save screening responses if provided
    screening_saved = False
    if screening_responses and candidate_id:
        try:
            from app.schemas.screening_schema import ScreeningResponseCreate
            raw_responses = json.loads(screening_responses)
            responses = [ScreeningResponseCreate(**r) for r in raw_responses]
            await save_responses(db, candidate_id, responses)
            screening_saved = True
        except Exception as e:
            logger.error("Failed to save screening responses: %s", e)
    elif screening_responses and not candidate_id:
        logger.warning("Screening responses provided but candidate_id unavailable (AI failed) for application %s", application.id)

    # Track resume version
    try:
        await add_resume_version(db, resume_url, application_id=application.id)
    except Exception:
        pass

    response = {
        "application_id": application.id,
        "status": application.status,
        "ai_status": ai_status,
        "ai_job_id": ai_job_id,
        "message": "Application submitted successfully",
    }
    if screening_responses and not screening_saved:
        response["screening_warning"] = "Screening responses could not be saved. Please resubmit them."
    return response


@router.get("")
async def list_my_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """List current candidate's applications."""
    return await get_my_applications(db, int(user["sub"]), page, page_size)


@router.get("/{application_id}")
async def get_application(
    application_id: int,
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """Get a single application detail."""
    result = await get_application_by_id(db, application_id, int(user["sub"]))
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    return result


@router.delete("/{application_id}")
async def delete_application(
    application_id: int,
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """Withdraw an application (only if submitted or screening)."""
    try:
        ok = await withdraw_application(db, application_id, int(user["sub"]))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": "Application withdrawn"}


# ── HR / Admin endpoints ─────────────────────────────────────────────────────

@router.get("/job/{jd_id}")
async def list_job_applications(
    jd_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """HR view: all portal applications for a specific job."""
    if user["role"] != "admin" and user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    return await get_applications_for_job(db, jd_id, page, page_size)


class StatusUpdateRequest(BaseModel):
    status: str
    rejection_reason: Optional[str] = None


@router.patch("/{application_id}/status")
async def patch_application_status(
    application_id: int,
    body: StatusUpdateRequest,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """HR updates application status."""
    if user["role"] != "admin" and user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or admin access required")
    try:
        ok = await update_application_status(db, application_id, body.status, rejection_reason=body.rejection_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"message": f"Application status updated to {body.status}"}


# ── Quick Apply ───────────────────────────────────────────────────────────────

class QuickApplyRequest(BaseModel):
    jd_id: int


@router.post("/quick-apply")
async def quick_apply_endpoint(
    body: QuickApplyRequest,
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """One-click apply using stored profile resume and metadata."""
    resume_url = user.get("resume_url")
    if not resume_url:
        raise HTTPException(status_code=400, detail="No resume on file. Please upload a resume in your profile first.")

    # Check rejection lock
    from app.services.rejection_lock_service import check_rejection_lock
    lock_info = await check_rejection_lock(db, int(user["sub"]), body.jd_id)
    if lock_info:
        raise HTTPException(status_code=403, detail={"code": "rejection_lock", **lock_info})

    # Check duplicate
    from app.services.duplicate_detection_service import check_duplicate_application
    dup_info = await check_duplicate_application(db, email=user["email"], phone=user.get("phone"), exclude_user_id=int(user["sub"]))
    if dup_info:
        raise HTTPException(status_code=409, detail={"code": "duplicate_detected", "duplicate_info": dup_info})

    try:
        application = await quick_apply(
            db,
            user_id=int(user["sub"]),
            user_email=user["email"],
            user_name=f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            jd_id=body.jd_id,
            resume_url=resume_url,
            phone=user.get("phone"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger async AI screening
    ai_job_id = None
    try:
        result = await evaluate_and_save_candidate(
            db, user_id="portal", jd_id=str(body.jd_id),
            resume_url=resume_url, use_rubric=True, async_ai=True,
        )
        candidate_id = int(result["candidate_id"])
        ai_job_id = result.get("ai_job_id")
        await link_candidate_to_application(db, application.id, candidate_id)
    except Exception as e:
        logger.error("AI screening failed for quick-apply application %s: %s", application.id, e)

    return {
        "application_id": application.id,
        "status": application.status,
        "ai_status": "processing",
        "ai_job_id": ai_job_id,
        "message": "Quick apply successful",
    }


# ── Resume Versions ──────────────────────────────────────────────────────────

@router.post("/{application_id}/resume")
async def upload_resume_version(
    application_id: int,
    resume_file: UploadFile = File(...),
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new resume version for an application."""
    contents = await resume_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate real file type via magic bytes
    await validate_resume_upload(resume_file, contents)

    ext = os.path.splitext(resume_file.filename or "")[1].lower()
    file_ext = ext or ".pdf"
    resume_filename = f"{uuid4()}_{resume_file.filename or f'resume{file_ext}'}"
    resume_path = os.path.join(settings.UPLOAD_BASE, "resume", resume_filename)
    os.makedirs(os.path.dirname(resume_path), exist_ok=True)
    with open(resume_path, "wb") as f:
        f.write(contents)

    resume_url = f"{settings.BACKEND_DOMAIN}/files/resume/{resume_filename}"
    version = await add_resume_version(db, resume_url, application_id=application_id)
    return version


@router.get("/{application_id}/resumes")
async def list_resume_versions(
    application_id: int,
    user: dict = Depends(require_candidate),
    db: AsyncSession = Depends(get_db),
):
    """List all resume versions for an application."""
    return await get_resume_versions(db, application_id=application_id)
