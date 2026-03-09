"""Lead generation node: build the final response summary."""
import logging

from langchain_core.messages import AIMessage

from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)


@logged_node("finalize_leads", "data_load")
async def finalize_leads_node(state: dict) -> dict:
    """Build a summary of the lead generation results."""
    scored_leads = state.get("scored_leads", [])
    platforms = state.get("platforms_searched", [])
    criteria = state.get("search_criteria", {})

    role = criteria.get("role", "candidate")
    total = len(scored_leads)
    high_quality = len([l for l in scored_leads if l.get("relevance_score", 0) >= 70])

    summary_lines = [
        f"## Lead Generation Results for: {role}",
        f"**Platforms searched:** {', '.join(platforms) if platforms else 'None'}",
        f"**Total leads found:** {total}",
        f"**High-quality leads (score >= 70):** {high_quality}",
        "",
    ]

    if scored_leads:
        summary_lines.append("### Top Candidates")
        for i, lead in enumerate(scored_leads[:10], 1):
            name = lead.get("name", "Unknown")
            title = lead.get("title", "N/A")
            company = lead.get("company", "N/A")
            score = lead.get("relevance_score", 0)
            reason = lead.get("match_reason", "")
            source = lead.get("source_platform", "")
            summary_lines.append(f"{i}. **{name}** — {title} at {company} (Score: {score}, via {source})")
            if reason:
                summary_lines.append(f"   _{reason}_")
    else:
        summary_lines.append("No matching candidates were found. Try broadening your search criteria.")

    summary = "\n".join(summary_lines)

    return {
        "messages": [AIMessage(content=summary)],
        "iteration_count": 1,
    }
