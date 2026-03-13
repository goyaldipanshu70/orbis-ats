"""Node that generates a candidate fit summary using LLM."""
import json
import logging
from app.core.llm_provider import get_llm_for_workflow
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior recruiter analyzing a candidate's fit for a specific job.

Given the job requirements, candidate resume analysis, interview results, and screening responses, provide a structured assessment.

Return ONLY valid JSON:
{
  "rating": "Strong|Good|Moderate|Weak",
  "strengths": [
    {"point": "specific strength", "evidence": "evidence from their resume/interviews"}
  ],
  "concerns": ["specific concern 1", "specific concern 2"],
  "recommendation": "2-3 sentence recommendation for the hiring team"
}

Be specific and cite evidence. Max 5 strengths, 3 concerns.
"""


@logged_node("candidate_fit", "analyze_fit")
async def analyze_fit(state: dict) -> dict:
    """Generate candidate fit summary."""
    job = state.get("job_context", {})
    resume = state.get("resume_analysis", {})
    interviews = state.get("interview_scores", {})
    screening = state.get("screening_data", {})
    candidate = state.get("candidate_context", {})

    if not resume:
        return {"error": "No resume analysis available for this candidate"}

    user_prompt = f"""Analyze this candidate's fit:

**Job:** {job.get('title', 'Unknown')}
**Core Skills Required:** {', '.join(job.get('core_skills', []))}
**Preferred Skills:** {', '.join(job.get('preferred_skills', []))}

**Candidate:** {candidate.get('name', 'Unknown')}
**Resume Highlights:** {json.dumps(resume.get('highlighted_skills', []))}
**Resume Score:** {resume.get('category_scores', {}).get('total_score', 'N/A')}
**Resume Summary:** {resume.get('metadata', {}).get('summary', 'N/A')}

**Interview Evaluations:** {json.dumps(interviews.get('evaluations', [])[:3])}
**Interviewer Feedback:** {json.dumps(interviews.get('feedback', [])[:5])}

**Screening:** {len(screening.get('responses', []))} of {len(screening.get('questions', []))} questions answered
"""

    llm = get_llm_for_workflow("candidate_fit", temperature=0.2)
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
        summary = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Failed to parse fit summary: {e}")
        return {"error": f"Failed to parse AI response: {e}"}

    return {"fit_summary": summary}
