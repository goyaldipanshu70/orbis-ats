"""Lead generation node: extract structured candidate profiles from raw search results."""
import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

EXTRACTOR_SYSTEM_PROMPT = """You are a candidate profile extraction assistant. Given a list of web search results (titles, URLs, and content snippets), extract structured candidate profiles.

For each result that appears to be a real person's professional profile, extract:
- name: the person's full name (or "Unknown" if not clear)
- title: their current job title
- company: their current or most recent company
- location: their location if mentioned
- skills: a list of technical/professional skills mentioned
- experience_years: estimated years of experience (integer or null)
- source_platform: the platform the result came from (linkedin, github, stackoverflow, job_board)
- source_url: the URL of the result
- email: their email if visible (usually null)

Return ONLY a JSON array of profile objects. If a search result is not a candidate profile (e.g., it's an article or job posting), skip it. Return an empty array if no profiles are found.

Output format: a raw JSON array, no markdown fences."""


@logged_node("extract_profiles", "llm_call")
async def extract_profiles_node(state: dict) -> dict:
    """Use LLM to extract structured candidate profiles from raw search results."""
    raw_results = state.get("raw_search_results", [])
    if not raw_results:
        return {"extracted_profiles": [], "error": None}

    provider = state.get("provider")
    llm = get_llm_for_workflow("lead_generation", temperature=0.1)

    # Build the input for the LLM
    results_text = json.dumps(raw_results, indent=2, default=str)

    messages = [
        SystemMessage(content=EXTRACTOR_SYSTEM_PROMPT),
        HumanMessage(content=f"Extract candidate profiles from these search results:\n\n{results_text}"),
    ]

    response = await llm.ainvoke(messages)
    content = response.content.strip()

    # Parse the JSON response
    try:
        # Strip markdown fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        profiles = json.loads(content)
        if not isinstance(profiles, list):
            profiles = []
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse LLM extraction response: %s", e)
        profiles = []

    logger.info("Extracted %d candidate profiles from %d search results", len(profiles), len(raw_results))
    return {"extracted_profiles": profiles, "error": None}
