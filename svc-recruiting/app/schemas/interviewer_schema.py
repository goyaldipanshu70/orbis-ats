from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class InterviewerInviteRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    specializations: Optional[List[str]] = None
    seniority: Optional[str] = None
    department: Optional[str] = None


class InterviewerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    specializations: Optional[List[str]] = None
    seniority: Optional[str] = None
    department: Optional[str] = None
    max_interviews_per_week: Optional[int] = None


class InterviewerProfileResponse(BaseModel):
    id: int
    user_id: int
    email: str
    full_name: str
    specializations: Optional[List[str]] = None
    seniority: Optional[str] = None
    department: Optional[str] = None
    max_interviews_per_week: int = 5
    is_active: bool = True
    total_interviews: int = 0
    avg_rating_given: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterviewerStatsResponse(BaseModel):
    upcoming_count: int = 0
    completed_this_month: int = 0
    pending_feedback: int = 0
    avg_rating_given: Optional[float] = None
    total_interviews: int = 0
