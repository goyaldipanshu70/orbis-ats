"""Resume scoring node: extract metadata from resume text."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("extract_metadata", "llm_call")
async def extract_metadata_node(state: dict) -> dict:
    """Call AI service to extract structured metadata from resume text."""
    resume_text = state.get("resume_text")
    if not resume_text:
        return {"error": "No resume text available for metadata extraction"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_RESUME_URL}/resume/extract-metadata",
            json={"resume_text": resume_text},
            timeout=120,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"metadata": data, "error": None}
        else:
            return {"metadata": None, "error": f"Metadata extraction failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Metadata extraction error")
        return {"metadata": None, "error": str(e)}
