"""LangGraph workflow for candidate fit summary."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import CandidateFitState
from app.nodes.candidate.fit_analyzer import analyze_fit


def build_candidate_fit_graph():
    graph = StateGraph(CandidateFitState)
    graph.add_node("analyze_fit", analyze_fit)
    graph.set_entry_point("analyze_fit")
    graph.add_edge("analyze_fit", END)
    return graph.compile()


candidate_fit_graph = build_candidate_fit_graph()
