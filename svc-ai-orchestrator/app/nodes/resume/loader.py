"""Resume scoring node: load resume text from URL."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("load_resume", "data_load")
async def load_resume_node(state: dict) -> dict:
    """Download and extract resume text. Falls back to sending URL to AI service."""
    resume_url = state.get("resume_url", "")
    if not resume_url:
        return {"error": "No resume URL provided"}

    try:
        # Call svc-ai-resume to extract text from the resume
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_RESUME_URL}/resume/parse",
            json={"file_url": resume_url},
            timeout=120,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"resume_text": data.get("text", ""), "error": None}
        else:
            return {"resume_text": None, "error": f"Resume parse failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Failed to load resume")
        return {"resume_text": None, "error": str(e)}
