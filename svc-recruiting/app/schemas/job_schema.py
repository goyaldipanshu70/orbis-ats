from pydantic import BaseModel, Field, HttpUrl, HttpUrl
from typing import Optional, Dict, Any, List
from datetime import datetime


class UploadedFileSchema(BaseModel):
    file_id: str
    file_name: str
    file_type: str  # 'rubric' or 'model_answer'
    display_name: str
    upload_date: datetime
    file_size: int # in bytes

class JobStatisticsSchema(BaseModel):
    total_candidates: int
    recommended_count: int
    under_review_count: int
    not_recommended_count: int

class JDExtractResponse(BaseModel):
    ai_result: Dict[str, Any] = Field(..., description="Extracted AI result from JD file")

class JDSubmitResponse(BaseModel):
    message: str = Field(..., example="JD and optional files saved successfully")
    jd_id: str = Field(..., description="MongoDB ID of the inserted JD document")


class LocationVacancySchema(BaseModel):
    id: int
    country: str
    city: str
    vacancies: int
    hired_count: int
    is_full: bool


class JobResponse(BaseModel):
    job_id: str
    job_title: str
    status: str  # e.g., "Open", "Closed"
    visibility: str = "internal"  # "internal" or "public"
    country: Optional[str] = None
    city: Optional[str] = None
    rubric_summary: str
    uploaded_files: List[UploadedFileSchema]
    statistics: JobStatisticsSchema
    number_of_vacancies: int = 1
    key_requirements: List[str]
    created_date: datetime
    updated_date: datetime # This might be same as created_date initially
    location_vacancies: List[LocationVacancySchema] = []
    # Feature 4: Job Metadata
    job_type: Optional[str] = None
    position_type: Optional[str] = None
    experience_range: Optional[str] = None
    salary_range_min: Optional[float] = None
    salary_range_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_visibility: str = "hidden"
    location_type: Optional[str] = None
    # Feature 13: Hiring Close Date
    hiring_close_date: Optional[datetime] = None

class JobStatusUpdateRequest(BaseModel):
    status: str


class JobEditRequest(BaseModel):
    job_title: Optional[str] = None
    summary: Optional[str] = None
    core_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    experience_description: Optional[str] = None
    education_degree: Optional[str] = None
    education_field: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    number_of_vacancies: Optional[int] = None
    job_type: Optional[str] = None
    position_type: Optional[str] = None
    experience_range: Optional[str] = None
    salary_range_min: Optional[float] = None
    salary_range_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_visibility: Optional[str] = None
    location_type: Optional[str] = None
    hiring_close_date: Optional[str] = None
