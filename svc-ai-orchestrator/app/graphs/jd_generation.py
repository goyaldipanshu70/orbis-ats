"""LangGraph workflow for JD generation."""
from langgraph.graph import StateGraph, END
from app.schemas.jd_state import JDGenerationState
from app.nodes.jd.generator import generate_jd

def build_jd_generation_graph():
    graph = StateGraph(JDGenerationState)
    graph.add_node("generate_jd", generate_jd)
    graph.set_entry_point("generate_jd")
    graph.add_edge("generate_jd", END)
    return graph.compile()

jd_generation_graph = build_jd_generation_graph()
