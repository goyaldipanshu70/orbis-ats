from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.job_board_service import (
    publish_to_board,
    remove_posting,
    get_postings,
)

router = APIRouter()


class PublishRequest(BaseModel):
    jd_id: int
    board_name: str


# ── Job Board Postings ─────────────────────────────────────────────


@router.post("/publish")
async def publish_to_board_endpoint(
    data: PublishRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    posting = await publish_to_board(db, data.jd_id, data.board_name)
    return posting


@router.delete("/{posting_id}")
async def remove_posting_endpoint(
    posting_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await remove_posting(db, posting_id)
    if not result:
        raise HTTPException(status_code=404, detail="Posting not found")
    return result


@router.get("/")
async def list_postings(
    jd_id: int = Query(...),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_postings(db, jd_id)
