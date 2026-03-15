"""State schema for the AI Interview Workflow LangGraph state machine.

Nodes:
  1. load_candidate — fetch candidate profile and resume data
  2. load_job — fetch job description and requirements
  3. generate_interview_plan — create multi-round interview plan
  4. evaluate_answers — run deep evaluation on transcript
  5. generate_report — create recruiter-friendly hiring report
"""
from typing import TypedDict, Optional


class AIInterviewWorkflowState(TypedDict, total=False):
    # Input
    execution_id: str
    user_id: str
    user_role: str
    candidate_id: int
    jd_id: int
    session_id: Optional[int]           # Existing AI interview session ID

    # Loaded context
    candidate_context: Optional[dict]   # Candidate profile, resume, skills
    job_context: Optional[dict]         # JD, requirements, rubric
    transcript: Optional[list]          # Interview transcript
    proctoring_summary: Optional[dict]  # Proctoring data

    # Generated outputs
    interview_plan: Optional[dict]      # Multi-round plan
    interview_state: Optional[dict]     # Adaptive interview state
    evaluation: Optional[dict]          # Deep evaluation result
    recruiter_report: Optional[dict]    # Structured recruiter report

    # Workflow control
    error: Optional[str]
    retry_count: int
    provider: str
