"""LangGraph workflow for salary estimation."""
from langgraph.graph import StateGraph, END
from app.schemas.salary_state import SalaryEstimateState
from app.nodes.salary.estimator import estimate_salary

def build_salary_estimate_graph():
    graph = StateGraph(SalaryEstimateState)
    graph.add_node("compute_estimate", estimate_salary)
    graph.set_entry_point("compute_estimate")
    graph.add_edge("compute_estimate", END)
    return graph.compile()

salary_estimate_graph = build_salary_estimate_graph()
