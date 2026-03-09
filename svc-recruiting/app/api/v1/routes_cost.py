from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services.cost_service import add_cost, get_costs, delete_cost, get_cost_per_hire
from typing import Optional

router = APIRouter()


@router.post("/{job_id}/costs")
async def add_hiring_cost(
    job_id: str,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if not body.get("cost_type") or body.get("amount") is None:
        raise HTTPException(status_code=400, detail="cost_type and amount are required")
    return await add_cost(
        db, int(job_id), body["cost_type"], float(body["amount"]),
        body.get("currency", "USD"), body.get("description", ""), user["sub"],
    )


@router.get("/{job_id}/costs")
async def list_hiring_costs(
    job_id: str,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_costs(db, int(job_id))


@router.delete("/costs/{cost_id}")
async def remove_hiring_cost(
    cost_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_cost(db, cost_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    return {"message": "Cost deleted"}


@router.get("/analytics/cost-per-hire")
async def cost_per_hire_analytics(
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await get_cost_per_hire(db, jd_id)
