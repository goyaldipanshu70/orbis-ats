from pydantic import BaseModel
from typing import Optional, List


class ScreeningQuestionCreate(BaseModel):
    question: str
    question_type: str = "text"  # text, multiple_choice, yes_no
    options: Optional[List[str]] = None
    required: bool = True
    sort_order: int = 0


class ScreeningQuestionUpdate(BaseModel):
    question: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[List[str]] = None
    required: Optional[bool] = None
    sort_order: Optional[int] = None


class ScreeningResponseCreate(BaseModel):
    question_id: int
    response: str


class ScreeningResponseBulk(BaseModel):
    responses: List[ScreeningResponseCreate]
