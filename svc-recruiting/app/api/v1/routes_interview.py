from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from uuid import uuid4
import os
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, require_employee
from app.schemas.interview_schema import InterviewEvaluationResponse, InterviewDetailedAIResult
from app.services.interview_service import evaluate_and_save_interview, get_interview_evaluations_for_job, get_interview_evaluation_for_candidate
from app.core.config import settings
from app.utils.file_validation import validate_transcript_upload
import traceback

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter()


@router.post("/upload", response_model=InterviewEvaluationResponse)
async def upload_interview_eval(
    transcript_file: UploadFile = File(...),
    candidate_id: str = Form(...),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    contents = await transcript_file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    # Validate real file type via magic bytes (documents + audio/video)
    await validate_transcript_upload(transcript_file, contents)

    base_url = settings.BACKEND_DOMAIN
    transcript_filename = f"{uuid4()}_{transcript_file.filename}"
    transcript_path = os.path.join(settings.UPLOAD_BASE, "transcript", transcript_filename)
    os.makedirs(os.path.dirname(transcript_path), exist_ok=True)

    with open(transcript_path, "wb") as f:
        f.write(contents)
    transcript_url = f"{base_url}/files/transcript/{transcript_filename}"

    result = await evaluate_and_save_interview(db, candidate_id, transcript_url)
    return result


@router.get("/evaluation/job/{job_id}")
async def get_all_interview_evaluations_for_job(
    job_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await get_interview_evaluations_for_job(db, job_id, page=page, page_size=page_size)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error retrieving evaluations: {str(e)}")


@router.get("/evaluation/candidate/{candidate_id}", response_model=InterviewDetailedAIResult)
async def get_candidate_evaluation(
    candidate_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        response = await get_interview_evaluation_for_candidate(db, candidate_id)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error retrieving candidate evaluation: {str(e)}")
