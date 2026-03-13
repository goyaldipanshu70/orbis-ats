"""Node that performs semantic skill matching using LLM."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a technical recruiter expert at matching candidate skills to job requirements.

Given a list of REQUIRED skills (from the job) and CANDIDATE skills (from their resume), determine which required skills the candidate has — even if phrased differently.

For example:
- "project management" matches "program leadership" (confidence: 0.85)
- "Linux" matches "Ubuntu" (confidence: 0.90)
- "React" matches "React.js" (confidence: 1.0)
- "machine learning" does NOT match "data entry" (no match)

Return ONLY valid JSON:
{
  "matched": [
    {"required_skill": "React", "candidate_skill": "React.js", "confidence": 1.0}
  ],
  "missing": ["skill not found in candidate"],
  "bonus": ["candidate skill not in requirements but valuable"]
}

Only match with confidence >= 0.6. Be accurate — do not force matches.
"""


@logged_node("skills_gap", "semantic_match")
async def semantic_match(state: dict) -> dict:
    """Perform semantic skill matching."""
    required = state.get("required_skills", [])
    candidate = state.get("candidate_skills", [])

    if not required:
        return {"skills_gap": {"match_pct": 0, "matched": [], "missing": [], "bonus": candidate}}

    if not candidate:
        return {"skills_gap": {"match_pct": 0, "matched": [], "missing": required, "bonus": []}}

    llm = get_llm_for_workflow("skills_gap", temperature=0.1)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Required skills: {json.dumps(required)}\nCandidate skills: {json.dumps(candidate)}"},
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
        logger.error(f"Failed to parse skills gap response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    matched = result.get("matched", [])
    missing = result.get("missing", [])
    bonus = result.get("bonus", [])
    match_pct = round((len(matched) / len(required)) * 100) if required else 0

    return {
        "skills_gap": {
            "match_pct": match_pct,
            "matched": matched,
            "missing": missing,
            "bonus": bonus,
        }
    }
