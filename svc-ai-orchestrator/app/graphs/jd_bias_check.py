"""LangGraph workflow for JD bias detection."""
from langgraph.graph import StateGraph, END
from app.schemas.jd_state import JDBiasCheckState
from app.nodes.jd.bias_checker import analyze_bias

def build_jd_bias_check_graph():
    graph = StateGraph(JDBiasCheckState)
    graph.add_node("analyze_bias", analyze_bias)
    graph.set_entry_point("analyze_bias")
    graph.add_edge("analyze_bias", END)
    return graph.compile()

jd_bias_check_graph = build_jd_bias_check_graph()
