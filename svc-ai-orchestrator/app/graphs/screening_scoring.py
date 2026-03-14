"""LangGraph workflow for screening response scoring."""
from langgraph.graph import StateGraph, END
from app.schemas.screening_state import ScreeningScoringState
from app.shared.graph_logging import logged_node

@logged_node("screening_scoring", "score_responses")
async def score_responses_node(state: dict) -> dict:
    """Wrapper node that calls score_screening_responses with DB session."""
    from app.db.postgres import recruiting_db_session
    from app.nodes.screening.scorer import score_screening_responses
    async with recruiting_db_session() as db:
        result = await score_screening_responses(db, state["candidate_id"], state["jd_id"])
    return result

def build_screening_scoring_graph():
    graph = StateGraph(ScreeningScoringState)
    graph.add_node("score_responses", score_responses_node)
    graph.set_entry_point("score_responses")
    graph.add_edge("score_responses", END)
    return graph.compile()

screening_scoring_graph = build_screening_scoring_graph()
