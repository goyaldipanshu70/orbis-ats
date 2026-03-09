from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.inbox_capture_service import (
    create_inbox_config,
    get_inbox_configs,
    get_inbox_config,
    delete_inbox_config,
    process_inbox_scan,
    get_capture_logs,
    update_capture_log_status,
)

router = APIRouter()


class CreateInboxConfigRequest(BaseModel):
    name: str
    imap_host: str
    imap_port: int = 993
    username: str
    password: str
    use_ssl: bool = True
    folder: str = "INBOX"


class UpdateLogStatusRequest(BaseModel):
    status: str  # accepted, rejected
    candidate_id: Optional[int] = None


# -- Inbox Configs -------------------------------------------------------------


@router.post("/configs")
async def create_config(
    req: CreateInboxConfigRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await create_inbox_config(
        db,
        name=req.name,
        imap_host=req.imap_host,
        imap_port=req.imap_port,
        username=req.username,
        password=req.password,
        use_ssl=req.use_ssl,
        folder=req.folder,
        created_by=str(user["sub"]),
    )


@router.get("/configs")
async def list_configs(
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_inbox_configs(db)


@router.get("/configs/{config_id}")
async def get_config_detail(
    config_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await get_inbox_config(db, config_id)
    if not result:
        raise HTTPException(404, "Inbox config not found")
    return result


@router.delete("/configs/{config_id}")
async def remove_config(
    config_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    if not await delete_inbox_config(db, config_id):
        raise HTTPException(404, "Inbox config not found")
    return {"message": "Config deleted"}


# -- Scan ----------------------------------------------------------------------


@router.post("/configs/{config_id}/scan")
async def trigger_scan(
    config_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    config = await get_inbox_config(db, config_id)
    if not config:
        raise HTTPException(404, "Inbox config not found")

    # Fetch full config row (including password, not returned in dict)
    from sqlalchemy import select
    from app.db.models import InboxCaptureConfig
    result = await db.execute(
        select(InboxCaptureConfig).where(InboxCaptureConfig.id == config_id)
    )
    cfg = result.scalar_one()

    try:
        scan_result = await process_inbox_scan(
            db,
            config_id=config_id,
            host=cfg.imap_host,
            port=cfg.imap_port,
            username=cfg.username,
            password=cfg.password,
            use_ssl=cfg.use_ssl,
            folder=cfg.folder,
        )

        # Update last scan time
        from datetime import datetime
        cfg.last_scan_at = datetime.utcnow()
        await db.commit()

        return scan_result
    except Exception as e:
        raise HTTPException(500, f"Scan failed: {str(e)}")


# -- Capture Logs --------------------------------------------------------------


@router.get("/logs")
async def list_capture_logs(
    config_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_capture_logs(db, config_id, status, page, page_size)


@router.put("/logs/{log_id}/status")
async def update_log_status(
    log_id: int,
    req: UpdateLogStatusRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await update_capture_log_status(db, log_id, req.status, req.candidate_id)
    if not result:
        raise HTTPException(404, "Capture log not found")
    return result
