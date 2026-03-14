"""Node that ranks candidates for a job using composite scoring."""
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def compute_rankings(db: AsyncSession, jd_id: int) -> list[dict]:
    """Compute ranking scores for all candidates in a job."""
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

    # Get job info
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    if not jd:
        return []

    # Get all active candidates for this job
    entries_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    entries = entries_result.scalars().all()
    if not entries:
        return []

    # Get screening questions for THIS job
    sq_result = await db.execute(
        select(ScreeningQuestion).where(ScreeningQuestion.jd_id == jd_id)
    )
    job_questions = sq_result.scalars().all()
    question_ids = [q.id for q in job_questions]
    total_questions = len(job_questions)

    rankings = []
    for entry in entries:
        # Profile
        profile = None
        if entry.profile_id:
            p_result = await db.execute(
                select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
            )
            profile = p_result.scalar_one_or_none()

        # Resume score
        resume_score = 0.0
        ai = entry.ai_resume_analysis if isinstance(entry.ai_resume_analysis, dict) else {}
        total = ai.get("category_scores", {}).get("total_score", 0)
        if isinstance(total, dict):
            resume_score = min(float(total.get("obtained_score", 0)), 100.0)
        elif total:
            resume_score = min(float(total), 100.0)

        # Interview score — filtered by jd_id
        interview_score = 0.0
        eval_result = await db.execute(
            select(InterviewEvaluation).where(
                InterviewEvaluation.candidate_id == entry.id,
                InterviewEvaluation.jd_id == jd_id,
            )
        )
        evals = eval_result.scalars().all()
        if evals:
            scores = []
            for ev in evals:
                air = ev.ai_interview_result if isinstance(ev.ai_interview_result, dict) else {}
                ts = air.get("score_breakdown", {}).get("total_score", 0)
                if isinstance(ts, dict):
                    scores.append(min(float(ts.get("obtained_score", 0)), 100.0))
                elif ts:
                    scores.append(min(float(ts), 100.0))
            if scores:
                interview_score = sum(scores) / len(scores)

        # Feedback score — filtered by job's schedules
        feedback_score = 0.0
        sched_result = await db.execute(
            select(InterviewSchedule.id).where(
                InterviewSchedule.candidate_id == entry.id,
                InterviewSchedule.jd_id == jd_id,
            )
        )
        sched_ids = list(sched_result.scalars().all())
        if sched_ids:
            fb_result = await db.execute(
                select(func.avg(InterviewerFeedback.rating)).where(
                    InterviewerFeedback.schedule_id.in_(sched_ids)
                )
            )
            avg_rating = fb_result.scalar()
            if avg_rating:
                feedback_score = float(avg_rating) * 20  # 1-5 -> 20-100

        # Screening score — filtered by job's questions
        screening_score = 0.0
        if question_ids:
            sr_result = await db.execute(
                select(ScreeningResponse).where(
                    ScreeningResponse.candidate_id == entry.id,
                    ScreeningResponse.question_id.in_(question_ids),
                )
            )
            responses = sr_result.scalars().all()
            if responses and total_questions > 0:
                completion = (len(responses) / total_questions) * 100
                quality_scores = []
                for r in responses:
                    resp_text = r.response or ""
                    words = len(resp_text.split())
                    if words >= 50:
                        quality_scores.append(100)
                    elif words >= 20:
                        quality_scores.append(70)
                    elif words >= 5:
                        quality_scores.append(40)
                    else:
                        quality_scores.append(10)
                avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
                screening_score = (completion * 0.5) + (avg_quality * 0.5)

        # Composite: resume 40%, interview 30%, feedback 20%, screening 10%
        composite = (
            resume_score * 0.4 +
            interview_score * 0.3 +
            feedback_score * 0.2 +
            screening_score * 0.1
        )

        rankings.append({
            "candidate_id": entry.id,
            "candidate_name": profile.full_name if profile else "Unknown",
            "composite": round(composite, 1),
            "breakdown": {
                "resume": round(resume_score, 1),
                "interview": round(interview_score, 1),
                "feedback": round(feedback_score, 1),
                "screening": round(screening_score, 1),
            },
            "weights": {"resume": 0.4, "interview": 0.3, "feedback": 0.2, "screening": 0.1},
        })

    rankings.sort(key=lambda x: x["composite"], reverse=True)
    for i, r in enumerate(rankings):
        r["rank"] = i + 1

    return rankings
