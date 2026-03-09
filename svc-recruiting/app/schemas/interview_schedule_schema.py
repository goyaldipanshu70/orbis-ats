from pydantic import BaseModel
from typing import Optional, List


class InterviewScheduleCreate(BaseModel):
    candidate_id: int
    jd_id: int
    interview_type: str = "video"  # phone, video, in_person
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    duration_minutes: int = 60
    location: Optional[str] = None
    interviewer_names: List[str] = []
    notes: Optional[str] = None


class InterviewScheduleUpdate(BaseModel):
    interview_type: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    interviewer_names: Optional[List[str]] = None
    notes: Optional[str] = None


class InterviewStatusUpdate(BaseModel):
    status: str  # scheduled, completed, cancelled, no_show


class PanelRound(BaseModel):
    round_number: int
    round_type: str
    interviewer_ids: List[int] = []
    interviewer_names: List[str] = []
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int = 60
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None


class PanelCreateRequest(BaseModel):
    candidate_id: int
    jd_id: int
    rounds: List[PanelRound]
