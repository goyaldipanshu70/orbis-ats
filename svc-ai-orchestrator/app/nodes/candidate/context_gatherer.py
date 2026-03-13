"""Gather candidate and job context from recruiting DB."""
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def gather_candidate_context(db: AsyncSession, candidate_id: int, jd_id: int) -> dict:
    """Fetch all relevant data for a candidate-job pair from recruiting DB."""
    from app.tools.hiring_tools import _models_cache
    m = _models_cache()

    CandidateJobEntry = m["CandidateJobEntry"]
    CandidateProfile = m["CandidateProfile"]
    JobDescription = m["JobDescription"]
    InterviewEvaluation = m["InterviewEvaluation"]
    InterviewerFeedback = m["InterviewerFeedback"]
    InterviewSchedule = m["InterviewSchedule"]
    ScreeningQuestion = m["ScreeningQuestion"]
    ScreeningResponse = m["ScreeningResponse"]

    # Candidate entry
    entry_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.id == candidate_id,
            CandidateJobEntry.jd_id == jd_id,
        )
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return {"error": f"Candidate {candidate_id} not found for job {jd_id}"}

    profile = None
    if entry.profile_id:
        profile_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
        )
        profile = profile_result.scalar_one_or_none()

    # Job description
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return {"error": f"Job {jd_id} not found"}

    ai_result = jd.ai_result if isinstance(jd.ai_result, dict) else {}

    # Interview evaluations — filtered by jd_id
    eval_result = await db.execute(
        select(InterviewEvaluation).where(
            InterviewEvaluation.candidate_id == candidate_id,
            InterviewEvaluation.jd_id == jd_id,
        )
    )
    evaluations = eval_result.scalars().all()

    # Interviewer feedback — filtered by job's interview schedules
    schedule_result = await db.execute(
        select(InterviewSchedule.id).where(
            InterviewSchedule.candidate_id == candidate_id,
            InterviewSchedule.jd_id == jd_id,
        )
    )
    schedule_ids = [s.id for s in schedule_result.scalars().all()]
    feedback_list = []
    if schedule_ids:
        fb_result = await db.execute(
            select(InterviewerFeedback).where(
                InterviewerFeedback.schedule_id.in_(schedule_ids)
            )
        )
        feedback_list = fb_result.scalars().all()

    # Screening — filtered by this job's questions
    sq_result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.jd_id == jd_id)
    )
    questions = sq_result.scalars().all()
    question_ids = [q.id for q in questions]

    responses = []
    if question_ids:
        sr_result = await db.execute(
            select(ScreeningResponse).where(
                ScreeningResponse.candidate_id == candidate_id,
                ScreeningResponse.question_id.in_(question_ids),
            )
        )
        responses = sr_result.scalars().all()

    return {
        "job_context": {
            "title": ai_result.get("job_title", "Unknown"),
            "rubric": ai_result.get("extracted_rubric", {}),
            "core_skills": ai_result.get("extracted_rubric", {}).get("core_skills", []),
            "preferred_skills": ai_result.get("extracted_rubric", {}).get("preferred_skills", []),
        },
        "candidate_context": {
            "name": profile.full_name if profile else "Unknown",
            "email": profile.email if profile else "",
        },
        "resume_analysis": entry.ai_resume_analysis if isinstance(entry.ai_resume_analysis, dict) else {},
        "interview_scores": {
            "evaluations": [
                {
                    "score": e.ai_interview_result.get("score_breakdown", {}) if isinstance(e.ai_interview_result, dict) else {},
                    "recommendation": e.ai_interview_result.get("recommendation", "") if isinstance(e.ai_interview_result, dict) else "",
                }
                for e in evaluations
            ],
            "feedback": [
                {"rating": f.rating, "notes": f.notes or ""}
                for f in feedback_list
            ],
        },
        "screening_data": {
            "questions": [{"id": q.id, "question": q.question, "type": q.question_type} for q in questions],
            "responses": [{"question_id": r.question_id, "response": r.response} for r in responses],
        },
    }
