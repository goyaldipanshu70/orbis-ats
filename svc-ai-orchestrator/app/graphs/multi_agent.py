"""Multi-agent routing stub — future extension point.

This module defines the structure for routing user intents to specialized sub-graphs.
Currently only the hiring agent is fully implemented; other agents are stubs.
"""
from typing import TypedDict, Optional, Annotated
from langgraph.graph.message import add_messages


class MultiAgentState(TypedDict):
    """State for the multi-agent router."""
    intent: str
    active_agent: str
    messages: Annotated[list, add_messages]
    user_id: str
    user_role: str
    execution_id: str
    result: Optional[dict]
    error: Optional[str]


# Intent → sub-agent mapping (stubs for future implementation)
AGENT_REGISTRY = {
    "recruiting": "hiring_agent",      # ← fully implemented
    "sourcing": "sourcing_agent",      # ← stub
    "interviewing": "interview_agent", # ← stub
    "offering": "offer_agent",         # ← stub
    "analytics": "analytics_agent",    # ← stub
}


def classify_intent(query: str) -> str:
    """Classify user query intent. Currently returns 'recruiting' for all queries."""
    # Future: use LLM-based intent classification
    return "recruiting"


def get_agent_for_intent(intent: str) -> str:
    """Return the agent name for a given intent."""
    return AGENT_REGISTRY.get(intent, "hiring_agent")
