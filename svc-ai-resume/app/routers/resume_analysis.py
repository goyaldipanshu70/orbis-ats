import traceback
from fastapi import APIRouter, HTTPException
from app.schemas.resume_schema import (
    ResumeAnalyzerInput, ResumeAnalyzerOutput,
    ResumeMetadataExtractInput, ResumeMetadataExtractOutput,
)
from app.services.resume_service import analyze_resume, extract_resume_metadata

router = APIRouter()


@router.post("/analyze", response_model=ResumeAnalyzerOutput)
async def evaluate_job_description(payload: ResumeAnalyzerInput):
    """
    Analyze the resume based on parsed job description then extract and return proper feedback for candidate.
    """
    try:
        return analyze_resume(payload.resume_file_link, payload.parsed_jd, payload.rubric_text)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-metadata", response_model=ResumeMetadataExtractOutput)
async def extract_metadata(payload: ResumeMetadataExtractInput):
    """
    Extract metadata (name, email, phone, links, skills) from a resume without JD comparison.
    Used for candidate portal pre-fill.
    """
    try:
        return extract_resume_metadata(str(payload.resume_file_link))
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))