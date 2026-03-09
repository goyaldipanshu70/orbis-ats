from pydantic import BaseModel
from typing import Optional, Dict


class OfferCreate(BaseModel):
    candidate_id: int
    template_id: Optional[int] = None
    salary: Optional[float] = None
    salary_currency: str = "USD"
    start_date: Optional[str] = None  # YYYY-MM-DD
    position_title: Optional[str] = None
    department: Optional[str] = None
    variables: Optional[Dict[str, str]] = None


class OfferUpdate(BaseModel):
    salary: Optional[float] = None
    salary_currency: Optional[str] = None
    start_date: Optional[str] = None
    position_title: Optional[str] = None
    department: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[Dict[str, str]] = None


class OfferStatusUpdate(BaseModel):
    status: str  # accepted, declined, withdrawn
