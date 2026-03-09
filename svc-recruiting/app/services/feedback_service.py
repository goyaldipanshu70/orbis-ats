"""Multi-round interview feedback service."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update, func

from app.db.models import InterviewerFeedback, InterviewSchedule, InterviewerProfile

logger = logging.getLogger("svc-recruiting")


async def submit_feedback(
    db: AsyncSession,
    schedule_id: int,
    interviewer_id: str,
    interviewer_name: str,
    rating: int,
    recommendation: str,
    strengths: str = None,
    concerns: str = None,
    notes: str = None,
    criteria_scores: dict = None,
    rubric_scores: dict = None,
) -> dict:
    """Submit feedback for an interview round."""
    valid_recommendations = {"strong_yes", "yes", "neutral", "no", "strong_no"}
    if recommendation not in valid_recommendations:
        raise ValueError(f"Invalid recommendation. Must be one of: {', '.join(valid_recommendations)}")
    if not 1 <= rating <= 5:
        raise ValueError("Rating must be between 1 and 5")

    feedback = InterviewerFeedback(
        schedule_id=schedule_id,
        interviewer_id=interviewer_id,
        interviewer_name=interviewer_name,
        rating=rating,
        recommendation=recommendation,
        strengths=strengths,
        concerns=concerns,
        notes=notes,
        criteria_scores=criteria_scores,
        rubric_scores=rubric_scores,
    )
    db.add(feedback)

    # Mark the interview schedule as having feedback
    await db.execute(
        sql_update(InterviewSchedule)
        .where(InterviewSchedule.id == schedule_id)
        .values(feedback_submitted=True)
    )

    await db.commit()
    await db.refresh(feedback)

    # Auto-update interviewer profile stats
    try:
        profile_result = await db.execute(
            select(InterviewerProfile).where(
                InterviewerProfile.user_id == int(interviewer_id)
            )
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            # Count total feedback entries by this interviewer
            count_result = await db.execute(
                select(func.count(), func.avg(InterviewerFeedback.rating)).where(
                    InterviewerFeedback.interviewer_id == interviewer_id
                )
            )
            row = count_result.one()
            profile.total_interviews = row[0] or 0
            profile.avg_rating_given = round(float(row[1] or 0), 2)
            await db.commit()
    except Exception as e:
        logger.warning("Failed to update interviewer profile stats: %s", e)

    return {
        "id": feedback.id,
        "schedule_id": feedback.schedule_id,
        "interviewer_name": feedback.interviewer_name,
        "rating": feedback.rating,
        "recommendation": feedback.recommendation,
        "created_at": str(feedback.created_at),
    }


async def get_feedback_for_schedule(db: AsyncSession, schedule_id: int) -> list:
    """Get all feedback entries for an interview schedule."""
    result = await db.execute(
        select(InterviewerFeedback)
        .where(InterviewerFeedback.schedule_id == schedule_id)
        .order_by(InterviewerFeedback.created_at.desc())
    )
    return [
        {
            "id": f.id,
            "schedule_id": f.schedule_id,
            "interviewer_id": f.interviewer_id,
            "interviewer_name": f.interviewer_name,
            "rating": f.rating,
            "recommendation": f.recommendation,
            "strengths": f.strengths,
            "concerns": f.concerns,
            "notes": f.notes,
            "created_at": str(f.created_at),
        }
        for f in result.scalars().all()
    ]


async def get_feedback_summary(db: AsyncSession, candidate_id: int) -> dict:
    """Aggregate feedback across all interview rounds for a candidate."""
    # Get all schedule IDs for this candidate
    sched_result = await db.execute(
        select(InterviewSchedule.id)
        .where(InterviewSchedule.candidate_id == candidate_id)
    )
    schedule_ids = [row[0] for row in sched_result.all()]

    if not schedule_ids:
        return {"total_feedback": 0, "avg_rating": 0, "recommendations": {}, "feedback": []}

    result = await db.execute(
        select(InterviewerFeedback)
        .where(InterviewerFeedback.schedule_id.in_(schedule_ids))
        .order_by(InterviewerFeedback.created_at.desc())
    )
    feedback_list = result.scalars().all()

    recommendations = {}
    total_rating = 0
    for f in feedback_list:
        recommendations[f.recommendation] = recommendations.get(f.recommendation, 0) + 1
        total_rating += f.rating

    avg_rating = round(total_rating / len(feedback_list), 1) if feedback_list else 0

    return {
        "total_feedback": len(feedback_list),
        "avg_rating": avg_rating,
        "recommendations": recommendations,
        "feedback": [
            {
                "id": f.id,
                "schedule_id": f.schedule_id,
                "interviewer_name": f.interviewer_name,
                "rating": f.rating,
                "recommendation": f.recommendation,
                "strengths": f.strengths,
                "concerns": f.concerns,
                "notes": f.notes,
                "created_at": str(f.created_at),
            }
            for f in feedback_list
        ],
    }


async def get_aggregate_feedback(db: AsyncSession, candidate_id: int, jd_id: int) -> dict:
    """Get comprehensive feedback across all interview rounds for a candidate + job."""
    result = await db.execute(
        select(InterviewSchedule).where(
            InterviewSchedule.candidate_id == candidate_id,
            InterviewSchedule.jd_id == jd_id,
        ).order_by(InterviewSchedule.round_number)
    )
    all_schedules = result.scalars().all()

    rounds = []
    all_feedback = []
    total_rating = 0
    rec_counts = {"strong_yes": 0, "yes": 0, "neutral": 0, "no": 0, "strong_no": 0}

    for s in all_schedules:
        fb_result = await db.execute(
            select(InterviewerFeedback).where(InterviewerFeedback.schedule_id == s.id)
        )
        feedbacks = fb_result.scalars().all()

        round_info = {
            "schedule_id": s.id,
            "round_number": getattr(s, "round_number", 1),
            "round_type": getattr(s, "round_type", None),
            "status": s.status,
            "scheduled_date": s.scheduled_date,
            "interviewer_names": s.interviewer_names or [],
            "feedback_count": len(feedbacks),
            "feedback": [],
        }

        for fb in feedbacks:
            fb_dict = {
                "id": fb.id,
                "interviewer_id": fb.interviewer_id,
                "interviewer_name": fb.interviewer_name,
                "rating": fb.rating,
                "recommendation": fb.recommendation,
                "strengths": fb.strengths,
                "concerns": fb.concerns,
                "notes": fb.notes,
                "criteria_scores": getattr(fb, "criteria_scores", None),
                "rubric_scores": getattr(fb, "rubric_scores", None),
                "created_at": str(fb.created_at),
            }
            round_info["feedback"].append(fb_dict)
            all_feedback.append(fb_dict)
            total_rating += fb.rating
            if fb.recommendation in rec_counts:
                rec_counts[fb.recommendation] += 1

        rounds.append(round_info)

    total_count = len(all_feedback)
    completed_rounds = sum(1 for s in all_schedules if s.status == "completed")

    return {
        "total_rounds": len(all_schedules),
        "completed_rounds": completed_rounds,
        "total_feedback": total_count,
        "avg_rating": round(total_rating / total_count, 2) if total_count > 0 else None,
        "recommendation_distribution": rec_counts,
        "rounds": rounds,
    }
