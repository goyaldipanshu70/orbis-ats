import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.db.models import CandidateJobEntry, CandidateProfile

logger = logging.getLogger("svc-recruiting")

# SLA thresholds in days per stage
SLA_THRESHOLDS = {
    "screening": 7,
    "ai_interview": 5,
    "interview": 14,
    "offer": 7,
}

TERMINAL_STAGES = {"hired", "rejected"}


async def get_diversity_stats(db: AsyncSession) -> dict:
    """Source distribution, pipeline stage distribution by source, conversion rates by source."""

    # ── Source distribution (total count by source) ────────────────────
    src_result = await db.execute(
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("count"),
        )
        .where(CandidateJobEntry.deleted_at.is_(None))
        .group_by(CandidateJobEntry.source)
    )
    source_distribution = [
        {"source": row.source or "unknown", "count": row.count}
        for row in src_result.all()
    ]

    # ── Pipeline stage distribution by source ──────────────────────────
    stage_src_result = await db.execute(
        select(
            CandidateJobEntry.source,
            CandidateJobEntry.pipeline_stage,
            func.count(CandidateJobEntry.id).label("count"),
        )
        .where(CandidateJobEntry.deleted_at.is_(None))
        .group_by(CandidateJobEntry.source, CandidateJobEntry.pipeline_stage)
    )
    stage_by_source: dict[str, dict[str, int]] = {}
    for row in stage_src_result.all():
        src = row.source or "unknown"
        if src not in stage_by_source:
            stage_by_source[src] = {}
        stage_by_source[src][row.pipeline_stage] = row.count

    # ── Conversion rates by source ─────────────────────────────────────
    hired_case = case(
        (CandidateJobEntry.pipeline_stage == "hired", 1),
        else_=0,
    )
    conv_result = await db.execute(
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("total"),
            func.sum(hired_case).label("hired"),
        )
        .where(CandidateJobEntry.deleted_at.is_(None))
        .group_by(CandidateJobEntry.source)
    )
    conversion_rates = []
    for row in conv_result.all():
        total = row.total or 0
        hired = int(row.hired or 0)
        conversion_rates.append({
            "source": row.source or "unknown",
            "total": total,
            "hired": hired,
            "rate": round(hired / total, 4) if total > 0 else 0.0,
        })

    return {
        "source_distribution": source_distribution,
        "stage_by_source": stage_by_source,
        "conversion_rates": conversion_rates,
    }


async def get_sla_stats(
    db: AsyncSession,
    jd_id: Optional[int] = None,
) -> dict:
    """For each candidate in non-terminal stages, compute days in current stage and flag overdue."""

    conditions = [
        CandidateJobEntry.deleted_at.is_(None),
        CandidateJobEntry.pipeline_stage.notin_(list(TERMINAL_STAGES)),
        CandidateJobEntry.stage_changed_at.isnot(None),
    ]
    if jd_id is not None:
        conditions.append(CandidateJobEntry.jd_id == jd_id)

    result = await db.execute(
        select(CandidateJobEntry, CandidateProfile)
        .join(CandidateProfile, CandidateJobEntry.profile_id == CandidateProfile.id)
        .where(*conditions)
        .order_by(CandidateJobEntry.stage_changed_at)
    )
    rows = result.all()

    now = datetime.utcnow()
    candidates_list = []
    total_days = 0.0
    overdue_count = 0

    for row in rows:
        entry: CandidateJobEntry = row.CandidateJobEntry
        profile: CandidateProfile = row.CandidateProfile

        days_in_stage = (now - entry.stage_changed_at).days
        total_days += days_in_stage

        threshold = SLA_THRESHOLDS.get(entry.pipeline_stage)
        is_overdue = threshold is not None and days_in_stage > threshold

        # Severity: low (1-2x), medium (2-3x), high (>3x)
        severity = None
        if is_overdue and threshold:
            ratio = days_in_stage / threshold
            if ratio > 3:
                severity = "high"
            elif ratio > 2:
                severity = "medium"
            else:
                severity = "low"
            overdue_count += 1

        candidates_list.append({
            "candidate_id": entry.id,
            "name": profile.full_name or "",
            "email": profile.email or "",
            "current_stage": entry.pipeline_stage,
            "days_in_stage": days_in_stage,
            "is_overdue": is_overdue,
            "severity": severity,
        })

    avg_days = round(total_days / len(candidates_list), 1) if candidates_list else 0.0

    return {
        "overdue_count": overdue_count,
        "avg_days_in_stage": avg_days,
        "total_candidates": len(candidates_list),
        "candidates": candidates_list,
    }


async def get_eeo_summary(db: AsyncSession) -> dict:
    """Placeholder EEO summary — counts by source and stage."""

    # Count by source
    src_result = await db.execute(
        select(
            CandidateJobEntry.source,
            func.count(CandidateJobEntry.id).label("count"),
        )
        .where(CandidateJobEntry.deleted_at.is_(None))
        .group_by(CandidateJobEntry.source)
    )
    by_source = {(row.source or "unknown"): row.count for row in src_result.all()}

    # Count by stage
    stage_result = await db.execute(
        select(
            CandidateJobEntry.pipeline_stage,
            func.count(CandidateJobEntry.id).label("count"),
        )
        .where(CandidateJobEntry.deleted_at.is_(None))
        .group_by(CandidateJobEntry.pipeline_stage)
    )
    by_stage = {row.pipeline_stage: row.count for row in stage_result.all()}

    total_result = await db.execute(
        select(func.count(CandidateJobEntry.id))
        .where(CandidateJobEntry.deleted_at.is_(None))
    )
    total = total_result.scalar_one()

    return {
        "total_candidates": total,
        "by_source": by_source,
        "by_stage": by_stage,
        "note": "This is a placeholder EEO summary. Demographic data collection requires candidate consent.",
    }
