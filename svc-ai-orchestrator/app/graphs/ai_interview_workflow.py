"""LangGraph state machine for the AI Interview Workflow.

Flow:
  START → load_candidate → load_job → generate_plan → should_evaluate?
    ├─ has_transcript → evaluate_answers → generate_report → END
    └─ no_transcript → END (plan only)

This workflow can be used in two modes:
1. Plan-only: Generate an interview plan for a candidate-job pair
2. Full evaluation: Load transcript data and generate evaluation + report
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.ai_interview_workflow_state import AIInterviewWorkflowState
from app.nodes.interview.workflow_nodes import (
    load_candidate_node,
    load_job_node,
    generate_plan_node,
    evaluate_answers_node,
    generate_report_node,
)

logger = logging.getLogger(__name__)


def _should_evaluate(state: AIInterviewWorkflowState) -> str:
    """Check if we have a transcript to evaluate, or just return the plan."""
    if state.get("error"):
        return "end"
    if state.get("transcript"):
        return "evaluate"
    return "end"


def _should_report(state: AIInterviewWorkflowState) -> str:
    """Check if evaluation succeeded and we should generate a report."""
    if state.get("error"):
        return "end"
    if state.get("evaluation"):
        return "report"
    return "end"


def build_ai_interview_workflow() -> StateGraph:
    graph = StateGraph(AIInterviewWorkflowState)

    # Add nodes
    graph.add_node("load_candidate", load_candidate_node)
    graph.add_node("load_job", load_job_node)
    graph.add_node("generate_plan", generate_plan_node)
    graph.add_node("evaluate_answers", evaluate_answers_node)
    graph.add_node("generate_report", generate_report_node)

    # Set entry point
    graph.set_entry_point("load_candidate")

    # Linear flow: load_candidate → load_job → generate_plan
    graph.add_edge("load_candidate", "load_job")
    graph.add_edge("load_job", "generate_plan")

    # Conditional: after plan, evaluate if transcript exists
    graph.add_conditional_edges(
        "generate_plan",
        _should_evaluate,
        {
            "evaluate": "evaluate_answers",
            "end": END,
        },
    )

    # Conditional: after evaluation, generate report if eval succeeded
    graph.add_conditional_edges(
        "evaluate_answers",
        _should_report,
        {
            "report": "generate_report",
            "end": END,
        },
    )

    graph.add_edge("generate_report", END)

    return graph.compile()


ai_interview_workflow_graph = build_ai_interview_workflow()
