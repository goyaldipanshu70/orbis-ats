from typing import Dict
from app.utils.file_utils import download_to_tempfile
from app.utils.doc_parser import load_file_content
from app.chains.interview_analysis_agent import run_interview_analysis_chain
from app.schemas.interview_schema import InterviewAnalyzerOutput


def analyze_interview(
    transcript_file_link: str,
    parsed_jd: Dict,
    parsed_resume: Dict,
    rubric_text: str,
    model_answer_text: str
        ) -> InterviewAnalyzerOutput:
    
    # Step 1: Download transcript file
    transcript_path = download_to_tempfile(transcript_file_link)
    transcript_text = load_file_content(transcript_path)

    # Step 4: Run LLM chain
    return run_interview_analysis_chain(
        transcript_text=transcript_text,
        parsed_jd=parsed_jd,
        parsed_resume=parsed_resume,
        rubric_text=rubric_text,
        model_answer=model_answer_text
    )