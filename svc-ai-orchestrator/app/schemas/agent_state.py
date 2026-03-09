from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class HiringAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    execution_id: str
    user_id: str
    user_name: str
    user_role: str
    conversation_id: Optional[str]
    db_context: str
    tools_called: list[dict]
    iteration_count: int
    max_iterations: int
    final_answer: Optional[str]
    structured_data: Optional[dict]
    web_search_enabled: bool
    file_context: Optional[str]
    provider: str
    error: Optional[str]
