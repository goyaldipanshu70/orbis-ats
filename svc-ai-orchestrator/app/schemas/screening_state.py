"""State for screening AI workflows."""
from typing import TypedDict, Optional

class ScreeningScoringState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    question_scores: Optional[list]
    overall_score: Optional[float]
    error: Optional[str]
    execution_id: str
