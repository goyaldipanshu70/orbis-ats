from enum import Enum 
from typing import List, Optional
from pydantic import BaseModel, HttpUrl

class ResumeAnalyzerInput(BaseModel):
    resume_file_link: HttpUrl
    parsed_jd: dict
    rubric_text: str


class ResumeMetadataExtractInput(BaseModel):
    resume_file_link: HttpUrl


# ── Deep extraction sub-models ──────────────────────────────────────────

class EducationEntry(BaseModel):
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[int] = None
    gpa: Optional[str] = None
    honors: Optional[str] = None


class WorkExperienceEntry(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    responsibilities: List[str] = []


class ProjectEntry(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = []
    url: Optional[str] = None


class CertificationEntry(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    year: Optional[int] = None
    expiry_year: Optional[int] = None
    credential_id: Optional[str] = None


class LanguageEntry(BaseModel):
    language: str
    proficiency: Optional[str] = None


class SocialLinks(BaseModel):
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    leetcode_url: Optional[str] = None
    hackerrank_url: Optional[str] = None
    stackoverflow_url: Optional[str] = None
    twitter_url: Optional[str] = None
    personal_website: Optional[str] = None
    portfolio_url: Optional[str] = None
    other_urls: List[str] = []


# ── Main extraction output ──────────────────────────────────────────────

class ResumeMetadataExtractOutput(BaseModel):
    full_name: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    current_role: Optional[str] = None
    years_of_experience: Optional[float] = None
    summary: Optional[str] = None
    objective: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: List[str] = []
    education: List[EducationEntry] = []
    work_experience: List[WorkExperienceEntry] = []
    projects: List[ProjectEntry] = []
    certifications: List[CertificationEntry] = []
    languages: List[LanguageEntry] = []
    links: Optional[SocialLinks] = None

class EnhancedCategoryScore(BaseModel):
    technical_skills: int
    experience_depth: int
    role_alignment: int
    education_credentials: int
    industry_expertise: int
    leadership_potential: int
    career_progression: int
    soft_skills: int

class DetailedAnalysis(BaseModel):
    strengths: List[str]
    areas_for_development: List[str]
    unique_value_propositions: List[str]
    risk_factors: List[str]

class ResumeMetadata(BaseModel):
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    current_role: Optional[str]
    years_of_experience: Optional[float]
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None

class AIRecommendation(str, Enum):
    INTERVIEW_IMMEDIATELY = "Interview Immediately"
    INTERVIEW = "Interview"
    CONSIDER = "Consider"
    DO_NOT_RECOMMEND = "Do Not Recommend"
    MANUAL_REVIEW_REQUIRED = "Manual Review Required"

class EnhancedResumeAnalyzerOutput(BaseModel):
    metadata: ResumeMetadata
    category_scores: EnhancedCategoryScore
    detailed_analysis: DetailedAnalysis
    red_flags: List[str]
    highlighted_skills: List[str]
    ai_recommendation: AIRecommendation
    recommendation_reasoning: str
    interview_focus_areas: List[str]
    salary_expectation_range: Optional[str]
    notes: Optional[str]

# Keep old schema for backward compatibility
class CategoryScore(BaseModel):
    core_skills: float
    preferred_skills: float
    experience: float
    education: float
    industry_fit: float
    soft_skills: float

class ResumeAnalyzerOutput(BaseModel):
    metadata: ResumeMetadata
    category_scores: CategoryScore
    red_flags: List[str]
    highlighted_skills: List[str]
    ai_recommendation: AIRecommendation
    notes: Optional[str]
