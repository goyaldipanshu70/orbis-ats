"""Interview eval node: validate evaluation output."""
import logging

from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("validate_eval", "decision")
async def validate_eval_node(state: dict) -> dict:
    """Validate the interview evaluation output."""
    breakdown = state.get("score_breakdown")
    if not breakdown:
        return {"error": "No score breakdown available"}

    return {"error": None}
