from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.scorecard_service import get_scorecard, compare_candidates, get_timeline

router = APIRouter()


class CompareRequest(BaseModel):
    candidate_ids: List[int]
    jd_id: int


@router.get("/{candidate_id}")
async def scorecard_endpoint(
    candidate_id: int,
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await get_scorecard(db, candidate_id, jd_id=jd_id)
    if not result:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return result


@router.post("/compare")
async def compare_endpoint(
    body: CompareRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    if len(body.candidate_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 candidate IDs required")
    return await compare_candidates(db, body.candidate_ids, body.jd_id)


@router.get("/{candidate_id}/timeline")
async def timeline_endpoint(
    candidate_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await get_timeline(db, candidate_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return result
