import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.models import CustomPipelineStage

logger = logging.getLogger("svc-recruiting")

DEFAULT_STAGES = [
    {"name": "applied", "display_name": "Applied", "sort_order": 0, "color": "#6B7280", "is_terminal": False},
    {"name": "screening", "display_name": "Screening", "sort_order": 1, "color": "#3B82F6", "is_terminal": False},
    {"name": "ai_interview", "display_name": "AI Interview", "sort_order": 2, "color": "#7C3AED", "is_terminal": False},
    {"name": "interview", "display_name": "Interview", "sort_order": 3, "color": "#8B5CF6", "is_terminal": False},
    {"name": "offer", "display_name": "Offer", "sort_order": 4, "color": "#F59E0B", "is_terminal": False},
    {"name": "hired", "display_name": "Hired", "sort_order": 5, "color": "#10B981", "is_terminal": True},
    {"name": "rejected", "display_name": "Rejected", "sort_order": 6, "color": "#EF4444", "is_terminal": True},
]


def _stage_to_dict(s: CustomPipelineStage) -> dict:
    return {
        "id": s.id,
        "jd_id": s.jd_id,
        "name": s.name,
        "display_name": s.display_name,
        "sort_order": s.sort_order,
        "color": s.color,
        "is_terminal": s.is_terminal,
    }


async def get_pipeline_config(db: AsyncSession, jd_id: int) -> List[dict]:
    """Return custom stages for a job, or default stages if none exist."""
    result = await db.execute(
        select(CustomPipelineStage)
        .where(CustomPipelineStage.jd_id == jd_id)
        .order_by(CustomPipelineStage.sort_order)
    )
    stages = result.scalars().all()

    if stages:
        return [_stage_to_dict(s) for s in stages]

    # Return defaults (no jd_id or id since they are not persisted)
    return [
        {
            "id": None,
            "jd_id": jd_id,
            "name": d["name"],
            "display_name": d["display_name"],
            "sort_order": d["sort_order"],
            "color": d["color"],
            "is_terminal": d["is_terminal"],
        }
        for d in DEFAULT_STAGES
    ]


async def set_pipeline_config(
    db: AsyncSession,
    jd_id: int,
    stages: List[dict],
) -> List[dict]:
    """Delete existing custom stages for this job and insert new ones."""

    # Delete all existing custom stages for this job
    await db.execute(
        delete(CustomPipelineStage).where(CustomPipelineStage.jd_id == jd_id)
    )

    # Insert new stages
    new_stages = []
    for idx, stage_data in enumerate(stages):
        stage = CustomPipelineStage(
            jd_id=jd_id,
            name=stage_data.get("name", f"stage_{idx}"),
            display_name=stage_data.get("display_name", f"Stage {idx}"),
            sort_order=stage_data.get("sort_order", idx),
            color=stage_data.get("color"),
            is_terminal=stage_data.get("is_terminal", False),
        )
        db.add(stage)
        new_stages.append(stage)

    await db.commit()

    for s in new_stages:
        await db.refresh(s)

    return [_stage_to_dict(s) for s in new_stages]
