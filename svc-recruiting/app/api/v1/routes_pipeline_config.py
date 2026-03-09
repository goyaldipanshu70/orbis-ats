from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.pipeline_config_service import get_pipeline_config, set_pipeline_config

router = APIRouter()


class PipelineStageInput(BaseModel):
    name: str
    display_name: str
    sort_order: int = 0
    color: str | None = None
    is_terminal: bool = False


@router.get("/")
async def get_config_endpoint(
    jd_id: int = Query(..., description="Job description ID"),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_pipeline_config(db, jd_id)


@router.put("/{jd_id}")
async def set_config_endpoint(
    jd_id: int,
    stages: List[PipelineStageInput],
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    if not stages:
        raise HTTPException(status_code=400, detail="At least one stage is required")

    stages_dicts = [s.model_dump() for s in stages]
    return await set_pipeline_config(db, jd_id, stages_dicts)
