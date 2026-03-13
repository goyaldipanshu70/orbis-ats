"""LangGraph workflow for semantic skills gap analysis."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import SkillsGapState
from app.nodes.candidate.skills_gap import semantic_match


def build_skills_gap_graph():
    graph = StateGraph(SkillsGapState)
    graph.add_node("semantic_match", semantic_match)
    graph.set_entry_point("semantic_match")
    graph.add_edge("semantic_match", END)
    return graph.compile()


skills_gap_graph = build_skills_gap_graph()
