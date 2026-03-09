"""Resume scoring node: validate output and produce final recommendation."""
import logging

from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("validate_output", "decision")
async def validate_output_node(state: dict) -> dict:
    """Validate the scoring output and ensure all required fields are present."""
    scores = state.get("category_scores")
    if not scores:
        return {"error": "No scoring data available"}

    # Validate required score categories exist
    required_keys = {"total_score"}
    if not required_keys.issubset(set(scores.keys())):
        return {"error": f"Missing required score keys: {required_keys - set(scores.keys())}"}

    return {"error": None}
