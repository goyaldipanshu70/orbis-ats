import traceback
from fastapi import APIRouter, HTTPException
from app.schemas.interview_schema import InterviewAnalyzerInput, InterviewAnalyzerOutput
from app.services.interview_service import analyze_interview

router = APIRouter()

@router.post("/analyze", response_model=InterviewAnalyzerOutput)
async def evaluate_interview_description(payload: InterviewAnalyzerInput):
    """
    Analyze the interview based on parsed job description, resume, rubric, and transcript then extract and return proper feedback for candidate.
    """
    try:
        return analyze_interview(payload.transcript_file_link, payload.parsed_jd, payload.parsed_resume, payload.rubric_text, payload.model_answer_text)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))