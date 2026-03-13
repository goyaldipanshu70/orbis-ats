"""Node that analyzes job description text for biased language."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert in inclusive language and DEI in hiring. Analyze the job description for biased language.

Check for:
- Gendered language (e.g., "rockstar", "ninja", "he/his", "manpower")
- Age bias (e.g., "young and energetic", "digital native", "recent graduate")
- Ability bias (e.g., "must be able to stand", unnecessary physical requirements)
- Exclusionary language (e.g., "native English speaker", "culture fit")
- Unnecessarily aggressive tone (e.g., "crush it", "war room", "killer instinct")

Return ONLY valid JSON:
{
  "score": 85,
  "flags": [
    {
      "phrase": "the exact phrase found",
      "type": "gendered|age|ability|exclusionary|aggressive",
      "suggestion": "suggested replacement phrase",
      "start": 0,
      "end": 10
    }
  ]
}

Score: 100 = perfectly inclusive, 0 = heavily biased. Deduct ~5 points per flag.
If no issues found, return {"score": 100, "flags": []}.
"""

@logged_node("jd_bias_check", "analyze_bias")
async def analyze_bias(state: dict) -> dict:
    """Analyze text for biased language."""
    text = state["text"]
    if not text or len(text.strip()) < 20:
        return {"score": 100, "flags": []}

    llm = get_llm_for_workflow("jd_bias_check", temperature=0.1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze this job description:\n\n{text}"},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        result = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse bias check response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {
        "score": result.get("score", 100),
        "flags": result.get("flags", []),
    }
