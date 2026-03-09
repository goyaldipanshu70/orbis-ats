from fastapi import APIRouter, Depends, Header, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_hiring_access
from app.services.campaign_service import (
    create_campaign,
    get_campaigns,
    get_campaign_detail,
    add_campaign_step,
    send_campaign,
    create_automation,
    get_automations,
    update_automation,
    delete_automation,
)

router = APIRouter()


# ── Request schemas ──────────────────────────────────────────────────────


class CampaignCreateRequest(BaseModel):
    name: str
    jd_id: Optional[int] = None
    template_subject: str
    template_body: str
    audience_filter: Optional[dict] = None
    campaign_type: str = "one_time"


class CampaignStepRequest(BaseModel):
    step_number: int = 1
    delay_days: int = 0
    subject: str
    body: str


class AutomationCreateRequest(BaseModel):
    jd_id: int
    trigger_stage: str
    email_subject: str
    email_body: str


class AutomationUpdateRequest(BaseModel):
    trigger_stage: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    is_active: Optional[bool] = None


# ── Campaign endpoints ───────────────────────────────────────────────────


@router.post("/campaigns")
async def create_campaign_endpoint(
    body: CampaignCreateRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await create_campaign(db, body.model_dump(), user["sub"])
    return result


@router.get("/campaigns")
async def list_campaigns_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_campaigns(db, page=page, page_size=page_size)


@router.get("/campaigns/{campaign_id}")
async def get_campaign_endpoint(
    campaign_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    detail = await get_campaign_detail(db, campaign_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return detail


@router.post("/campaigns/{campaign_id}/steps")
async def add_step_endpoint(
    campaign_id: int,
    body: CampaignStepRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    step = await add_campaign_step(db, campaign_id, body.model_dump())
    if not step:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return step


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign_endpoint(
    campaign_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await send_campaign(db, campaign_id)
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result


# ── Automation endpoints ─────────────────────────────────────────────────


@router.post("/automations")
async def create_automation_endpoint(
    body: AutomationCreateRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await create_automation(db, body.model_dump(), user["sub"])


@router.get("/automations")
async def list_automations_endpoint(
    jd_id: Optional[int] = Query(None),
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    return await get_automations(db, jd_id=jd_id)


@router.put("/automations/{automation_id}")
async def update_automation_endpoint(
    automation_id: int,
    body: AutomationUpdateRequest,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    result = await update_automation(db, automation_id, body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Automation not found")
    return result


@router.delete("/automations/{automation_id}")
async def delete_automation_endpoint(
    automation_id: int,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_automation(db, automation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"message": "Automation deleted"}


# ── Tracking & ad-hoc email endpoints ──────────────────────────────────


@router.get("/outreach/tracking/open/{tracking_id}")
async def track_open(
    tracking_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Returns 1x1 transparent GIF and records open event."""
    from app.db.models import EmailCampaignRecipient
    from datetime import datetime
    from fastapi.responses import Response
    import base64

    # Update opened_at
    result = await db.execute(
        select(EmailCampaignRecipient).where(EmailCampaignRecipient.id == int(tracking_id))
    )
    recipient = result.scalar_one_or_none()
    if recipient and not recipient.opened_at:
        recipient.opened_at = datetime.utcnow()
        await db.commit()

    # 1x1 transparent GIF
    gif = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=gif, media_type="image/gif")


@router.get("/outreach/tracking/click/{tracking_id}")
async def track_click(
    tracking_id: str,
    url: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Records click event and redirects to original URL."""
    from app.db.models import EmailCampaignRecipient
    from datetime import datetime
    from fastapi.responses import RedirectResponse

    result = await db.execute(
        select(EmailCampaignRecipient).where(EmailCampaignRecipient.id == int(tracking_id))
    )
    recipient = result.scalar_one_or_none()
    if recipient and not recipient.clicked_at:
        recipient.clicked_at = datetime.utcnow()
        await db.commit()

    return RedirectResponse(url=url)


@router.post("/outreach/email/send")
async def send_adhoc_email(
    payload: dict,
    user: dict = Depends(require_hiring_access),
    db: AsyncSession = Depends(get_db),
):
    """Send an ad-hoc email to a recipient."""
    from app.services.email_service import send_email

    to = payload.get("to")
    subject = payload.get("subject")
    body = payload.get("body")
    if not to or not subject or not body:
        raise HTTPException(status_code=400, detail="to, subject, and body are required")

    await send_email(to=to, subject=subject, body_html=body)
    return {"status": "sent", "to": to}


@router.post("/internal/email/send")
async def send_internal_email(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    x_internal_key: str = Header(None, alias="X-Internal-Key"),
):
    """Internal endpoint for service-to-service email sending."""
    from app.core.config import settings
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal key")

    to = payload.get("to")
    subject = payload.get("subject")
    body = payload.get("body")
    if not to or not subject or not body:
        raise HTTPException(status_code=400, detail="to, subject, and body are required")

    from app.services.email_service import send_email
    success = await send_email(to=to, subject=subject, body_html=body)
    return {"status": "sent" if success else "failed", "to": to}
