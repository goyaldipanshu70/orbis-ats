from pydantic import BaseModel
from typing import List, Optional

class ScoreBreakdown(BaseModel):
    technical_competency: float
    core_qualifications: float
    communication_skills: float
    problem_solving: float
    domain_knowledge: float
    teamwork_culture_fit: float

class InterviewAIResult(BaseModel):
    candidate_name: str
    position: str
    score_breakdown: ScoreBreakdown
    strongest_competency: Optional[str] = None
    area_for_development: Optional[str] = None
    overall_impression: Optional[str] = None
    cultural_fit: Optional[str] = None
    available_to_start: Optional[str] = None
    willing_to_work_weekends: Optional[str] = None
    ai_recommendation: Optional[str] = None
    red_flags: List[str]
    notes: Optional[str] = None

class ScoreDict(BaseModel):
    obtained_score: float
    max_score: float

class ScoreDetailedBreakdown(BaseModel):
    technical_competency: ScoreDict
    core_qualifications: ScoreDict
    communication_skills: ScoreDict
    problem_solving: ScoreDict
    domain_knowledge: ScoreDict
    teamwork_culture_fit: ScoreDict
    total_score: ScoreDict

class InterviewDetailedAIResult(BaseModel):
    candidate_name: str
    position: str
    score_breakdown: ScoreDetailedBreakdown
    strongest_competency: Optional[str] = None
    area_for_development: Optional[str] = None
    overall_impression: Optional[str] = None
    cultural_fit: Optional[str] = None
    available_to_start: Optional[str] = None
    willing_to_work_weekends: Optional[str] = None
    ai_recommendation: Optional[str] = None
    red_flags: List[str]
    notes: Optional[str] = None


class InterviewEvaluationResponse(InterviewDetailedAIResult):
    evaluation_id: str
