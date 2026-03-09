from fastapi import APIRouter, HTTPException
from app.schemas.jd_schema import (
    JobDescriptionNERInput,  
    JobDescriptionRubricInput, 
    JobDescriptionModelAnswerInput,
    JobDescriptionNEROutput,
    JobDescriptionRubricOutput,
    JobDescriptionModelAnswerOutput
    )
from app.services.jd_service import evaluate_jd_service, extract_text
import traceback

router = APIRouter( )

@router.post("/extract/jd", response_model=JobDescriptionNEROutput)
async def job_description_ner(payload: JobDescriptionNERInput):
    """
    Evaluate the job description and extract structured rubric and metadata.
    """
    try:
        return evaluate_jd_service(str(payload.jd_file_link))
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/extract/rubric", response_model=JobDescriptionRubricOutput)
async def job_description_rubric(payload: JobDescriptionRubricInput):
    """
    Extract structured rubric text from rubric file.
    """
    try:
        rubric_text = extract_text(str(payload.rubric_file_link))
        return JobDescriptionRubricOutput(rubric_text=rubric_text)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/extract/model-answer", response_model=JobDescriptionModelAnswerOutput)
async def job_description_model_answer(payload: JobDescriptionModelAnswerInput):
    """
    Extract structured text from model answer file.
    """
    try:
        model_answer_text = extract_text(str(payload.model_answer_file_link))
        return JobDescriptionModelAnswerOutput(model_answer_text=model_answer_text)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    

    

    
