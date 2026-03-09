"""Lead generation node: score extracted profiles against search criteria."""
import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SCORER_SYSTEM_PROMPT = """You are a candidate relevance scoring assistant. Given a list of candidate profiles and search criteria, score each candidate on relevance from 0 to 100.

Scoring factors:
- Role match: Does the candidate's title/experience align with the target role?
- Skills match: How many of the required skills does the candidate have?
- Location match: Is the candidate in or near the desired location?
- Experience match: Does the candidate meet the minimum experience requirement?

{jd_context_section}

For each candidate, return the original profile object with an added "relevance_score" field (integer 0-100) and a brief "match_reason" string explaining the score.

Return ONLY a JSON array sorted by relevance_score descending. No markdown fences."""


@logged_node("score_leads", "llm_call")
async def score_leads_node(state: dict) -> dict:
    """Use LLM to score each extracted profile against search criteria."""
    profiles = state.get("extracted_profiles", [])
    criteria = state.get("search_criteria", {})

    if not profiles:
        return {"scored_leads": [], "error": None}

    provider = state.get("provider")
    llm = get_llm_for_workflow("lead_generation", temperature=0.1)

    # Build JD context section if available
    jd_context = criteria.get("jd_context", "")
    jd_section = ""
    if jd_context:
        jd_section = f"Additional context from the job description for better matching:\n{jd_context}"

    system_prompt = SCORER_SYSTEM_PROMPT.format(jd_context_section=jd_section)

    criteria_text = json.dumps({
        "role": criteria.get("role", ""),
        "skills": criteria.get("skills", []),
        "location": criteria.get("location", ""),
        "experience_min": criteria.get("experience_min"),
    }, indent=2)

    profiles_text = json.dumps(profiles, indent=2, default=str)

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Search criteria:\n{criteria_text}\n\nCandidate profiles to score:\n{profiles_text}"),
    ]

    response = await llm.ainvoke(messages)
    content = response.content.strip()

    # Parse the JSON response
    try:
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        scored = json.loads(content)
        if not isinstance(scored, list):
            scored = []
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse LLM scoring response: %s", e)
        # Fall back: return profiles with default score
        scored = [{**p, "relevance_score": 50, "match_reason": "Scoring unavailable"} for p in profiles]

    # Ensure sorted by score descending
    scored.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

    logger.info("Scored %d leads", len(scored))
    return {"scored_leads": scored, "error": None}
