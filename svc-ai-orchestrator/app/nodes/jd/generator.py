"""Node that generates a structured job description from a title and context."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert HR professional and technical writer. Generate a comprehensive, inclusive job description.

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence role overview",
  "responsibilities": ["responsibility 1", "responsibility 2", ...],
  "requirements": ["requirement 1", "requirement 2", ...],
  "qualifications": ["preferred qualification 1", ...],
  "benefits": ["benefit 1", "benefit 2", ...]
}

Guidelines:
- Use gender-neutral language throughout
- Be specific about the role, not generic
- Requirements should be genuinely necessary, not aspirational
- Include 6-10 responsibilities, 5-8 requirements, 3-5 qualifications, 4-6 benefits
"""

@logged_node("jd_generation", "generate_jd")
async def generate_jd(state: dict) -> dict:
    """Generate a structured job description."""
    title = state["job_title"]
    dept = state.get("department", "")
    seniority = state.get("seniority", "")
    location = state.get("location", "")
    context = state.get("additional_context", "")

    user_prompt = f"Generate a job description for: {title}"
    if dept:
        user_prompt += f"\nDepartment: {dept}"
    if seniority:
        user_prompt += f"\nSeniority: {seniority}"
    if location:
        user_prompt += f"\nLocation: {location}"
    if context:
        user_prompt += f"\nAdditional context: {context}"

    llm = get_llm_for_workflow("jd_generation", temperature=0.4)
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
        generated = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse JD response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"generated_jd": generated}
