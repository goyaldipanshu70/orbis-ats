from app.utils.file_utils import download_to_tempfile
from app.utils.doc_parser import load_file_content
from app.chains.resume_analysis_agent import run_resume_analysis_chain
from app.chains.resume_metadata_chain import run_resume_metadata_chain
from app.schemas.resume_schema import ResumeAnalyzerOutput, ResumeMetadataExtractOutput

def analyze_resume(resume_file_link: str, parsed_jd: dict, rubric_text: str) -> ResumeAnalyzerOutput:
    # Step 1: Download and parse the resume
    tmp_path = download_to_tempfile(resume_file_link)
    resume_text = load_file_content(tmp_path)

    # Step 2: Get analysis result as dict (using legacy analysis for now)
    result_dict = run_resume_analysis_chain(resume_text, parsed_jd, rubric_text)

    # Step 3: Convert dict to Pydantic model
    return ResumeAnalyzerOutput(**result_dict)


def extract_resume_metadata(resume_file_link: str) -> ResumeMetadataExtractOutput:
    tmp_path = download_to_tempfile(resume_file_link)
    resume_text = load_file_content(tmp_path)
    result_dict = run_resume_metadata_chain(resume_text)
    return ResumeMetadataExtractOutput(**result_dict)
