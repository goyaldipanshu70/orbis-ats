"""Node that generates tailored interview questions."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert interviewer. Generate targeted interview questions for evaluating a candidate.

Consider:
- The job requirements and role level
- The candidate's background and experience gaps
- The interview type (technical, behavioral, culture, general)

Return ONLY valid JSON — an array of questions:
[
  {
    "question": "the interview question",
    "type": "technical|behavioral|situational|culture",
    "rationale": "why this question is relevant for this candidate"
  }
]

Generate 8-12 questions. Mix types appropriately based on the interview_type focus.
For technical interviews: 60% technical, 20% situational, 20% behavioral.
For behavioral interviews: 60% behavioral, 20% situational, 20% culture.
For culture interviews: 50% culture, 30% behavioral, 20% situational.
For general: equal mix.
"""

@logged_node("interview_questions", "generate_questions")
async def generate_questions(state: dict) -> dict:
    """Generate interview questions tailored to candidate and job."""
    job = state.get("job_context", {})
    candidate = state.get("candidate_context", {})
    skills_gap_raw = state.get("skills_gap", [])
    # Ensure skills_gap is a list of strings (may arrive as dict from other workflows)
    if isinstance(skills_gap_raw, dict):
        skills_gap = skills_gap_raw.get("missing", [])
    elif isinstance(skills_gap_raw, list):
        skills_gap = [str(s) for s in skills_gap_raw]
    else:
        skills_gap = []
    interview_type = state.get("interview_type", "general")

    user_prompt = f"""Generate interview questions:

**Job:** {job.get('title', 'Unknown')}
**Key Skills:** {', '.join(job.get('core_skills', [])[:10])}
**Interview Type:** {interview_type}

**Candidate:** {candidate.get('name', 'Unknown')}
**Skills Gaps:** {', '.join(skills_gap[:5]) if skills_gap else 'None identified'}
**Experience Summary:** {candidate.get('summary', 'Not available')}
"""

    llm = get_llm_for_workflow("interview_questions", temperature=0.5)
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
        questions = json.loads(content.strip())
        if not isinstance(questions, list):
            questions = questions.get("questions", [])
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse questions response: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"questions": questions}
