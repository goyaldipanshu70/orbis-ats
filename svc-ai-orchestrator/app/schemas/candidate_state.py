"""State schemas for candidate AI workflows."""
from typing import TypedDict, Optional


class CandidateFitState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    job_context: Optional[dict]
    candidate_context: Optional[dict]
    resume_analysis: Optional[dict]
    interview_scores: Optional[dict]
    screening_data: Optional[dict]
    fit_summary: Optional[dict]
    error: Optional[str]
    execution_id: str


class CandidateRankingState(TypedDict, total=False):
    jd_id: int
    job_context: Optional[dict]
    candidates: Optional[list]
    rankings: Optional[list]
    error: Optional[str]
    execution_id: str


class SkillsGapState(TypedDict, total=False):
    candidate_id: int
    jd_id: int
    required_skills: Optional[list]
    candidate_skills: Optional[list]
    skills_gap: Optional[dict]
    error: Optional[str]
    execution_id: str
