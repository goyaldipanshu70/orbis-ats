"""Interview eval node: call AI service to evaluate the interview transcript."""
import logging

from app.core.http_client import get_ai_client
from app.core.config import settings
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("evaluate", "llm_call")
async def evaluate_node(state: dict) -> dict:
    """Call svc-ai-interview to analyze the transcript."""
    transcript_text = state.get("transcript_text")
    if not transcript_text:
        return {"error": "No transcript text available for evaluation"}

    try:
        client = get_ai_client()
        resp = await client.post(
            f"{settings.AI_INTERVIEW_URL}/interview/analyze",
            json={
                "transcript_text": transcript_text,
                "parsed_jd": state.get("parsed_jd", {}),
                "parsed_resume": state.get("parsed_resume", {}),
                "rubric_text": state.get("rubric_text", ""),
                "model_answer_text": state.get("model_answer_text", ""),
            },
            timeout=180,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "score_breakdown": data.get("score_breakdown"),
                "ai_recommendation": data.get("ai_recommendation"),
                "red_flags": data.get("red_flags"),
                "overall_impression": data.get("overall_impression"),
                "error": None,
            }
        else:
            return {"error": f"Interview evaluation failed: {resp.status_code}"}
    except Exception as e:
        logger.exception("Interview evaluation error")
        return {"error": str(e)}
