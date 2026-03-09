from pydantic import BaseModel, HttpUrl
from typing import List, Optional

class JobDescriptionNERInput(BaseModel):
    jd_file_link: HttpUrl

class JobDescriptionRubricInput(BaseModel):
    rubric_file_link: HttpUrl

class JobDescriptionModelAnswerInput(BaseModel):
    model_answer_file_link: HttpUrl
    
class ExperienceRequirement(BaseModel):
    min_years: int
    description: str

class EducationalRequirement(BaseModel):
    degree: Optional[str]
    field: Optional[str] 

class ExtractedRubric(BaseModel):
    core_skills: List[str]
    preferred_skills: List[str]
    experience_requirements: ExperienceRequirement
    educational_requirements: EducationalRequirement
    soft_skills: List[str]
    certifications: List[str]
    role_keywords: List[str]

class RawTextClassification(BaseModel):
    matches_known_roles: bool
    role_category: Optional[str]
    matched_role: Optional[str]

class RoleMatchAndSummary(BaseModel):
    summary: str
    raw_text_classification: RawTextClassification

class JobDescriptionNEROutput(BaseModel):
    job_title: str
    extracted_rubric: ExtractedRubric
    summary: str
    raw_text_classification: RawTextClassification

class JobDescriptionRubricOutput(BaseModel):
    rubric_text: str

class JobDescriptionModelAnswerOutput(BaseModel):
    model_answer_text: str
