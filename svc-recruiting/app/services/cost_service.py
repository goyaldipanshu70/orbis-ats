import logging
from typing import List, Optional, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.db.models import HiringCost, CandidateJobEntry, JobDescription

logger = logging.getLogger("svc-recruiting")


async def add_cost(db: AsyncSession, jd_id: int, cost_type: str, amount: float, currency: str, description: str, created_by: str) -> dict:
    cost = HiringCost(
        jd_id=jd_id,
        cost_type=cost_type,
        amount=amount,
        currency=currency or "USD",
        description=description,
        created_by=created_by,
        created_at=datetime.utcnow(),
    )
    db.add(cost)
    await db.commit()
    await db.refresh(cost)
    return _cost_to_dict(cost)


async def get_costs(db: AsyncSession, jd_id: int) -> List[dict]:
    result = await db.execute(
        select(HiringCost).where(HiringCost.jd_id == jd_id).order_by(HiringCost.created_at.desc())
    )
    return [_cost_to_dict(c) for c in result.scalars().all()]


async def delete_cost(db: AsyncSession, cost_id: int) -> bool:
    result = await db.execute(delete(HiringCost).where(HiringCost.id == cost_id))
    await db.commit()
    return result.rowcount > 0


async def get_cost_per_hire(db: AsyncSession, jd_id: Optional[int] = None) -> dict:
    """Calculate cost-per-hire analytics."""
    cost_conditions = []
    hire_conditions = [
        CandidateJobEntry.pipeline_stage == "hired",
        CandidateJobEntry.deleted_at.is_(None),
    ]
    if jd_id:
        cost_conditions.append(HiringCost.jd_id == jd_id)
        hire_conditions.append(CandidateJobEntry.jd_id == jd_id)

    # Total costs by type
    cost_query = select(
        HiringCost.cost_type,
        func.sum(HiringCost.amount).label("total"),
    )
    if cost_conditions:
        cost_query = cost_query.where(*cost_conditions)
    cost_query = cost_query.group_by(HiringCost.cost_type)

    cost_result = await db.execute(cost_query)
    cost_by_type = {row.cost_type: float(row.total) for row in cost_result.all()}
    total_cost = sum(cost_by_type.values())

    # Total hires
    hire_count = (await db.execute(
        select(func.count(CandidateJobEntry.id)).where(*hire_conditions)
    )).scalar() or 0

    # Total candidates
    cand_conditions = [CandidateJobEntry.deleted_at.is_(None)]
    if jd_id:
        cand_conditions.append(CandidateJobEntry.jd_id == jd_id)
    total_candidates = (await db.execute(
        select(func.count(CandidateJobEntry.id)).where(*cand_conditions)
    )).scalar() or 0

    cost_per_hire = round(total_cost / hire_count, 2) if hire_count > 0 else 0
    cost_per_candidate = round(total_cost / total_candidates, 2) if total_candidates > 0 else 0

    return {
        "total_cost": total_cost,
        "cost_per_hire": cost_per_hire,
        "cost_per_candidate": cost_per_candidate,
        "total_hires": hire_count,
        "total_candidates": total_candidates,
        "cost_by_type": cost_by_type,
    }


def _cost_to_dict(c: HiringCost) -> dict:
    return {
        "id": c.id,
        "jd_id": c.jd_id,
        "cost_type": c.cost_type,
        "amount": float(c.amount),
        "currency": c.currency,
        "description": c.description,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }
