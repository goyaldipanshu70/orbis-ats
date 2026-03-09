from pydantic import BaseModel
from typing import Optional, Dict


class CriterionScore(BaseModel):
    score: int
    comment: str


class EnhancedFeedbackRequest(BaseModel):
    rating: int
    recommendation: str
    strengths: str
    concerns: Optional[str] = None
    notes: Optional[str] = None
    would_interview_again: Optional[bool] = None
    criteria_scores: Optional[Dict[str, CriterionScore]] = None
    rubric_scores: Optional[Dict[str, CriterionScore]] = None
