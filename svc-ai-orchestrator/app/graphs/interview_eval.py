"""LangGraph state machine for Interview Evaluation.

Flow:
  START → load_inputs → evaluate → should_retry?
    ├─ retry → evaluate (loop)
    └─ continue → validate_eval → END
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.interview_state import InterviewEvalState
from app.nodes.interview.loader import load_inputs_node
from app.nodes.interview.evaluator import evaluate_node
from app.nodes.interview.scorer import validate_eval_node
from app.shared.retry_node import increment_retry

logger = logging.getLogger(__name__)


def _should_retry_eval(state: InterviewEvalState) -> str:
    if state.get("error") and state.get("retry_count", 0) < 3:
        return "retry"
    return "continue"


async def _increment_retry_node(state: dict) -> dict:
    return increment_retry(state)


def build_interview_eval_graph() -> StateGraph:
    graph = StateGraph(InterviewEvalState)

    graph.add_node("load_inputs", load_inputs_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("increment_retry", _increment_retry_node)
    graph.add_node("validate_eval", validate_eval_node)

    graph.set_entry_point("load_inputs")

    graph.add_edge("load_inputs", "evaluate")

    graph.add_conditional_edges(
        "evaluate",
        _should_retry_eval,
        {
            "retry": "increment_retry",
            "continue": "validate_eval",
        },
    )

    graph.add_edge("increment_retry", "evaluate")
    graph.add_edge("validate_eval", END)

    return graph.compile()


interview_eval_graph = build_interview_eval_graph()
