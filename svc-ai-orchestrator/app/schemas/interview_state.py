from typing import TypedDict, Optional


class InterviewEvalState(TypedDict):
    execution_id: str
    transcript_url: str
    transcript_text: Optional[str]
    parsed_jd: dict
    parsed_resume: dict
    rubric_text: str
    model_answer_text: str
    score_breakdown: Optional[dict]
    ai_recommendation: Optional[str]
    red_flags: Optional[list]
    overall_impression: Optional[str]
    retry_count: int
    error: Optional[str]
    provider: str
