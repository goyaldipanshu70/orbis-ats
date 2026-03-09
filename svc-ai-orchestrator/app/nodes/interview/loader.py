"""Interview eval node: load transcript and supporting documents."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("load_inputs", "data_load")
async def load_inputs_node(state: dict) -> dict:
    """Load transcript text from URL."""
    transcript_url = state.get("transcript_url", "")
    if not transcript_url:
        return {"error": "No transcript URL provided"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_INTERVIEW_URL}/interview/parse",
            json={"file_url": transcript_url},
            timeout=120,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"transcript_text": data.get("text", ""), "error": None}
        else:
            return {"transcript_text": None, "error": f"Transcript parse failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Failed to load transcript")
        return {"transcript_text": None, "error": str(e)}
