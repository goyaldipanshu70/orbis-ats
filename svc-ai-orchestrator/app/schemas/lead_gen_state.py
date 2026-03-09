from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class LeadGenState(TypedDict):
    messages: Annotated[list, add_messages]
    execution_id: str
    user_id: str
    user_role: str
    provider: str
    # Input
    search_criteria: dict  # {role, skills, location, experience, platforms, jd_context}
    jd_id: Optional[int]
    # Pipeline
    raw_search_results: list[dict]
    extracted_profiles: list[dict]
    scored_leads: list[dict]
    # Control
    iteration_count: int
    max_iterations: int
    platforms_searched: list[str]
    error: Optional[str]
