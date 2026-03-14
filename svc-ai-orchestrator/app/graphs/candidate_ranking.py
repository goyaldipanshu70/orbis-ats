"""LangGraph workflow for candidate ranking."""
from langgraph.graph import StateGraph, END
from app.schemas.candidate_state import CandidateRankingState
from app.shared.graph_logging import logged_node


@logged_node("candidate_ranking", "compute_rankings")
async def compute_rankings_node(state: dict) -> dict:
    """Wrapper node that calls compute_rankings with DB session."""
    from app.db.postgres import recruiting_db_session
    from app.nodes.candidate.ranker import compute_rankings
    async with recruiting_db_session() as db:
        rankings = await compute_rankings(db, state["jd_id"])
    return {"rankings": rankings}


def build_candidate_ranking_graph():
    graph = StateGraph(CandidateRankingState)
    graph.add_node("compute_rankings", compute_rankings_node)
    graph.set_entry_point("compute_rankings")
    graph.add_edge("compute_rankings", END)
    return graph.compile()


candidate_ranking_graph = build_candidate_ranking_graph()
