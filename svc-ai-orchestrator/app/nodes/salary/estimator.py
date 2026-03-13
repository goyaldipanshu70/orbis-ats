"""Node that estimates salary ranges using LLM."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a compensation analyst. Estimate salary ranges for the given role based on your knowledge of market data.

Return ONLY valid JSON:
{
  "currency": "USD",
  "p25": 85000,
  "p50": 105000,
  "p75": 130000,
  "confidence": "medium",
  "disclaimer": "These are AI-estimated ranges based on general market data. Actual salaries vary by company, location, and candidate experience."
}

Guidelines:
- Use the country/location to determine currency and adjust for cost of living
- If location is unclear, default to USD and US market rates
- p25/p50/p75 represent the 25th, 50th, and 75th percentile annual compensation
- confidence: "high" if common role with clear market data, "medium" if some uncertainty, "low" if niche/unusual role
- Always include the disclaimer
"""

@logged_node("salary_estimate", "estimate")
async def estimate_salary(state: dict) -> dict:
    """Estimate salary range for a job."""
    title = state.get("job_title", "")
    location = state.get("location", "")
    country = state.get("country", "")
    seniority = state.get("seniority", "")
    department = state.get("department", "")

    if not title:
        return {"error": "Job title is required for salary estimation"}

    user_prompt = f"Estimate salary for: {title}"
    if seniority:
        user_prompt += f"\nSeniority: {seniority}"
    if department:
        user_prompt += f"\nDepartment: {department}"
    if location:
        user_prompt += f"\nLocation: {location}"
    if country:
        user_prompt += f"\nCountry: {country}"

    llm = get_llm_for_workflow("salary_estimate", temperature=0.2)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await llm.ainvoke(messages)

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        estimate = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse salary estimate: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"estimate": estimate}
