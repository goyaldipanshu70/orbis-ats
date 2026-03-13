"""State schemas for JD workflows."""
from typing import TypedDict, Optional

class JDGenerationState(TypedDict, total=False):
    job_title: str
    department: Optional[str]
    seniority: Optional[str]
    location: Optional[str]
    additional_context: Optional[str]
    generated_jd: Optional[dict]
    error: Optional[str]
    execution_id: str

class JDBiasCheckState(TypedDict, total=False):
    text: str
    score: Optional[int]
    flags: Optional[list]
    error: Optional[str]
    execution_id: str
