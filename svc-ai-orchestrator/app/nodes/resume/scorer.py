"""Resume scoring node: call AI service to score the resume against JD rubric."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("score_resume", "llm_call")
async def score_resume_node(state: dict) -> dict:
    """Call svc-ai-resume to analyze and score the resume."""
    resume_text = state.get("resume_text")
    parsed_jd = state.get("parsed_jd", {})
    rubric_text = state.get("rubric_text", "")

    if not resume_text:
        return {"error": "No resume text available for scoring"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_RESUME_URL}/resume/analyze",
            json={
                "resume_text": resume_text,
                "parsed_jd": parsed_jd,
                "rubric_text": rubric_text,
            },
            timeout=180,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "category_scores": data.get("category_scores"),
                "ai_recommendation": data.get("ai_recommendation"),
                "highlighted_skills": data.get("highlighted_skills"),
                "red_flags": data.get("red_flags"),
                "notes": data.get("notes"),
                "error": None,
            }
        else:
            return {"error": f"Resume scoring failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Resume scoring error")
        return {"error": str(e)}
