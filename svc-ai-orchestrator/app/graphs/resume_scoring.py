"""LangGraph state machine for Resume Scoring.

Flow:
  START → load_resume → extract_metadata → score_resume
    → should_retry?
      ├─ retry → extract_metadata (loop)
      └─ continue → validate_output → END
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.resume_state import ResumeScoringState
from app.nodes.resume.loader import load_resume_node
from app.nodes.resume.metadata_extractor import extract_metadata_node
from app.nodes.resume.scorer import score_resume_node
from app.nodes.resume.recommender import validate_output_node
from app.shared.retry_node import should_retry, increment_retry

logger = logging.getLogger(__name__)


def _should_retry_extraction(state: ResumeScoringState) -> str:
    """Check if metadata extraction should be retried."""
    if state.get("error") and state.get("retry_count", 0) < 3:
        return "retry"
    return "continue"


async def _increment_retry_node(state: dict) -> dict:
    return increment_retry(state)


def build_resume_scoring_graph() -> StateGraph:
    graph = StateGraph(ResumeScoringState)

    graph.add_node("load_resume", load_resume_node)
    graph.add_node("extract_metadata", extract_metadata_node)
    graph.add_node("score_resume", score_resume_node)
    graph.add_node("increment_retry", _increment_retry_node)
    graph.add_node("validate_output", validate_output_node)

    graph.set_entry_point("load_resume")

    graph.add_edge("load_resume", "extract_metadata")
    graph.add_edge("extract_metadata", "score_resume")

    graph.add_conditional_edges(
        "score_resume",
        _should_retry_extraction,
        {
            "retry": "increment_retry",
            "continue": "validate_output",
        },
    )

    graph.add_edge("increment_retry", "extract_metadata")
    graph.add_edge("validate_output", END)

    return graph.compile()


resume_scoring_graph = build_resume_scoring_graph()
