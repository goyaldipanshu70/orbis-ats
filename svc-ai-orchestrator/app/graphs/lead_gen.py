"""LangGraph state machine for Lead Generation.

Flow:
  START -> search_candidates -> extract_profiles -> score_leads -> finalize_leads -> END
"""
import logging

from langgraph.graph import StateGraph, END

from app.schemas.lead_gen_state import LeadGenState
from app.nodes.lead_gen.search_node import search_candidates_node
from app.nodes.lead_gen.extractor_node import extract_profiles_node
from app.nodes.lead_gen.scorer_node import score_leads_node
from app.nodes.lead_gen.finalizer_node import finalize_leads_node

logger = logging.getLogger(__name__)


def build_lead_gen_graph() -> StateGraph:
    """Build and compile the lead generation LangGraph."""
    graph = StateGraph(LeadGenState)

    # Add nodes
    graph.add_node("search_candidates", search_candidates_node)
    graph.add_node("extract_profiles", extract_profiles_node)
    graph.add_node("score_leads", score_leads_node)
    graph.add_node("finalize_leads", finalize_leads_node)

    # Set entry point
    graph.set_entry_point("search_candidates")

    # Linear flow
    graph.add_edge("search_candidates", "extract_profiles")
    graph.add_edge("extract_profiles", "score_leads")
    graph.add_edge("score_leads", "finalize_leads")
    graph.add_edge("finalize_leads", END)

    return graph.compile()


# Compiled graph singleton
lead_gen_graph = build_lead_gen_graph()
