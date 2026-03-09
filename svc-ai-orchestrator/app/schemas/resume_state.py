from typing import TypedDict, Optional


class ResumeScoringState(TypedDict):
    execution_id: str
    resume_url: str
    resume_text: Optional[str]
    parsed_jd: dict
    rubric_text: str
    metadata: Optional[dict]
    category_scores: Optional[dict]
    ai_recommendation: Optional[str]
    highlighted_skills: Optional[list]
    red_flags: Optional[list]
    notes: Optional[str]
    retry_count: int
    error: Optional[str]
    provider: str
