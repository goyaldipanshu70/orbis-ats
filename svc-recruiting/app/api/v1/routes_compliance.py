from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.compliance_service import get_diversity_stats, get_sla_stats, get_eeo_summary

router = APIRouter()


@router.get("/diversity")
async def diversity_endpoint(
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_diversity_stats(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch diversity stats: {e}")


@router.get("/sla")
async def sla_endpoint(
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_sla_stats(db, jd_id=jd_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SLA stats: {e}")


@router.get("/eeo")
async def eeo_endpoint(
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_eeo_summary(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch EEO summary: {e}")
