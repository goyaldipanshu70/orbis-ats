from app.utils.file_utils import download_to_tempfile
from app.utils.doc_parser import load_file_content
from app.schemas.jd_schema import JobDescriptionNEROutput, RoleMatchAndSummary, ExtractedRubric
from app.chains.jd_eval_agent import run_role_match_and_summary_chain, run_rubric_extraction_chain

def evaluate_jd_service(jd_file_link: str) -> JobDescriptionNEROutput:
    """
    Handles the end-to-end JD evaluation logic to be called from the router.
    """
    # Load JD text
    tmp_path1 = download_to_tempfile(jd_file_link)
    jd_text = load_file_content(tmp_path1)

    # Chain calls
    role_result_dict = run_role_match_and_summary_chain(jd_text)
    rubric_result_dict = run_rubric_extraction_chain(jd_text)

    # Convert dicts to Pydantic models
    role_result = RoleMatchAndSummary.model_validate(role_result_dict)
    rubric_result = ExtractedRubric.model_validate(rubric_result_dict)

    return JobDescriptionNEROutput(
        job_title=role_result.raw_text_classification.matched_role or "",
        extracted_rubric=rubric_result,
        summary=role_result.summary,
        raw_text_classification=role_result.raw_text_classification,
    )

def extract_text(file_link: str) -> str:
    tmp_path = download_to_tempfile(file_link)
    return load_file_content(tmp_path)
