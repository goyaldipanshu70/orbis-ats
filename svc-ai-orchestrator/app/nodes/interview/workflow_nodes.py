"""LangGraph nodes for the AI Interview Workflow.

Nodes:
  1. load_candidate — fetch candidate profile and resume data
  2. load_job — fetch job description and requirements
  3. generate_plan — create multi-round interview plan via svc-ai-interview
  4. evaluate_answers — run deep evaluation on transcript
  5. generate_report — create recruiter-friendly hiring report
"""
import logging

from app.core.http_client import get_http_client
from app.core.config import settings
from app.db.postgres import recruiting_db_session
from app.shared.graph_logging import logged_node

logger = logging.getLogger(__name__)

AI_INTERVIEW_URL = getattr(settings, "AI_INTERVIEW_URL", "http://localhost:8012")


@logged_node("load_candidate", "data_load")
async def load_candidate_node(state: dict) -> dict:
    """Load candidate profile and resume data from recruiting DB."""
    candidate_id = state.get("candidate_id")
    jd_id = state.get("jd_id")

    if not candidate_id:
        return {"error": "candidate_id is required"}

    try:
        from app.tools.hiring_tools import _models_cache
        m = _models_cache()
        CandidateJobEntry = m["CandidateJobEntry"]
        CandidateProfile = m["CandidateProfile"]

        from sqlalchemy import select
        async with recruiting_db_session() as db:
            entry = (await db.execute(
                select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
            )).scalar_one_or_none()

            if not entry:
                return {"error": f"Candidate {candidate_id} not found"}

            profile = None
            if entry.profile_id:
                profile = (await db.execute(
                    select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
                )).scalar_one_or_none()

            candidate_context = {
                "name": profile.full_name if profile else "Unknown",
                "email": profile.email if profile else "",
                "resume_analysis": entry.ai_resume_analysis if isinstance(entry.ai_resume_analysis, dict) else {},
                "pipeline_stage": entry.pipeline_stage,
                "skills": [],
            }

            # Extract skills from resume analysis
            resume = candidate_context["resume_analysis"]
            if resume:
                candidate_context["skills"] = resume.get("highlighted_skills", [])

            return {"candidate_context": candidate_context, "error": None}

    except Exception as e:
        logger.error("load_candidate error: %s", e)
        return {"error": str(e)}


@logged_node("load_job", "data_load")
async def load_job_node(state: dict) -> dict:
    """Load job description and requirements from recruiting DB."""
    jd_id = state.get("jd_id")
    if not jd_id:
        return {"error": "jd_id is required"}

    try:
        from app.tools.hiring_tools import _models_cache
        m = _models_cache()
        JobDescription = m["JobDescription"]

        from sqlalchemy import select
        async with recruiting_db_session() as db:
            jd = (await db.execute(
                select(JobDescription).where(JobDescription.id == jd_id)
            )).scalar_one_or_none()

            if not jd:
                return {"error": f"Job {jd_id} not found"}

            ai_result = jd.ai_result if isinstance(jd.ai_result, dict) else {}

            job_context = {
                "title": ai_result.get("job_title", "Unknown"),
                "description": ai_result.get("summary", ""),
                "rubric": ai_result.get("extracted_rubric", {}),
                "core_skills": ai_result.get("extracted_rubric", {}).get("core_skills", []),
                "preferred_skills": ai_result.get("extracted_rubric", {}).get("preferred_skills", []),
                "seniority": ai_result.get("seniority_level", "mid"),
                "department": ai_result.get("department", ""),
            }

            return {"job_context": job_context, "error": None}

    except Exception as e:
        logger.error("load_job error: %s", e)
        return {"error": str(e)}


@logged_node("generate_plan", "ai_call")
async def generate_plan_node(state: dict) -> dict:
    """Generate a multi-round interview plan via svc-ai-interview."""
    job_context = state.get("job_context", {})
    candidate_context = state.get("candidate_context", {})

    if not job_context:
        return {"error": "job_context not loaded"}

    try:
        client = get_http_client()
        resp = await client.post(
            f"{AI_INTERVIEW_URL}/conversation/plan/multi-round",
            json={
                "parsed_jd": job_context,
                "parsed_resume": candidate_context.get("resume_analysis", {}),
                "interview_type": "mixed",
                "include_coding": True,
                "max_questions": 10,
            },
            timeout=60,
        )

        if resp.status_code != 200:
            return {"error": f"Plan generation failed: {resp.text}"}

        result = resp.json()
        return {
            "interview_plan": result.get("plan", result),
            "interview_state": result.get("interview_state", {}),
            "error": None,
        }

    except Exception as e:
        logger.error("generate_plan error: %s", e)
        return {"error": str(e)}


@logged_node("evaluate_answers", "ai_call")
async def evaluate_answers_node(state: dict) -> dict:
    """Run deep evaluation on the interview transcript."""
    transcript = state.get("transcript", [])
    job_context = state.get("job_context", {})
    candidate_context = state.get("candidate_context", {})
    interview_plan = state.get("interview_plan", {})
    interview_state = state.get("interview_state", {})
    proctoring_summary = state.get("proctoring_summary", {})

    if not transcript:
        return {"error": "No transcript to evaluate"}

    try:
        client = get_http_client()
        resp = await client.post(
            f"{AI_INTERVIEW_URL}/conversation/evaluate/deep",
            json={
                "transcript": transcript,
                "parsed_jd": job_context,
                "parsed_resume": candidate_context.get("resume_analysis", {}),
                "interview_plan": interview_plan,
                "interview_state": interview_state,
                "proctoring_summary": proctoring_summary,
            },
            timeout=120,
        )

        if resp.status_code != 200:
            return {"error": f"Evaluation failed: {resp.text}"}

        evaluation = resp.json()
        return {"evaluation": evaluation, "error": None}

    except Exception as e:
        logger.error("evaluate_answers error: %s", e)
        return {"error": str(e)}


@logged_node("generate_report", "ai_call")
async def generate_report_node(state: dict) -> dict:
    """Generate a structured recruiter report."""
    evaluation = state.get("evaluation", {})
    job_context = state.get("job_context", {})
    candidate_context = state.get("candidate_context", {})
    transcript = state.get("transcript", [])
    interview_plan = state.get("interview_plan", {})
    proctoring_summary = state.get("proctoring_summary", {})

    if not evaluation:
        return {"error": "No evaluation to generate report from"}

    try:
        client = get_http_client()
        resp = await client.post(
            f"{AI_INTERVIEW_URL}/conversation/report",
            json={
                "evaluation": evaluation,
                "parsed_jd": job_context,
                "parsed_resume": candidate_context.get("resume_analysis", {}),
                "transcript": transcript,
                "interview_plan": interview_plan,
                "proctoring_summary": proctoring_summary,
            },
            timeout=60,
        )

        if resp.status_code != 200:
            return {"error": f"Report generation failed: {resp.text}"}

        recruiter_report = resp.json()
        return {"recruiter_report": recruiter_report, "error": None}

    except Exception as e:
        logger.error("generate_report error: %s", e)
        return {"error": str(e)}
