from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from io import StringIO
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access, require_hr_or_admin
from app.services.export_service import export_candidate, erase_candidate, export_job_candidates

router = APIRouter()


@router.get("/candidate/{candidate_id}")
async def export_candidate_endpoint(
    candidate_id: int,
    format: Optional[str] = Query("json", regex="^(json|csv)$"),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await export_candidate(db, candidate_id, format=format)

    if format == "csv":
        if not result:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return StreamingResponse(
            StringIO(result),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=candidate_{candidate_id}.csv"},
        )

    # JSON format
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/candidate/{candidate_id}/erase")
async def erase_candidate_endpoint(
    candidate_id: int,
    user: dict = Depends(require_hr_or_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await erase_candidate(db, candidate_id)
    if not result.get("erased"):
        raise HTTPException(status_code=404, detail=result.get("error", "Candidate not found"))
    return result


@router.get("/job/{jd_id}/candidates")
async def export_job_candidates_endpoint(
    jd_id: int,
    format: Optional[str] = Query("csv", regex="^(json|csv)$"),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    csv_content = await export_job_candidates(db, jd_id, format=format)
    return StreamingResponse(
        StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=job_{jd_id}_candidates.csv"},
    )
