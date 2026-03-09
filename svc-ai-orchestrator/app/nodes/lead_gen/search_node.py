"""Lead generation node: search for candidate profiles across platforms."""
import logging

from app.tools.web_search import web_search
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

PLATFORM_QUERY_TEMPLATES = {
    "linkedin": 'site:linkedin.com/in {role} {skills} {location}',
    "github": 'site:github.com {skills} developer {location}',
    "stackoverflow": 'site:stackoverflow.com/users {skills} {location}',
    "job_boards": '{role} resume {skills} {location}',
}


def _build_query(platform: str, criteria: dict) -> str:
    """Build a search query string for a given platform and criteria."""
    template = PLATFORM_QUERY_TEMPLATES.get(platform, '{role} {skills} {location}')
    role = criteria.get("role", "")
    skills = " ".join(criteria.get("skills", []))
    location = criteria.get("location", "")
    return template.format(role=role, skills=skills, location=location).strip()


@logged_node("search_candidates", "web_search")
async def search_candidates_node(state: dict) -> dict:
    """Search for candidate profiles across configured platforms."""
    criteria = state.get("search_criteria", {})
    platforms = criteria.get("platforms", ["linkedin", "github"])
    max_per_platform = 10

    all_results = []
    searched = []

    for platform in platforms:
        query = _build_query(platform, criteria)
        if not query:
            continue

        logger.info("Searching %s with query: %s", platform, query)
        response = await web_search(query, max_results=max_per_platform)

        if response.get("success"):
            for r in response.get("results", []):
                r["source_platform"] = platform
            all_results.extend(response.get("results", []))
            searched.append(platform)
        else:
            logger.warning("Search failed for %s: %s", platform, response.get("error"))

    return {
        "raw_search_results": all_results,
        "platforms_searched": searched,
        "error": None,
    }
