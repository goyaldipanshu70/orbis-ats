from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, date
from typing import Optional

from app.db.models import (
    CandidateJobEntry,
    JobDescription,
    PipelineStageHistory,
    InterviewSchedule,
    Offer,
    JobApplication,
    JobBoardPosting,
    AIInterviewSession,
)

# Ordered pipeline stages for conversion rate calculation
PIPELINE_STAGES = ["applied", "screening", "ai_interview", "interview", "offer", "hired"]


async def get_pipeline_funnel(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count candidates per pipeline_stage, compute conversion rates, and return total."""
    conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_from is not None:
        conditions.append(CandidateJobEntry.created_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.created_at <= date_to)

    query = (
        select(
            CandidateJobEntry.pipeline_stage,
            func.count(CandidateJobEntry.id).label("count"),
        )
        .where(*conditions)
        .group_by(CandidateJobEntry.pipeline_stage)
    )
    result = await db.execute(query)
    rows = result.all()

    stage_counts = {row.pipeline_stage: row.count for row in rows}

    # Build stages list in defined order + any extras
    stages = []
    for s in PIPELINE_STAGES:
        stages.append({"stage": s, "count": stage_counts.get(s, 0)})
    for stage_name, count in stage_counts.items():
        if stage_name not in PIPELINE_STAGES:
            stages.append({"stage": stage_name, "count": count})

    total = sum(s["count"] for s in stages)

    # Conversion rates between consecutive pipeline stages
    conversion_rates = []
    for i in range(len(PIPELINE_STAGES) - 1):
        from_stage = PIPELINE_STAGES[i]
        to_stage = PIPELINE_STAGES[i + 1]
        from_count = stage_counts.get(from_stage, 0)
        to_count = stage_counts.get(to_stage, 0)
        rate = round(to_count / from_count, 4) if from_count > 0 else 0.0
        conversion_rates.append({"from": from_stage, "to": to_stage, "rate": rate})

    return {"stages": stages, "total": total, "conversion_rates": conversion_rates}


async def get_time_to_hire(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """For hired candidates, calculate avg/min/max days from created_at to stage_changed_at.
    Also provide a by_stage breakdown using PipelineStageHistory."""
    # ── Overall time-to-hire for hired candidates ──
    conditions = [
        CandidateJobEntry.pipeline_stage == "hired",
        CandidateJobEntry.stage_changed_at.isnot(None),
        CandidateJobEntry.deleted_at.is_(None),
    ]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_from is not None:
        conditions.append(CandidateJobEntry.stage_changed_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.stage_changed_at <= date_to)

    days_expr = func.extract(
        "epoch",
        CandidateJobEntry.stage_changed_at - CandidateJobEntry.created_at,
    ) / 86400.0

    query = select(
        func.avg(days_expr).label("avg_days"),
        func.min(days_expr).label("min_days"),
        func.max(days_expr).label("max_days"),
        func.count(CandidateJobEntry.id).label("total_hired"),
    ).where(*conditions)

    result = await db.execute(query)
    row = result.one()

    avg_days = round(float(row.avg_days), 1) if row.avg_days else 0.0
    min_days = round(float(row.min_days), 1) if row.min_days else 0.0
    max_days = round(float(row.max_days), 1) if row.max_days else 0.0

    # ── Per-stage breakdown from PipelineStageHistory ──
    # Calculate avg time spent in each stage by looking at consecutive transitions
    hist_conditions = []
    if jd_id is not None:
        hist_conditions.append(PipelineStageHistory.jd_id == jd_id)
    if date_from is not None:
        hist_conditions.append(PipelineStageHistory.created_at >= date_from)
    if date_to is not None:
        hist_conditions.append(PipelineStageHistory.created_at <= date_to)

    hist_query = (
        select(PipelineStageHistory)
        .where(*hist_conditions)
        .order_by(PipelineStageHistory.candidate_id, PipelineStageHistory.created_at)
    )
    hist_result = await db.execute(hist_query)
    hist_rows = hist_result.scalars().all()

    stage_durations: dict[str, list[float]] = {}
    prev: dict[int, PipelineStageHistory] = {}

    for h in hist_rows:
        cid = h.candidate_id
        if cid in prev:
            p = prev[cid]
            stage = p.to_stage
            duration = (h.created_at - p.created_at).total_seconds() / 86400.0
            if duration >= 0:
                stage_durations.setdefault(stage, []).append(duration)
        prev[cid] = h

    by_stage = []
    for stage in PIPELINE_STAGES:
        durations = stage_durations.get(stage, [])
        stage_avg = round(sum(durations) / len(durations), 1) if durations else 0.0
        by_stage.append({"stage": stage, "avg_days": stage_avg})

    return {
        "avg_days": avg_days,
        "min_days": min_days,
        "max_days": max_days,
        "total_hired": row.total_hired or 0,
        "by_stage": by_stage,
    }


async def get_source_effectiveness(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Group candidates by source, count total and per-stage counts, compute conversion rate as percentage."""
    conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_from is not None:
        conditions.append(CandidateJobEntry.created_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.created_at <= date_to)

    screened_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["screening", "ai_interview", "interview", "offer", "hired"]), 1),
        else_=0,
    )
    interviewed_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["interview", "offer", "hired"]), 1),
        else_=0,
    )
    offered_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["offer", "hired"]), 1),
        else_=0,
    )
    hired_case = case(
        (CandidateJobEntry.pipeline_stage == "hired", 1),
        else_=0,
    )

    query = (
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("total"),
            func.sum(screened_case).label("screened"),
            func.sum(interviewed_case).label("interviewed"),
            func.sum(offered_case).label("offered"),
            func.sum(hired_case).label("hired"),
        )
        .where(*conditions)
        .group_by(CandidateJobEntry.source)
        .order_by(func.count(CandidateJobEntry.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()

    sources = []
    for row in rows:
        total = row.total or 0
        hired = int(row.hired or 0)
        # conversion_rate as percentage (0-100)
        conv = round((hired / total) * 100, 1) if total > 0 else 0.0
        sources.append({
            "source": row.source or "unknown",
            "total": total,
            "screened": int(row.screened or 0),
            "interviewed": int(row.interviewed or 0),
            "offered": int(row.offered or 0),
            "hired": hired,
            "conversion_rate": conv,
        })

    return {"sources": sources}


async def get_hiring_velocity(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    period: str = "month",
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count hires per month/week, compute current velocity (avg hires per period)."""
    trunc_unit = "month" if period == "month" else "week"

    if date_from is not None:
        cutoff = date_from
    elif trunc_unit == "month":
        cutoff = datetime.utcnow() - timedelta(days=365)
    else:
        cutoff = datetime.utcnow() - timedelta(weeks=12)

    conditions = [
        CandidateJobEntry.pipeline_stage == "hired",
        CandidateJobEntry.stage_changed_at.isnot(None),
        CandidateJobEntry.stage_changed_at >= cutoff,
        CandidateJobEntry.deleted_at.is_(None),
    ]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_to is not None:
        conditions.append(CandidateJobEntry.stage_changed_at <= date_to)

    period_col = func.date_trunc(trunc_unit, CandidateJobEntry.stage_changed_at).label("period_start")

    query = (
        select(period_col, func.count(CandidateJobEntry.id).label("count"))
        .where(*conditions)
        .group_by(period_col)
        .order_by(period_col)
    )
    result = await db.execute(query)
    rows = result.all()

    data = []
    total_hires = 0
    for row in rows:
        if row.period_start:
            if trunc_unit == "month":
                label = row.period_start.strftime("%Y-%m")
            else:
                label = row.period_start.strftime("%Y-W%W")
            data.append({"date": label, "count": row.count})
            total_hires += row.count

    # velocity = average hires per period
    velocity = round(total_hires / len(data), 1) if data else 0

    return {"velocity": velocity, "period": period, "data": data}


async def get_offer_acceptance_rate(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count offers by status and calculate acceptance rate as percentage."""
    conditions = [Offer.deleted_at.is_(None)]
    if jd_id is not None:
        conditions.append(Offer.jd_id == jd_id)
    if date_from is not None:
        conditions.append(Offer.created_at >= date_from)
    if date_to is not None:
        conditions.append(Offer.created_at <= date_to)

    accepted_case = case((Offer.status == "accepted", 1), else_=0)
    declined_case = case((Offer.status == "declined", 1), else_=0)
    pending_case = case((Offer.status.in_(["draft", "sent"]), 1), else_=0)

    query = select(
        func.count(Offer.id).label("total_offers"),
        func.sum(accepted_case).label("accepted"),
        func.sum(declined_case).label("declined"),
        func.sum(pending_case).label("pending"),
    ).where(*conditions)

    result = await db.execute(query)
    row = result.one()

    total = row.total_offers or 0
    accepted = int(row.accepted or 0)
    declined = int(row.declined or 0)
    pending = int(row.pending or 0)

    # rate as percentage (0-100) for KPI display
    rate = round((accepted / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_offers": total,
        "accepted": accepted,
        "declined": declined,
        "pending": pending,
        "rate": rate,
        "acceptance_rate": round(accepted / total, 4) if total > 0 else 0.0,
    }


async def get_interviewer_load(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count interviews per interviewer from JSONB interviewer_names.
    Split into total interviews and upcoming (scheduled, future date)."""
    conditions = []
    if jd_id is not None:
        conditions.append(InterviewSchedule.jd_id == jd_id)
    if date_from is not None:
        conditions.append(InterviewSchedule.created_at >= date_from)
    if date_to is not None:
        conditions.append(InterviewSchedule.created_at <= date_to)

    query = select(
        InterviewSchedule.interviewer_names,
        InterviewSchedule.status,
        InterviewSchedule.scheduled_date,
    )
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    rows = result.all()

    today_str = date.today().isoformat()  # "YYYY-MM-DD"

    counts: dict[str, dict] = {}  # name -> {total, upcoming}
    for row in rows:
        names = row.interviewer_names
        if not names or not isinstance(names, list):
            continue
        is_upcoming = (
            row.status in ("scheduled",)
            and isinstance(row.scheduled_date, str)
            and row.scheduled_date >= today_str
        )
        for name in names:
            if isinstance(name, str) and name.strip():
                n = name.strip()
                if n not in counts:
                    counts[n] = {"total": 0, "upcoming": 0}
                counts[n]["total"] += 1
                if is_upcoming:
                    counts[n]["upcoming"] += 1

    interviewers = sorted(
        [
            {"name": name, "count": data["total"], "upcoming": data["upcoming"]}
            for name, data in counts.items()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )

    return {"interviewers": interviewers}


async def get_rejection_reasons(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count rejection reasons from CandidateJobEntry (rejected stage) and JobApplication."""
    # First try CandidateJobEntry with pipeline_stage = 'rejected'
    # Then fall back to / also include JobApplication rejection_reason
    # Use both sources and merge

    reasons_counts: dict[str, int] = {}

    # Source 1: JobApplication rejection reasons
    app_conditions = [
        JobApplication.status == "rejected",
        JobApplication.rejection_reason.isnot(None),
        JobApplication.rejection_reason != "",
        JobApplication.deleted_at.is_(None),
    ]
    if jd_id is not None:
        app_conditions.append(JobApplication.jd_id == jd_id)
    if date_from is not None:
        app_conditions.append(JobApplication.updated_at >= date_from)
    if date_to is not None:
        app_conditions.append(JobApplication.updated_at <= date_to)

    app_query = (
        select(
            JobApplication.rejection_reason,
            func.count(JobApplication.id).label("count"),
        )
        .where(*app_conditions)
        .group_by(JobApplication.rejection_reason)
    )
    app_result = await db.execute(app_query)
    for row in app_result.all():
        reason = (row.rejection_reason or "").strip()
        if reason:
            reasons_counts[reason] = reasons_counts.get(reason, 0) + row.count

    # Source 2: CandidateJobEntry pipeline_stage = 'rejected' — look at stage history notes
    cje_conditions = [
        CandidateJobEntry.pipeline_stage == "rejected",
        CandidateJobEntry.deleted_at.is_(None),
    ]
    if jd_id is not None:
        cje_conditions.append(CandidateJobEntry.jd_id == jd_id)

    # Check if entries with rejected stage exist that aren't covered by JobApplication
    # Use PipelineStageHistory notes for the reason
    hist_conditions = [PipelineStageHistory.to_stage == "rejected"]
    if jd_id is not None:
        hist_conditions.append(PipelineStageHistory.jd_id == jd_id)
    if date_from is not None:
        hist_conditions.append(PipelineStageHistory.created_at >= date_from)
    if date_to is not None:
        hist_conditions.append(PipelineStageHistory.created_at <= date_to)

    hist_query = (
        select(
            PipelineStageHistory.notes,
            func.count(PipelineStageHistory.id).label("count"),
        )
        .where(*hist_conditions)
        .where(PipelineStageHistory.notes.isnot(None))
        .where(PipelineStageHistory.notes != "")
        .group_by(PipelineStageHistory.notes)
    )
    hist_result = await db.execute(hist_query)
    for row in hist_result.all():
        reason = (row.notes or "").strip()
        if reason:
            reasons_counts[reason] = reasons_counts.get(reason, 0) + row.count

    # If no reasons found from either source, add a generic "Rejected" count
    if not reasons_counts:
        # Count how many are just in rejected stage with no reason
        generic_query = select(func.count(CandidateJobEntry.id)).where(*cje_conditions)
        generic_result = await db.execute(generic_query)
        generic_count = generic_result.scalar() or 0
        if generic_count > 0:
            reasons_counts["No reason specified"] = generic_count

    sorted_reasons = sorted(reasons_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "reasons": [{"reason": reason, "count": count} for reason, count in sorted_reasons]
    }


async def get_recruiter_performance(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Count hires per recruiter (user_id via JobDescription) and compute avg time-to-hire.
    Try to resolve recruiter name from CandidateJobEntry.user_id."""
    conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_from is not None:
        conditions.append(CandidateJobEntry.created_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.created_at <= date_to)

    hired_case = case(
        (CandidateJobEntry.pipeline_stage == "hired", 1),
        else_=0,
    )

    # Days to hire for hired candidates (NULL for non-hired)
    days_expr = case(
        (
            and_(
                CandidateJobEntry.pipeline_stage == "hired",
                CandidateJobEntry.stage_changed_at.isnot(None),
            ),
            func.extract(
                "epoch",
                CandidateJobEntry.stage_changed_at - CandidateJobEntry.created_at,
            ) / 86400.0,
        ),
        else_=None,
    )

    query = (
        select(
            CandidateJobEntry.user_id,
            func.count(CandidateJobEntry.id).label("total"),
            func.sum(hired_case).label("hired"),
            func.avg(days_expr).label("avg_days"),
        )
        .where(*conditions)
        .group_by(CandidateJobEntry.user_id)
        .order_by(func.sum(hired_case).desc())
    )
    result = await db.execute(query)
    rows = result.all()

    recruiters = []
    for row in rows:
        hires = int(row.hired or 0)
        avg_time = round(float(row.avg_days), 1) if row.avg_days else 0.0
        # user_id is a string; use it as name (frontend can resolve later)
        name = str(row.user_id) if row.user_id else "Unknown"
        # Format: "Recruiter #<id>" if it looks numeric
        if name.isdigit():
            name = f"Recruiter #{name}"

        recruiters.append({
            "name": name,
            "user_id": row.user_id,
            "total_candidates": row.total,
            "hires": hires,
            "avg_time": avg_time,
        })

    return {"recruiters": recruiters}


async def get_time_in_stage(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Calculate avg/min/max time spent in each pipeline stage using PipelineStageHistory.
    For each candidate, the time in a stage = next transition time - this transition time."""
    conditions = []
    if jd_id is not None:
        conditions.append(PipelineStageHistory.jd_id == jd_id)
    if date_from is not None:
        conditions.append(PipelineStageHistory.created_at >= date_from)
    if date_to is not None:
        conditions.append(PipelineStageHistory.created_at <= date_to)

    query = (
        select(PipelineStageHistory)
        .where(*conditions)
        .order_by(PipelineStageHistory.candidate_id, PipelineStageHistory.created_at)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    # Group by candidate and compute stage durations
    stage_durations: dict[str, list[float]] = {}
    prev: dict[int, PipelineStageHistory] = {}

    for row in rows:
        cid = row.candidate_id
        if cid in prev:
            p = prev[cid]
            stage = p.to_stage
            duration = (row.created_at - p.created_at).total_seconds() / 86400.0
            if duration >= 0:
                stage_durations.setdefault(stage, []).append(duration)
        prev[cid] = row

    stages = []
    for stage in PIPELINE_STAGES:
        durations = stage_durations.get(stage, [])
        if durations:
            avg_d = round(sum(durations) / len(durations), 1)
            min_d = round(min(durations), 1)
            max_d = round(max(durations), 1)
        else:
            avg_d = min_d = max_d = 0.0
        stages.append({
            "stage": stage,
            "avg_days": avg_d,
            "min_days": min_d,
            "max_days": max_d,
            "count": len(durations),
        })

    # Also include any stages not in predefined list
    for stage_name, durations in stage_durations.items():
        if stage_name not in PIPELINE_STAGES and durations:
            avg_d = round(sum(durations) / len(durations), 1)
            min_d = round(min(durations), 1)
            max_d = round(max(durations), 1)
            stages.append({
                "stage": stage_name,
                "avg_days": avg_d,
                "min_days": min_d,
                "max_days": max_d,
                "count": len(durations),
            })

    return {"stages": stages}


async def get_analytics_summary(
    db: AsyncSession,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Return KPI summary with period-over-period comparison.
    If date_from and date_to are given, also compute the same metrics for the
    previous period of equal length and return change_pct + trend."""

    async def _counts(d_from: Optional[datetime], d_to: Optional[datetime]) -> dict:
        # Total applications
        app_conds = [CandidateJobEntry.deleted_at.is_(None)]
        if d_from:
            app_conds.append(CandidateJobEntry.created_at >= d_from)
        if d_to:
            app_conds.append(CandidateJobEntry.created_at <= d_to)
        total_apps = (await db.execute(
            select(func.count(CandidateJobEntry.id)).where(*app_conds)
        )).scalar() or 0

        # Active jobs
        job_conds = [JobDescription.deleted_at.is_(None), JobDescription.status == "Open"]
        if d_from:
            job_conds.append(JobDescription.created_at >= d_from)
        if d_to:
            job_conds.append(JobDescription.created_at <= d_to)
        active_jobs = (await db.execute(
            select(func.count(JobDescription.id)).where(*job_conds)
        )).scalar() or 0

        # Interviews scheduled
        int_conds = []
        if d_from:
            int_conds.append(InterviewSchedule.created_at >= d_from)
        if d_to:
            int_conds.append(InterviewSchedule.created_at <= d_to)
        interviews = (await db.execute(
            select(func.count(InterviewSchedule.id)).where(*int_conds) if int_conds
            else select(func.count(InterviewSchedule.id))
        )).scalar() or 0

        # Offers sent
        offer_conds = [Offer.deleted_at.is_(None)]
        if d_from:
            offer_conds.append(Offer.created_at >= d_from)
        if d_to:
            offer_conds.append(Offer.created_at <= d_to)
        offers = (await db.execute(
            select(func.count(Offer.id)).where(*offer_conds)
        )).scalar() or 0

        # Hires
        hire_conds = [
            CandidateJobEntry.pipeline_stage == "hired",
            CandidateJobEntry.deleted_at.is_(None),
        ]
        if d_from:
            hire_conds.append(CandidateJobEntry.stage_changed_at >= d_from)
        if d_to:
            hire_conds.append(CandidateJobEntry.stage_changed_at <= d_to)
        hires = (await db.execute(
            select(func.count(CandidateJobEntry.id)).where(*hire_conds)
        )).scalar() or 0

        # Avg time to hire (days)
        tth_conds = [
            CandidateJobEntry.pipeline_stage == "hired",
            CandidateJobEntry.stage_changed_at.isnot(None),
            CandidateJobEntry.deleted_at.is_(None),
        ]
        if d_from:
            tth_conds.append(CandidateJobEntry.stage_changed_at >= d_from)
        if d_to:
            tth_conds.append(CandidateJobEntry.stage_changed_at <= d_to)
        days_expr = func.extract(
            "epoch",
            CandidateJobEntry.stage_changed_at - CandidateJobEntry.created_at,
        ) / 86400.0
        avg_tth = (await db.execute(
            select(func.avg(days_expr)).where(*tth_conds)
        )).scalar()
        avg_tth = round(float(avg_tth), 1) if avg_tth else 0.0

        # Offer acceptance rate
        oa_conds = [Offer.deleted_at.is_(None)]
        if d_from:
            oa_conds.append(Offer.created_at >= d_from)
        if d_to:
            oa_conds.append(Offer.created_at <= d_to)
        accepted_case = case((Offer.status == "accepted", 1), else_=0)
        oa_result = (await db.execute(
            select(
                func.count(Offer.id).label("total"),
                func.sum(accepted_case).label("accepted"),
            ).where(*oa_conds)
        )).one()
        oa_total = oa_result.total or 0
        oa_accepted = int(oa_result.accepted or 0)
        oa_rate = round((oa_accepted / oa_total) * 100, 1) if oa_total > 0 else 0.0

        return {
            "total_applications": total_apps,
            "active_jobs": active_jobs,
            "interviews_scheduled": interviews,
            "offers_sent": offers,
            "hires": hires,
            "avg_time_to_hire": avg_tth,
            "offer_acceptance_rate": oa_rate,
        }

    current = await _counts(date_from, date_to)

    # Compute previous period for comparison
    prev = None
    if date_from and date_to:
        period_length = date_to - date_from
        prev_from = date_from - period_length
        prev_to = date_from
        prev = await _counts(prev_from, prev_to)

    def _build_metric(key: str, value, prev_value=None) -> dict:
        if prev_value is not None and prev_value != 0:
            change_pct = round(((value - prev_value) / prev_value) * 100, 1)
        elif prev_value == 0 and value > 0:
            change_pct = 100.0
        else:
            change_pct = 0.0

        if change_pct > 0:
            trend = "up"
        elif change_pct < 0:
            trend = "down"
        else:
            trend = "flat"

        # For avg_time_to_hire, lower is better — invert the trend
        if key == "avg_time_to_hire":
            if trend == "up":
                trend = "down"
            elif trend == "down":
                trend = "up"

        return {"value": value, "change_pct": change_pct, "trend": trend}

    result = {}
    for key in current:
        prev_val = prev[key] if prev else None
        result[key] = _build_metric(key, current[key], prev_val)

    return result


async def get_job_board_performance(
    db: AsyncSession,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Group CandidateJobEntry by source, count applications, and compute conversion rates per source."""
    conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if date_from is not None:
        conditions.append(CandidateJobEntry.created_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.created_at <= date_to)

    screened_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["screening", "ai_interview", "interview", "offer", "hired"]), 1),
        else_=0,
    )
    hired_case = case(
        (CandidateJobEntry.pipeline_stage == "hired", 1),
        else_=0,
    )

    query = (
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("applications"),
            func.sum(screened_case).label("screened"),
            func.sum(hired_case).label("hired"),
        )
        .where(*conditions)
        .group_by(CandidateJobEntry.source)
        .order_by(func.count(CandidateJobEntry.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()

    boards = []
    for row in rows:
        applications = row.applications or 0
        screened = int(row.screened or 0)
        hired = int(row.hired or 0)
        conversion_rate = round((hired / applications) * 100, 1) if applications > 0 else 0.0
        boards.append({
            "board": row.source or "unknown",
            "applications": applications,
            "screened": screened,
            "hired": hired,
            "conversion_rate": conversion_rate,
        })

    return {"boards": boards}


async def get_scheduling_lag(
    db: AsyncSession,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Compute avg days between consecutive stage transitions using PipelineStageHistory."""
    conditions = []
    if date_from is not None:
        conditions.append(PipelineStageHistory.created_at >= date_from)
    if date_to is not None:
        conditions.append(PipelineStageHistory.created_at <= date_to)

    query = (
        select(PipelineStageHistory)
        .where(*conditions) if conditions
        else select(PipelineStageHistory)
    )
    query = query.order_by(PipelineStageHistory.candidate_id, PipelineStageHistory.created_at)

    result = await db.execute(query)
    rows = result.scalars().all()

    # Group consecutive transitions by (from_stage -> to_stage) and compute durations
    transition_durations: dict[tuple[str, str], list[float]] = {}
    prev: dict[int, PipelineStageHistory] = {}

    for row in rows:
        cid = row.candidate_id
        if cid in prev:
            p = prev[cid]
            from_stage = p.to_stage or "unknown"
            to_stage = row.to_stage or "unknown"
            duration = (row.created_at - p.created_at).total_seconds() / 86400.0
            if duration >= 0:
                key = (from_stage, to_stage)
                transition_durations.setdefault(key, []).append(duration)
        prev[cid] = row

    transitions = []
    for (from_stage, to_stage), durations in sorted(transition_durations.items()):
        avg_days = round(sum(durations) / len(durations), 1) if durations else 0.0
        transitions.append({
            "from_stage": from_stage,
            "to_stage": to_stage,
            "avg_days": avg_days,
            "count": len(durations),
        })

    return {"transitions": transitions}


async def get_job_attractiveness(
    db: AsyncSession,
    jd_id: int,
) -> dict:
    """Compute Job Attractiveness Score (0-100) based on views, applications, conversion rate, etc."""
    from app.db.models import JobBoardPosting

    # Get aggregate views and applications from job board postings
    posting_result = await db.execute(
        select(
            func.coalesce(func.sum(JobBoardPosting.views), 0).label("total_views"),
            func.coalesce(func.sum(JobBoardPosting.applications), 0).label("total_applications"),
        ).where(JobBoardPosting.jd_id == jd_id)
    )
    posting_row = posting_result.one()
    total_views = int(posting_row.total_views)
    total_applications = int(posting_row.total_applications)

    # Get direct applications count
    direct_apps = (await db.execute(
        select(func.count(CandidateJobEntry.id)).where(
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )).scalar() or 0

    total_applications = max(total_applications, direct_apps)

    # Apply conversion rate
    apply_conversion_rate = round((total_applications / total_views) * 100, 1) if total_views > 0 else 0.0

    # Check if JD has salary info (increases attractiveness)
    jd_result = await db.execute(select(JobDescription).where(JobDescription.id == jd_id))
    jd = jd_result.scalar_one_or_none()
    has_salary = bool(jd and jd.salary_range_min and jd.salary_range_max) if jd else False
    salary_score = 15 if has_salary else 0

    # JD quality check (has rubric, model answers)
    jd_quality_score = 0
    if jd:
        if jd.rubric_text and len(jd.rubric_text) > 50:
            jd_quality_score += 10
        ai = jd.ai_result or {}
        if ai.get("extracted_rubric", {}).get("core_skills"):
            jd_quality_score += 10
        if ai.get("summary") and len(ai.get("summary", "")) > 100:
            jd_quality_score += 5

    # View score (0-25 based on logarithmic scale)
    import math
    view_score = min(25, int(math.log10(max(total_views, 1) + 1) * 10))

    # Application score (0-25)
    app_score = min(25, int(math.log10(max(total_applications, 1) + 1) * 12))

    # Conversion score (0-10)
    conv_score = min(10, int(apply_conversion_rate))

    attractiveness_score = min(100, view_score + app_score + conv_score + salary_score + jd_quality_score)

    suggestions = []
    if not has_salary:
        suggestions.append("Add salary range to attract more applicants")
    if jd_quality_score < 15:
        suggestions.append("Improve job description with detailed skills and requirements")
    if total_views < 50:
        suggestions.append("Promote job on more platforms to increase visibility")
    if apply_conversion_rate < 5 and total_views > 20:
        suggestions.append("Optimize job title and description for better conversion")

    return {
        "score": attractiveness_score,
        "total_views": total_views,
        "total_applications": total_applications,
        "apply_conversion_rate": apply_conversion_rate,
        "has_salary_info": has_salary,
        "jd_quality_score": jd_quality_score,
        "suggestions": suggestions,
    }


async def get_application_source_analytics(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Track application sources with detailed conversion metrics."""
    conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)
    if date_from is not None:
        conditions.append(CandidateJobEntry.created_at >= date_from)
    if date_to is not None:
        conditions.append(CandidateJobEntry.created_at <= date_to)

    hired_case = case(
        (CandidateJobEntry.pipeline_stage == "hired", 1),
        else_=0,
    )
    screened_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["screening", "ai_interview", "interview", "offer", "hired"]), 1),
        else_=0,
    )
    interviewed_case = case(
        (CandidateJobEntry.pipeline_stage.in_(["interview", "offer", "hired"]), 1),
        else_=0,
    )

    query = (
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("applications"),
            func.sum(screened_case).label("screened"),
            func.sum(interviewed_case).label("interviewed"),
            func.sum(hired_case).label("hired"),
        )
        .where(*conditions)
        .group_by(CandidateJobEntry.source)
        .order_by(func.count(CandidateJobEntry.id).desc())
    )
    result = await db.execute(query)
    rows = result.all()

    sources = []
    for row in rows:
        total = row.applications or 0
        hired = int(row.hired or 0)
        hire_rate = round((hired / total) * 100, 1) if total > 0 else 0.0
        sources.append({
            "source": row.source or "unknown",
            "applications": total,
            "screened": int(row.screened or 0),
            "interviewed": int(row.interviewed or 0),
            "hired": hired,
            "hire_rate": hire_rate,
        })

    return {"sources": sources}


async def get_compatibility_score(
    db: AsyncSession,
    candidate_id: int,
    jd_id: int,
) -> dict:
    """Compute weighted compatibility score for a candidate-job pair.
    Weights: resume 25%, skills 20%, AI interview 25%, feedback 20%, culture fit 10%.
    """
    from app.db.models import InterviewerFeedback

    entry_result = await db.execute(
        select(CandidateJobEntry).where(
            CandidateJobEntry.id == candidate_id,
            CandidateJobEntry.jd_id == jd_id,
            CandidateJobEntry.deleted_at.is_(None),
        )
    )
    entry = entry_result.scalar_one_or_none()
    if not entry:
        return {"error": "Candidate not found for this job", "score": 0, "breakdown": {}}

    # Extract scores from ai_resume_analysis JSONB
    ai_analysis = entry.ai_resume_analysis or {}
    resume_score = float(ai_analysis.get("overall_score", ai_analysis.get("score", 0)))

    skills_data = ai_analysis.get("skills_match", ai_analysis.get("skill_match", {}))
    if isinstance(skills_data, dict):
        skills_score = float(skills_data.get("score", skills_data.get("match_percentage", 0)))
    elif isinstance(skills_data, (int, float)):
        skills_score = float(skills_data)
    else:
        skills_score = resume_score * 0.8

    # AI interview score from ai_resume_analysis or default to 0
    ai_interview_score = float(ai_analysis.get("ai_interview_score", 0))

    feedback_score = 0.0
    try:
        fb_result = await db.execute(
            select(func.avg(InterviewerFeedback.rating))
            .join(InterviewSchedule, InterviewerFeedback.schedule_id == InterviewSchedule.id)
            .where(
                InterviewSchedule.candidate_id == candidate_id,
                InterviewSchedule.jd_id == jd_id,
            )
        )
        fb_avg = fb_result.scalar()
        feedback_score = float(fb_avg) * 20 if fb_avg else 0.0  # 1-5 → 0-100
    except Exception:
        feedback_score = 0.0

    culture_fit = float(ai_analysis.get("culture_fit", ai_analysis.get("cultural_fit", 0)))
    if culture_fit == 0 and feedback_score > 0:
        culture_fit = feedback_score * 0.9

    weighted_score = (
        resume_score * 0.25
        + skills_score * 0.20
        + ai_interview_score * 0.25
        + feedback_score * 0.20
        + culture_fit * 0.10
    )

    return {
        "score": round(weighted_score, 1),
        "breakdown": {
            "resume": {"score": round(resume_score, 1), "weight": 0.25},
            "skills": {"score": round(skills_score, 1), "weight": 0.20},
            "ai_interview": {"score": round(ai_interview_score, 1), "weight": 0.25},
            "feedback": {"score": round(feedback_score, 1), "weight": 0.20},
            "culture_fit": {"score": round(culture_fit, 1), "weight": 0.10},
        },
        "candidate_id": candidate_id,
        "jd_id": jd_id,
    }


async def get_ai_interview_analytics(
    db: AsyncSession,
    jd_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """AI interview analytics: status counts, score distribution, recommendation breakdown."""
    conditions = []
    if jd_id is not None:
        conditions.append(AIInterviewSession.jd_id == jd_id)
    if date_from is not None:
        conditions.append(AIInterviewSession.created_at >= date_from)
    if date_to is not None:
        conditions.append(AIInterviewSession.created_at <= date_to)

    where = and_(*conditions) if conditions else True

    # Status breakdown
    status_q = (
        select(
            AIInterviewSession.status,
            func.count(AIInterviewSession.id).label("count"),
        )
        .where(where)
        .group_by(AIInterviewSession.status)
    )
    status_rows = (await db.execute(status_q)).all()
    status_counts = {row.status: row.count for row in status_rows}
    total = sum(status_counts.values())
    completed = status_counts.get("completed", 0)

    # Aggregate scores for completed interviews
    score_agg = (
        select(
            func.round(func.avg(AIInterviewSession.overall_score), 1).label("avg_score"),
            func.min(AIInterviewSession.overall_score).label("min_score"),
            func.max(AIInterviewSession.overall_score).label("max_score"),
        )
        .where(where)
        .where(AIInterviewSession.status == "completed", AIInterviewSession.overall_score.isnot(None))
    )
    agg_row = (await db.execute(score_agg)).first()
    avg_score = float(agg_row.avg_score or 0) if agg_row else 0
    min_score = float(agg_row.min_score or 0) if agg_row else 0
    max_score = float(agg_row.max_score or 0) if agg_row else 0

    # Score distribution buckets (0-20, 20-40, 40-60, 60-80, 80-100)
    buckets = []
    for low, high, label in [(0, 20, "0-20"), (20, 40, "20-40"), (40, 60, "40-60"), (60, 80, "60-80"), (80, 101, "80-100")]:
        cnt = (await db.execute(
            select(func.count()).select_from(AIInterviewSession)
            .where(where)
            .where(
                AIInterviewSession.status == "completed",
                AIInterviewSession.overall_score.isnot(None),
                AIInterviewSession.overall_score >= low,
                AIInterviewSession.overall_score < high,
            )
        )).scalar_one()
        buckets.append({"range": label, "count": cnt})

    # Recommendation breakdown
    rec_q = (
        select(
            AIInterviewSession.ai_recommendation,
            func.count(AIInterviewSession.id).label("count"),
        )
        .where(where)
        .where(AIInterviewSession.status == "completed", AIInterviewSession.ai_recommendation.isnot(None))
        .group_by(AIInterviewSession.ai_recommendation)
    )
    rec_rows = (await db.execute(rec_q)).all()
    recommendations = [{"recommendation": row.ai_recommendation or "unknown", "count": row.count} for row in rec_rows]

    # Top jobs by AI interview count
    top_jobs_q = (
        select(
            AIInterviewSession.jd_id,
            JobDescription.title,
            func.count(AIInterviewSession.id).label("total"),
            func.count(case((AIInterviewSession.status == "completed", 1))).label("completed"),
            func.round(func.avg(
                case((AIInterviewSession.status == "completed", AIInterviewSession.overall_score))
            ), 1).label("avg_score"),
        )
        .join(JobDescription, JobDescription.id == AIInterviewSession.jd_id, isouter=True)
        .where(where)
        .group_by(AIInterviewSession.jd_id, JobDescription.title)
        .order_by(func.count(AIInterviewSession.id).desc())
        .limit(10)
    )
    top_jobs_rows = (await db.execute(top_jobs_q)).all()
    top_jobs = [
        {
            "jd_id": row.jd_id,
            "title": row.title or f"Job #{row.jd_id}",
            "total": row.total,
            "completed": row.completed,
            "avg_score": float(row.avg_score or 0),
        }
        for row in top_jobs_rows
    ]

    return {
        "total": total,
        "status_counts": status_counts,
        "completed": completed,
        "completion_rate": round(completed / total * 100, 1) if total > 0 else 0,
        "avg_score": avg_score,
        "min_score": min_score,
        "max_score": max_score,
        "score_distribution": buckets,
        "recommendations": recommendations,
        "top_jobs": top_jobs,
    }
