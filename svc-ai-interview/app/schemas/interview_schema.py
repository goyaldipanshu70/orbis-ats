from enum import Enum
from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, List

class InterviewAnalyzerInput(BaseModel):
    transcript_file_link: HttpUrl  # Supports text, DOC, MP3, or WAV
    parsed_jd: Dict  # Output of JD parser
    parsed_resume: Dict  # Output of Resume analyzer
    rubric_text: str  # Optional extracted rubric (e.g. from PDF)
    model_answer_text: str  # Optional extracted model answer

class InterviewScoreBreakdown(BaseModel):
    technical_competency: float  # /25
    core_qualifications: float  # /15
    communication_skills: float  # /20
    problem_solving: float  # /15
    domain_knowledge: float  # /15
    teamwork_culture_fit: float  # /10

class InterviewAnalyzerOutput(BaseModel):
    candidate_name: str
    position: str
    score_breakdown: InterviewScoreBreakdown
    strongest_competency: Optional[str]
    area_for_development: Optional[str]
    overall_impression: Optional[str]
    cultural_fit: Optional[str]  # Yes or No
    available_to_start: Optional[str]
    willing_to_work_weekends: Optional[str]
    ai_recommendation: Optional[str]  # One of: Hire, Manual Review Required, Do Not Recommend
    red_flags: List[str]
    notes: Optional[str]
