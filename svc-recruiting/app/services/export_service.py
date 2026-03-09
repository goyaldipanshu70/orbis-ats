import csv
import io
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.db.models import (
    CandidateJobEntry,
    CandidateProfile,
    InterviewEvaluation,
    InterviewerFeedback,
    InterviewSchedule,
    ScreeningResponse,
    ScreeningQuestion,
    PipelineStageHistory,
    Offer,
    JobDescription,
)

logger = logging.getLogger("svc-recruiting")


def _safe_iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


async def export_candidate(
    db: AsyncSession,
    candidate_id: int,
    format: str = "json",
) -> dict | str:
    """Gather ALL data for a candidate and return as dict (json) or CSV string."""

    # ── Entry + Profile ────────────────────────────────────────────────
    entry_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return {"error": "Candidate not found"} if format == "json" else ""

    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
    )
    profile = profile_result.scalar_one_or_none()

    # ── Interview evaluations ──────────────────────────────────────────
    eval_result = await db.execute(
        select(InterviewEvaluation)
        .where(InterviewEvaluation.candidate_id == candidate_id)
        .order_by(InterviewEvaluation.created_at)
    )
    evaluations = [
        {
            "id": e.id,
            "jd_id": e.jd_id,
            "ai_interview_result": e.ai_interview_result,
            "created_at": _safe_iso(e.created_at),
        }
        for e in eval_result.scalars().all()
    ]

    # ── Interview schedules + feedback ─────────────────────────────────
    sched_result = await db.execute(
        select(InterviewSchedule)
        .where(InterviewSchedule.candidate_id == candidate_id)
        .order_by(InterviewSchedule.created_at)
    )
    schedules_raw = sched_result.scalars().all()
    schedule_ids = [s.id for s in schedules_raw]

    schedules = [
        {
            "id": s.id,
            "jd_id": s.jd_id,
            "interview_type": s.interview_type,
            "scheduled_date": s.scheduled_date,
            "scheduled_time": s.scheduled_time,
            "round_number": s.round_number,
            "status": s.status,
            "created_at": _safe_iso(s.created_at),
        }
        for s in schedules_raw
    ]

    feedback_list = []
    if schedule_ids:
        fb_result = await db.execute(
            select(InterviewerFeedback)
            .where(InterviewerFeedback.schedule_id.in_(schedule_ids))
            .order_by(InterviewerFeedback.created_at)
        )
        feedback_list = [
            {
                "id": f.id,
                "schedule_id": f.schedule_id,
                "interviewer_name": f.interviewer_name,
                "rating": f.rating,
                "recommendation": f.recommendation,
                "strengths": f.strengths,
                "concerns": f.concerns,
                "created_at": _safe_iso(f.created_at),
            }
            for f in fb_result.scalars().all()
        ]

    # ── Screening responses ────────────────────────────────────────────
    sr_result = await db.execute(
        select(ScreeningResponse, ScreeningQuestion)
        .join(ScreeningQuestion, ScreeningResponse.question_id == ScreeningQuestion.id)
        .where(ScreeningResponse.candidate_id == candidate_id)
    )
    screening = [
        {
            "question": row.ScreeningQuestion.question,
            "response": row.ScreeningResponse.response,
            "created_at": _safe_iso(row.ScreeningResponse.created_at),
        }
        for row in sr_result.all()
    ]

    # ── Stage history ──────────────────────────────────────────────────
    psh_result = await db.execute(
        select(PipelineStageHistory)
        .where(PipelineStageHistory.candidate_id == candidate_id)
        .order_by(PipelineStageHistory.created_at)
    )
    stage_history = [
        {
            "from_stage": h.from_stage,
            "to_stage": h.to_stage,
            "changed_by": h.changed_by,
            "notes": h.notes,
            "created_at": _safe_iso(h.created_at),
        }
        for h in psh_result.scalars().all()
    ]

    # ── Offers ─────────────────────────────────────────────────────────
    offer_result = await db.execute(
        select(Offer)
        .where(Offer.candidate_id == candidate_id, Offer.deleted_at.is_(None))
        .order_by(Offer.created_at)
    )
    offers = [
        {
            "id": o.id,
            "jd_id": o.jd_id,
            "salary": float(o.salary) if o.salary else None,
            "salary_currency": o.salary_currency,
            "status": o.status,
            "start_date": o.start_date,
            "position_title": o.position_title,
            "created_at": _safe_iso(o.created_at),
        }
        for o in offer_result.scalars().all()
    ]

    data = {
        "profile": {
            "id": profile.id if profile else None,
            "email": profile.email if profile else None,
            "full_name": profile.full_name if profile else None,
            "phone": profile.phone if profile else None,
            "linkedin_url": profile.linkedin_url if profile else None,
            "github_url": profile.github_url if profile else None,
            "portfolio_url": profile.portfolio_url if profile else None,
            "status": profile.status if profile else None,
            "created_at": _safe_iso(profile.created_at) if profile else None,
        },
        "job_entry": {
            "id": entry.id,
            "jd_id": entry.jd_id,
            "pipeline_stage": entry.pipeline_stage,
            "source": entry.source,
            "onboard": entry.onboard,
            "ai_resume_analysis": entry.ai_resume_analysis,
            "created_at": _safe_iso(entry.created_at),
        },
        "evaluations": evaluations,
        "schedules": schedules,
        "feedback": feedback_list,
        "screening": screening,
        "stage_history": stage_history,
        "offers": offers,
    }

    if format == "csv":
        return _candidate_data_to_csv(data)

    return data


def _candidate_data_to_csv(data: dict) -> str:
    """Flatten candidate data into a CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "profile_email", "profile_name", "profile_phone",
        "pipeline_stage", "source", "jd_id",
        "evaluations_count", "schedules_count", "feedback_count",
        "offers_count", "screening_count", "stage_history_count",
    ])

    p = data["profile"]
    je = data["job_entry"]
    writer.writerow([
        p.get("email", ""),
        p.get("full_name", ""),
        p.get("phone", ""),
        je.get("pipeline_stage", ""),
        je.get("source", ""),
        je.get("jd_id", ""),
        len(data["evaluations"]),
        len(data["schedules"]),
        len(data["feedback"]),
        len(data["offers"]),
        len(data["screening"]),
        len(data["stage_history"]),
    ])

    return output.getvalue()


async def erase_candidate(db: AsyncSession, candidate_id: int) -> dict:
    """GDPR erasure: anonymize candidate data, set deleted_at."""

    entry_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return {"erased": False, "error": "Candidate not found", "records_affected": 0}

    now = datetime.utcnow()
    records_affected = 0

    # Anonymize the profile
    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile:
        await db.execute(
            update(CandidateProfile)
            .where(CandidateProfile.id == profile.id)
            .values(
                email="[REDACTED]",
                full_name="[REDACTED]",
                phone="[REDACTED]",
                linkedin_url=None,
                github_url=None,
                portfolio_url=None,
                notes=None,
                parsed_metadata=None,
                deleted_at=now,
            )
        )
        records_affected += 1

    # Mark the job entry as deleted and clear PII from ai_resume_analysis
    await db.execute(
        update(CandidateJobEntry)
        .where(CandidateJobEntry.id == candidate_id)
        .values(
            ai_resume_analysis={},
            deleted_at=now,
        )
    )
    records_affected += 1

    # Anonymize screening responses
    sr_result = await db.execute(
        select(func.count(ScreeningResponse.id))
        .where(ScreeningResponse.candidate_id == candidate_id)
    )
    sr_count = sr_result.scalar_one()
    if sr_count > 0:
        await db.execute(
            update(ScreeningResponse)
            .where(ScreeningResponse.candidate_id == candidate_id)
            .values(response="[REDACTED]")
        )
        records_affected += sr_count

    # Anonymize interviewer feedback notes
    schedule_result = await db.execute(
        select(InterviewSchedule.id)
        .where(InterviewSchedule.candidate_id == candidate_id)
    )
    schedule_ids = [row[0] for row in schedule_result.all()]
    if schedule_ids:
        fb_count_result = await db.execute(
            select(func.count(InterviewerFeedback.id))
            .where(InterviewerFeedback.schedule_id.in_(schedule_ids))
        )
        fb_count = fb_count_result.scalar_one()
        if fb_count > 0:
            await db.execute(
                update(InterviewerFeedback)
                .where(InterviewerFeedback.schedule_id.in_(schedule_ids))
                .values(strengths="[REDACTED]", concerns="[REDACTED]", notes="[REDACTED]")
            )
            records_affected += fb_count

    await db.commit()

    return {"erased": True, "records_affected": records_affected}


async def export_job_candidates(
    db: AsyncSession,
    jd_id: int,
    format: str = "csv",
) -> str:
    """Bulk export all candidates for a job as CSV."""

    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile)
        .join(CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id)
        .where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
        .order_by(CandidateJobEntry.created_at.desc())
    )
    rows = result.all()

    # Fetch job title
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    job_title = ""
    if jd and jd.ai_result:
        job_title = jd.ai_result.get("job_title", "")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "candidate_id", "profile_id", "name", "email", "phone",
        "pipeline_stage", "source", "onboard", "resume_score",
        "created_at", "job_title",
    ])

    for row in rows:
        entry: CandidateJobEntry = row.CandidateJobEntry
        profile: CandidateProfile = row.CandidateProfile

        ai = entry.ai_resume_analysis or {}
        scoring = ai.get("scoring", {})
        total_score = scoring.get("total_score", "")

        writer.writerow([
            entry.id,
            profile.id,
            profile.full_name or "",
            profile.email or "",
            profile.phone or "",
            entry.pipeline_stage,
            entry.source,
            entry.onboard,
            total_score,
            _safe_iso(entry.created_at),
            job_title,
        ])

    return output.getvalue()
