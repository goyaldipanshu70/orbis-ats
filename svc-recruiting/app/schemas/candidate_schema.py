from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class Metadata(BaseModel):
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    current_role: Optional[str]
    years_of_experience: Optional[float]

class CategoryScores(BaseModel):
    core_skills: float
    preferred_skills: float
    experience: float
    education: float
    industry_fit: float
    soft_skills: float

class ScoreDict(BaseModel):
    obtained_score: float
    max_score: float

class CategoryDetailedScores(BaseModel):
    core_skills: ScoreDict
    preferred_skills: ScoreDict
    experience: ScoreDict
    education: ScoreDict
    industry_fit: ScoreDict
    soft_skills: ScoreDict
    total_score: ScoreDict

class EnhancedCategoryDetailedScores(BaseModel):
    technical_skills: ScoreDict
    experience_depth: ScoreDict
    role_alignment: ScoreDict
    education_credentials: ScoreDict
    industry_expertise: ScoreDict
    leadership_potential: ScoreDict
    career_progression: ScoreDict
    soft_skills: ScoreDict
    total_score: ScoreDict

class AIResult(BaseModel):
    metadata: Metadata
    category_scores: CategoryScores
    red_flags: List[str]
    highlighted_skills: List[str]
    ai_recommendation: str
    notes: str

class AIDetailedResult(BaseModel):
    metadata: Metadata
    category_scores: CategoryDetailedScores
    red_flags: List[str]
    highlighted_skills: List[str]
    ai_recommendation: str
    notes: str

class DuplicateInfo(BaseModel):
    profile_id: int
    matched_name: Optional[str] = None
    matched_email: Optional[str] = None
    match_reasons: List[str] = []
    existing_jobs: List[dict] = []
    message: str = "A candidate with matching information already exists."

class CandidateUploadResponse(BaseModel):
    candidate_id: str
    metadata: Optional[Metadata] = None
    category_scores: Optional[dict] = None
    red_flags: Optional[List[str]] = None
    highlighted_skills: Optional[List[str]] = None
    ai_recommendation: Optional[str] = None
    notes: Optional[str] = None
    screening: bool = False
    ai_status: Optional[str] = None
    ai_job_id: Optional[int] = None
    duplicate_info: Optional[DuplicateInfo] = None

class ImportCandidatesRequest(BaseModel):
    target_job_id: str
    candidate_ids: List[str]

class MultipleCandidateResult(BaseModel):
    candidate_id: str
    success: bool
    error: Optional[str] = None
    data: Optional[dict] = None

class MultipleCandidateUploadResponse(BaseModel):
    total_files: int
    successful_uploads: int
    failed_uploads: int
    results: List[MultipleCandidateResult]


# ── Profile / Job Entry schemas (V6 data model) ──────────────────────────

class CandidateProfileResponse(BaseModel):
    id: int
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    photo_url: Optional[str] = None
    status: str = "active"
    category: Optional[str] = None
    notes: Optional[str] = None
    job_count: int = 0
    skills: Optional[List[str]] = None
    experience: Optional[float] = None
    current_role: Optional[str] = None
    location: Optional[str] = None
    created_at: Optional[datetime] = None


class CandidateProfileCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    current_role: Optional[str] = None
    notes: Optional[str] = None
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    photo_url: Optional[str] = None
    parsed_metadata: Optional[dict] = None


class CandidateProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    current_role: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[str] = None


class CheckDuplicateRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None


class CheckDuplicateResponse(BaseModel):
    is_duplicate: bool = False
    duplicate_info: Optional[DuplicateInfo] = None


class CandidateJobEntryResponse(BaseModel):
    id: int
    profile_id: int
    jd_id: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    ai_resume_analysis: Optional[dict] = None
    pipeline_stage: str = "applied"
    onboard: bool = False
    screening: bool = False
    interview_status: bool = False
    source: str = "manual"
    created_at: Optional[datetime] = None

