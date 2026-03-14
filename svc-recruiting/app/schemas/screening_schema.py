from pydantic import BaseModel
from typing import Optional, List


class ScreeningQuestionCreate(BaseModel):
    question: str
    question_type: str = "text"  # text, multiple_choice, yes_no, numeric, date
    options: Optional[List[str]] = None
    required: bool = True
    sort_order: int = 0
    is_knockout: bool = False
    knockout_condition: Optional[str] = None  # e.g. "equals:No", "less_than:2", "must_be:Yes"
    is_template: bool = False
    template_category: Optional[str] = None  # e.g. "logistics", "eligibility", "experience"


class ScreeningQuestionUpdate(BaseModel):
    question: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[List[str]] = None
    required: Optional[bool] = None
    sort_order: Optional[int] = None
    is_knockout: Optional[bool] = None
    knockout_condition: Optional[str] = None


class ScreeningResponseCreate(BaseModel):
    question_id: int
    response: str


class ScreeningResponseBulk(BaseModel):
    responses: List[ScreeningResponseCreate]


class TemplateQuestionCreate(BaseModel):
    question: str
    question_type: str = "text"
    options: Optional[List[str]] = None
    category: str = "general"
    is_knockout: bool = False
    knockout_condition: Optional[str] = None
