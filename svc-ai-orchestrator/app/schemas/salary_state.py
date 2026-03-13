"""State for salary estimation workflow."""
from typing import TypedDict, Optional

class SalaryEstimateState(TypedDict, total=False):
    job_title: str
    location: Optional[str]
    country: Optional[str]
    seniority: Optional[str]
    department: Optional[str]
    estimate: Optional[dict]
    error: Optional[str]
    execution_id: str
