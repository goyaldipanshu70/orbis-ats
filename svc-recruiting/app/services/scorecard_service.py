import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import (
    CandidateJobEntry,
    CandidateProfile,
    InterviewEvaluation,
    InterviewerFeedback,
    InterviewSchedule,
    ScreeningResponse,
    ScreeningQuestion,
    PipelineStageHistory,
)

logger = logging.getLogger("svc-recruiting")

# ── Category max-score lookup (used by resume AI scoring) ────────────────────
_CATEGORY_MAX: dict[str, int] = {
    "core_skills": 100,
    "preferred_skills": 100,
    "experience": 100,
    "education": 100,
    "industry_fit": 100,
    "soft_skills": 100,
}


def _build_resume_ai(entry: "CandidateJobEntry") -> dict:
    """Transform the raw ai_resume_analysis JSONB into the structure the
    frontend expects:
        {
            total_score: number,
            max_score: 100,
            category_scores: [{category, score, max_score}, ...],
            highlighted_skills: string[],
            red_flags: string[],
            recommendation: string,
        }
    """
    ai_resume = entry.ai_resume_analysis or {}
    scoring = ai_resume.get("scoring", {})
    metadata = ai_resume.get("metadata", {})

    # Build category_scores as an ARRAY of {category, score, max_score}
    raw_cats = scoring.copy()
    # Remove keys that are not per-category scores
    for non_cat_key in ("total_score", "ai_recommendation"):
        raw_cats.pop(non_cat_key, None)

    category_scores: list[dict] = []
    for cat, default_max in _CATEGORY_MAX.items():
        val = raw_cats.pop(cat, None)
        if val is not None:
            category_scores.append({
                "category": cat,
                "score": val,
                "max_score": default_max,
            })

    # Include any extra categories we didn't pre-define
    for cat, val in raw_cats.items():
        if isinstance(val, (int, float)):
            category_scores.append({
                "category": cat,
                "score": val,
                "max_score": 100,
            })

    total_score = scoring.get("total_score", 0) or 0

    return {
        "total_score": total_score,
        "max_score": 100,
        "category_scores": category_scores,
        "highlighted_skills": metadata.get("skills", []) or [],
        "red_flags": ai_resume.get("red_flags", []) or [],
        "recommendation": ai_resume.get("ai_recommendation", scoring.get("ai_recommendation", "")) or "",
    }


def _build_interview_ai(evaluation: Optional["InterviewEvaluation"]) -> Optional[dict]:
    """Transform InterviewEvaluation.ai_interview_result into:
        {
            total_score: number,
            max_score: 100,
            score_breakdown: [{competency, score, max_score}, ...],  # ARRAY
            recommendation: string,
            strongest_competency: string,
            area_for_development: string,
            overall_impression: string,
        }
    """
    if not evaluation:
        return None

    ai_res = evaluation.ai_interview_result or {}

    # score_breakdown can be a dict (old format) or already an array
    raw_breakdown = ai_res.get("score_breakdown", {})
    score_breakdown: list[dict] = []
    total_score = 0

    if isinstance(raw_breakdown, list):
        # Already an array — normalise each entry
        for item in raw_breakdown:
            competency = item.get("competency", item.get("name", ""))
            score = item.get("score", item.get("obtained_score", 0)) or 0
            max_score = item.get("max_score", item.get("maximum_score", 100)) or 100
            score_breakdown.append({
                "competency": competency,
                "score": score,
                "max_score": max_score,
            })
        # Derive total_score from array
        if score_breakdown:
            sum_score = sum(s["score"] for s in score_breakdown)
            sum_max = sum(s["max_score"] for s in score_breakdown)
            total_score = round((sum_score / sum_max) * 100) if sum_max else 0
    elif isinstance(raw_breakdown, dict):
        # Dict format — might contain a 'total_score' key and per-competency dicts
        for key, val in raw_breakdown.items():
            if key in ("total_score", "ai_recommendation"):
                continue
            if isinstance(val, dict):
                # e.g. {"competency": ..., "obtained_score": 7, "maximum_score": 10}
                score = val.get("score", val.get("obtained_score", 0)) or 0
                max_score = val.get("max_score", val.get("maximum_score", 10)) or 10
                score_breakdown.append({
                    "competency": key,
                    "score": score,
                    "max_score": max_score,
                })
            elif isinstance(val, (int, float)):
                score_breakdown.append({
                    "competency": key,
                    "score": val,
                    "max_score": 10,
                })

        # Derive total_score
        ts_raw = raw_breakdown.get("total_score")
        if isinstance(ts_raw, dict):
            obtained = ts_raw.get("obtained_score", 0) or 0
            maximum = ts_raw.get("maximum_score", 100) or 100
            total_score = round((obtained / maximum) * 100) if maximum else 0
        elif isinstance(ts_raw, (int, float)):
            total_score = ts_raw
        elif score_breakdown:
            sum_score = sum(s["score"] for s in score_breakdown)
            sum_max = sum(s["max_score"] for s in score_breakdown)
            total_score = round((sum_score / sum_max) * 100) if sum_max else 0

    # Fall back to a top-level total_score if present
    if total_score == 0:
        total_score = ai_res.get("total_score", 0) or 0

    return {
        "total_score": total_score,
        "max_score": 100,
        "score_breakdown": score_breakdown,
        "recommendation": ai_res.get("ai_recommendation", ai_res.get("recommendation", "")) or "",
        "strongest_competency": ai_res.get("strongest_competency", "") or "",
        "area_for_development": ai_res.get("area_for_development", "") or "",
        "overall_impression": ai_res.get("overall_impression", "") or "",
    }


def _build_feedback(
    schedules: list,
    schedule_map: dict,
    feedback_rows: list,
) -> dict:
    """Transform feedback rows into the structure the frontend expects:
        {
            entries: [{round, interviewer_name, rating, recommendation, strengths, concerns}, ...],
            aggregate: {
                avg_rating: number,
                total_feedback: number,
                recommendation_distribution: {strong_yes: 0, yes: 0, neutral: 0, no: 0, strong_no: 0},
            },
        }
    """
    entries: list[dict] = []
    total_rating = 0

    # Initialise recommendation distribution with all known keys
    rec_dist: dict[str, int] = {
        "strong_yes": 0,
        "yes": 0,
        "neutral": 0,
        "no": 0,
        "strong_no": 0,
    }

    for fb in feedback_rows:
        schedule = schedule_map.get(fb.schedule_id)
        round_number = schedule.round_number if schedule else 1
        round_type = (schedule.round_type or schedule.interview_type) if schedule else ""
        round_label = f"round_{round_number}" if not round_type else f"round_{round_number}_{round_type}"

        entries.append({
            "round": round_label,
            "interviewer_name": fb.interviewer_name or "",
            "rating": fb.rating or 0,
            "recommendation": fb.recommendation or "",
            "strengths": fb.strengths or "",
            "concerns": fb.concerns or "",
        })
        total_rating += fb.rating or 0

        # Update recommendation distribution
        rec_key = (fb.recommendation or "").lower().replace(" ", "_")
        if rec_key in rec_dist:
            rec_dist[rec_key] += 1
        elif rec_key:
            # Unknown recommendation value — still count it
            rec_dist[rec_key] = rec_dist.get(rec_key, 0) + 1

    count = len(feedback_rows)
    avg_rating = round(total_rating / count, 2) if count else 0

    return {
        "entries": entries,
        "aggregate": {
            "avg_rating": avg_rating,
            "total_feedback": count,
            "recommendation_distribution": rec_dist,
        },
    }


def _compute_overall_score(
    resume_ai: dict,
    interview_ai: Optional[dict],
    feedback: dict,
) -> int:
    """Weighted composite overall score (0-100).
    Weights: resume 40%, interview 30%, feedback 30%.
    If a section is missing, redistribute weight proportionally.
    """
    components: list[tuple[float, float]] = []  # (weight, score_normalised_to_100)

    # Resume AI — always present (may be 0)
    resume_score = resume_ai.get("total_score", 0) or 0
    components.append((0.4, resume_score))

    # Interview AI
    if interview_ai:
        interview_score = interview_ai.get("total_score", 0) or 0
        components.append((0.3, interview_score))

    # Feedback (avg_rating 1-5 → normalise to 0-100)
    agg = feedback.get("aggregate", {})
    avg_rating = agg.get("avg_rating", 0) or 0
    if avg_rating > 0:
        feedback_normalised = (avg_rating / 5.0) * 100
        components.append((0.3, feedback_normalised))

    if not components:
        return 0

    total_weight = sum(w for w, _ in components)
    if total_weight == 0:
        return 0

    weighted_sum = sum(w * s for w, s in components)
    return round(weighted_sum / total_weight)


async def get_scorecard(
    db: AsyncSession,
    candidate_id: int,
    jd_id: Optional[int] = None,
) -> Optional[dict]:
    """Aggregate all candidate data into a 360-degree scorecard.

    Returns a flat structure that the CandidateScorecard.tsx frontend can
    consume directly or with minimal transformation:
        {
            candidate_id, candidate_name, candidate_email,
            overall_score, max_overall_score,
            resume_ai: { total_score, max_score, category_scores[], ... },
            interview_ai: { total_score, max_score, score_breakdown[], ... } | null,
            feedback: { entries[], aggregate: { avg_rating, total_feedback, ... } } | null,
            screening: [...],
            timeline: [...],
            candidate: { ... },  # kept for backwards compatibility
        }
    """

    # ── CandidateJobEntry + CandidateProfile ───────────────────────────
    entry_q = select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    if jd_id is not None:
        entry_q = entry_q.where(CandidateJobEntry.jd_id == jd_id)
    entry_result = await db.execute(entry_q)
    entry: Optional[CandidateJobEntry] = entry_result.scalar_one_or_none()
    if not entry:
        return None

    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
    )
    profile: Optional[CandidateProfile] = profile_result.scalar_one_or_none()

    # ── Resume AI ──────────────────────────────────────────────────────
    resume_ai = _build_resume_ai(entry)

    # ── Interview AI ───────────────────────────────────────────────────
    eval_result = await db.execute(
        select(InterviewEvaluation)
        .where(InterviewEvaluation.candidate_id == candidate_id)
        .order_by(InterviewEvaluation.created_at.desc())
        .limit(1)
    )
    evaluation = eval_result.scalar_one_or_none()
    interview_ai = _build_interview_ai(evaluation)

    # ── Interviewer Feedback ───────────────────────────────────────────
    schedule_result = await db.execute(
        select(InterviewSchedule)
        .where(InterviewSchedule.candidate_id == candidate_id)
        .order_by(InterviewSchedule.round_number)
    )
    schedules = schedule_result.scalars().all()
    schedule_ids = [s.id for s in schedules]
    schedule_map = {s.id: s for s in schedules}

    feedback_rows: list = []
    if schedule_ids:
        fb_result = await db.execute(
            select(InterviewerFeedback)
            .where(InterviewerFeedback.schedule_id.in_(schedule_ids))
            .order_by(InterviewerFeedback.created_at)
        )
        feedback_rows = fb_result.scalars().all()

    feedback = _build_feedback(schedules, schedule_map, feedback_rows)

    # ── Screening ──────────────────────────────────────────────────────
    sr_result = await db.execute(
        select(ScreeningResponse, ScreeningQuestion)
        .join(ScreeningQuestion, ScreeningResponse.question_id == ScreeningQuestion.id)
        .where(ScreeningResponse.candidate_id == candidate_id)
        .order_by(ScreeningQuestion.sort_order)
    )
    screening = [
        {"question": row.ScreeningQuestion.question, "response": row.ScreeningResponse.response}
        for row in sr_result.all()
    ]

    # ── Timeline ───────────────────────────────────────────────────────
    timeline = await _build_timeline(db, candidate_id)

    # ── Overall score ──────────────────────────────────────────────────
    overall_score = _compute_overall_score(resume_ai, interview_ai, feedback)

    # ── Candidate info (nested, for backward compat) ───────────────────
    candidate_name = profile.full_name if profile else ""
    candidate_email = profile.email if profile else ""

    candidate_info = {
        "id": entry.id,
        "profile_id": entry.profile_id,
        "jd_id": entry.jd_id,
        "name": candidate_name,
        "email": candidate_email,
        "phone": profile.phone if profile else None,
        "pipeline_stage": entry.pipeline_stage,
        "source": entry.source,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }

    # Determine if feedback section has any data
    has_feedback = len(feedback.get("entries", [])) > 0

    return {
        # Flat top-level fields for the frontend
        "candidate_id": entry.id,
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "overall_score": overall_score,
        "max_overall_score": 100,
        # Sections
        "resume_ai": resume_ai,
        "interview_ai": interview_ai,
        "feedback": feedback if has_feedback else None,
        "screening": screening,
        "timeline": timeline,
        # Backward-compatible nested candidate object
        "candidate": candidate_info,
    }


async def compare_candidates(
    db: AsyncSession,
    candidate_ids: List[int],
    jd_id: int,
) -> dict:
    """Get scorecards for multiple candidates and build a comparison matrix.

    Returns:
        {
            scorecards: ComparisonScorecard[],
            comparison_matrix: MatrixRow[],
        }

    ComparisonScorecard has flat fields:
        candidate_id, candidate_name, candidate_email,
        overall_score, max_overall_score,
        resume_score, resume_max, interview_score, interview_max,
        feedback_avg, skills_match, recommendation

    MatrixRow:
        metric, scores: {candidate_id: score}, max_score, winner_id
    """
    raw_scorecards: list[dict] = []
    for cid in candidate_ids:
        sc = await get_scorecard(db, cid, jd_id=jd_id)
        if sc:
            raw_scorecards.append(sc)

    # Build flat comparison scorecards matching ComparisonScorecard interface
    comparison_scorecards: list[dict] = []
    for sc in raw_scorecards:
        resume_ai = sc.get("resume_ai") or {}
        interview_ai = sc.get("interview_ai")
        feedback = sc.get("feedback")

        resume_score = resume_ai.get("total_score", 0) or 0
        resume_max = resume_ai.get("max_score", 100) or 100

        interview_score = 0
        interview_max = 100
        if interview_ai:
            interview_score = interview_ai.get("total_score", 0) or 0
            interview_max = interview_ai.get("max_score", 100) or 100

        feedback_avg = 0.0
        if feedback and feedback.get("aggregate"):
            feedback_avg = feedback["aggregate"].get("avg_rating", 0) or 0

        # skills_match: use number of highlighted skills as a rough proxy
        # normalised to a percentage (cap at 20 skills = 100%)
        skills = resume_ai.get("highlighted_skills", []) or []
        skills_match = min(len(skills) * 5, 100)

        # Best recommendation: prefer interview_ai, fall back to resume_ai
        recommendation = ""
        if interview_ai:
            recommendation = interview_ai.get("recommendation", "") or ""
        if not recommendation:
            recommendation = resume_ai.get("recommendation", "") or ""

        comparison_scorecards.append({
            "candidate_id": sc["candidate_id"],
            "candidate_name": sc["candidate_name"],
            "candidate_email": sc["candidate_email"],
            "overall_score": sc.get("overall_score", 0) or 0,
            "max_overall_score": sc.get("max_overall_score", 100) or 100,
            "resume_score": resume_score,
            "resume_max": resume_max,
            "interview_score": interview_score,
            "interview_max": interview_max,
            "feedback_avg": round(feedback_avg, 2),
            "skills_match": skills_match,
            "recommendation": recommendation,
        })

    # Build comparison matrix matching MatrixRow interface:
    #   { metric: string, scores: {[candidate_id]: number}, max_score: number, winner_id: number|null }
    metrics: list[tuple[str, int]] = [
        # (metric_name, max_score)
        ("overall_score", 100),
        ("resume_score", 100),
        ("interview_score", 100),
        ("feedback_avg", 5),
        ("skills_match", 100),
    ]

    def _get_metric(sc: dict, metric: str):
        return sc.get(metric, 0) or 0

    comparison_matrix: list[dict] = []
    for metric_name, max_score in metrics:
        scores: dict[str, float] = {}
        best_val: Optional[float] = None
        winner_id: Optional[int] = None

        for sc in comparison_scorecards:
            cid_str = str(sc["candidate_id"])
            val = _get_metric(sc, metric_name)
            scores[cid_str] = val
            if best_val is None or val > best_val:
                best_val = val
                winner_id = sc["candidate_id"]

        comparison_matrix.append({
            "metric": metric_name,
            "scores": scores,
            "max_score": max_score,
            "winner_id": winner_id,
        })

    return {
        "scorecards": comparison_scorecards,
        "comparison_matrix": comparison_matrix,
    }


async def get_timeline(db: AsyncSession, candidate_id: int) -> Optional[list]:
    """Get chronological timeline for a candidate."""
    entry_result = await db.execute(
        select(CandidateJobEntry).where(CandidateJobEntry.id == candidate_id)
    )
    if not entry_result.scalar_one_or_none():
        return None
    return await _build_timeline(db, candidate_id)


async def _build_timeline(db: AsyncSession, candidate_id: int) -> list:
    """Build a combined chronological timeline from stage history and interview schedules."""
    events: list[dict] = []

    # Pipeline stage changes
    psh_result = await db.execute(
        select(PipelineStageHistory)
        .where(PipelineStageHistory.candidate_id == candidate_id)
        .order_by(PipelineStageHistory.created_at)
    )
    for h in psh_result.scalars().all():
        events.append({
            "event_type": "stage_change",
            "description": f"Moved from {h.from_stage or 'none'} to {h.to_stage}",
            "date": h.created_at.isoformat() if h.created_at else None,
            "actor": h.changed_by,
        })

    # Interview schedules
    is_result = await db.execute(
        select(InterviewSchedule)
        .where(InterviewSchedule.candidate_id == candidate_id)
        .order_by(InterviewSchedule.created_at)
    )
    for s in is_result.scalars().all():
        events.append({
            "event_type": "interview_scheduled",
            "description": f"Round {s.round_number} ({s.interview_type}) — {s.status}",
            "date": s.created_at.isoformat() if s.created_at else None,
            "actor": s.created_by,
        })

    # Sort all events chronologically
    events.sort(key=lambda e: e["date"] or "")
    return events
