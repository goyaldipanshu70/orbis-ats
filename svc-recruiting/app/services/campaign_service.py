import asyncio
import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, Float
from app.services.email_service import send_email as email_send, send_stage_change
from app.db.models import (
    EmailCampaign,
    EmailCampaignStep,
    EmailCampaignRecipient,
    StageAutomation,
    CandidateJobEntry,
    CandidateProfile,
)

logger = logging.getLogger("svc-recruiting")


# ── Helpers ──────────────────────────────────────────────────────────────


def _campaign_to_dict(c: EmailCampaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "jd_id": c.jd_id,
        "template_subject": c.template_subject,
        "template_body": c.template_body,
        "audience_filter": c.audience_filter,
        "campaign_type": c.campaign_type,
        "status": c.status,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _step_to_dict(s: EmailCampaignStep) -> dict:
    return {
        "id": s.id,
        "campaign_id": s.campaign_id,
        "step_number": s.step_number,
        "delay_days": s.delay_days,
        "subject": s.subject,
        "body": s.body,
    }


def _recipient_to_dict(r: EmailCampaignRecipient) -> dict:
    return {
        "id": r.id,
        "campaign_id": r.campaign_id,
        "step_id": r.step_id,
        "candidate_email": r.candidate_email,
        "candidate_name": r.candidate_name,
        "status": r.status,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        "opened_at": r.opened_at.isoformat() if r.opened_at else None,
        "clicked_at": r.clicked_at.isoformat() if r.clicked_at else None,
    }


def _automation_to_dict(a: StageAutomation) -> dict:
    return {
        "id": a.id,
        "jd_id": a.jd_id,
        "trigger_stage": a.trigger_stage,
        "email_subject": a.email_subject,
        "email_body": a.email_body,
        "is_active": a.is_active,
        "created_by": a.created_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ── Campaign CRUD ────────────────────────────────────────────────────────


async def create_campaign(db: AsyncSession, data: dict, user_id: str) -> dict:
    campaign = EmailCampaign(
        name=data["name"],
        jd_id=data.get("jd_id"),
        template_subject=data["template_subject"],
        template_body=data["template_body"],
        audience_filter=data.get("audience_filter"),
        campaign_type=data.get("campaign_type", "one_time"),
        status="draft",
        scheduled_at=data.get("scheduled_at"),
        created_by=user_id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_to_dict(campaign)


async def get_campaigns(db: AsyncSession, page: int = 1, page_size: int = 20) -> dict:
    # Total count
    total = (await db.execute(
        select(func.count()).select_from(EmailCampaign)
    )).scalar_one()

    # Paginated campaigns
    offset = (page - 1) * page_size
    result = await db.execute(
        select(EmailCampaign)
        .order_by(EmailCampaign.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    campaigns = result.scalars().all()

    items = []
    for c in campaigns:
        d = _campaign_to_dict(c)

        # Aggregate recipient counts
        total_recipients = (await db.execute(
            select(func.count()).select_from(EmailCampaignRecipient)
            .where(EmailCampaignRecipient.campaign_id == c.id)
        )).scalar_one()

        sent_count = (await db.execute(
            select(func.count()).select_from(EmailCampaignRecipient)
            .where(
                EmailCampaignRecipient.campaign_id == c.id,
                EmailCampaignRecipient.status.in_(["sent", "opened", "clicked", "replied"]),
            )
        )).scalar_one()

        opened_count = (await db.execute(
            select(func.count()).select_from(EmailCampaignRecipient)
            .where(
                EmailCampaignRecipient.campaign_id == c.id,
                EmailCampaignRecipient.status.in_(["opened", "clicked", "replied"]),
            )
        )).scalar_one()

        d["total_recipients"] = total_recipients
        d["sent_count"] = sent_count
        d["opened_count"] = opened_count
        items.append(d)

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


async def get_campaign_detail(db: AsyncSession, campaign_id: int) -> Optional[dict]:
    result = await db.execute(
        select(EmailCampaign).where(EmailCampaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        return None

    d = _campaign_to_dict(campaign)

    # Steps
    steps_result = await db.execute(
        select(EmailCampaignStep)
        .where(EmailCampaignStep.campaign_id == campaign_id)
        .order_by(EmailCampaignStep.step_number)
    )
    d["steps"] = [_step_to_dict(s) for s in steps_result.scalars().all()]

    # Recipients
    recipients_result = await db.execute(
        select(EmailCampaignRecipient)
        .where(EmailCampaignRecipient.campaign_id == campaign_id)
        .order_by(EmailCampaignRecipient.id)
    )
    recipients = recipients_result.scalars().all()
    d["recipients"] = [_recipient_to_dict(r) for r in recipients]

    # Analytics
    total_recipients = len(recipients)
    sent_count = sum(1 for r in recipients if r.status in ("sent", "opened", "clicked", "replied"))
    opened_count = sum(1 for r in recipients if r.status in ("opened", "clicked", "replied"))
    clicked_count = sum(1 for r in recipients if r.status in ("clicked", "replied"))
    replied_count = sum(1 for r in recipients if r.status == "replied")

    d["analytics"] = {
        "total_recipients": total_recipients,
        "sent_count": sent_count,
        "opened_count": opened_count,
        "clicked_count": clicked_count,
        "replied_count": replied_count,
    }

    return d


# ── Campaign Steps ───────────────────────────────────────────────────────


async def add_campaign_step(db: AsyncSession, campaign_id: int, data: dict) -> Optional[dict]:
    # Verify campaign exists
    result = await db.execute(
        select(EmailCampaign).where(EmailCampaign.id == campaign_id)
    )
    if not result.scalar_one_or_none():
        return None

    step = EmailCampaignStep(
        campaign_id=campaign_id,
        step_number=data.get("step_number", 1),
        delay_days=data.get("delay_days", 0),
        subject=data["subject"],
        body=data["body"],
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return _step_to_dict(step)


# ── Send Campaign ────────────────────────────────────────────────────────


async def send_campaign(db: AsyncSession, campaign_id: int) -> Optional[dict]:
    """Resolve audience, create recipient rows, send real emails in batches, mark campaign as sent."""
    result = await db.execute(
        select(EmailCampaign).where(EmailCampaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        return None

    if campaign.status == "sent":
        return _campaign_to_dict(campaign)

    audience = campaign.audience_filter or {}
    jd_id = campaign.jd_id

    # Build audience query: CandidateJobEntry joined with CandidateProfile
    query = (
        select(CandidateProfile.email, CandidateProfile.full_name)
        .join(CandidateJobEntry, CandidateJobEntry.profile_id == CandidateProfile.id)
        .where(CandidateJobEntry.deleted_at.is_(None))
        .where(CandidateProfile.deleted_at.is_(None))
    )

    if jd_id:
        query = query.where(CandidateJobEntry.jd_id == jd_id)

    if audience.get("stage"):
        query = query.where(CandidateJobEntry.pipeline_stage == audience["stage"])

    if audience.get("source"):
        query = query.where(CandidateJobEntry.source == audience["source"])

    if audience.get("score_min") is not None:
        query = query.where(
            CandidateJobEntry.ai_resume_analysis["score"].astext.cast(Float) >= float(audience["score_min"])
        )

    # Deduplicate by email
    query = query.distinct(CandidateProfile.email)

    rows = (await db.execute(query)).all()

    # Create recipient rows with status=pending
    recipients = []
    for row in rows:
        email, name = row
        if not email:
            continue
        recipient = EmailCampaignRecipient(
            campaign_id=campaign_id,
            step_id=None,
            candidate_email=email,
            candidate_name=name,
            status="pending",
        )
        db.add(recipient)
        recipients.append(recipient)

    # Mark campaign as sending
    await db.execute(
        update(EmailCampaign)
        .where(EmailCampaign.id == campaign_id)
        .values(status="sending")
    )
    await db.commit()

    # Send real emails in batches of 50 with 1s delay between batches
    batch_size = 50
    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]
        for recipient in batch:
            await email_send(
                to=recipient.candidate_email,
                subject=campaign.template_subject,
                body_html=campaign.template_body,
            )
            recipient.status = "sent"
            recipient.sent_at = datetime.utcnow()

        await db.commit()

        # Rate limit: wait 1s between batches (skip after last batch)
        if i + batch_size < len(recipients):
            await asyncio.sleep(1)

    # Update campaign status to sent
    await db.execute(
        update(EmailCampaign)
        .where(EmailCampaign.id == campaign_id)
        .values(status="sent")
    )
    await db.commit()

    logger.info("Campaign %d sent to %d recipients", campaign_id, len(recipients))
    return await get_campaign_detail(db, campaign_id)


# ── Stage Automations ────────────────────────────────────────────────────


async def create_automation(db: AsyncSession, data: dict, user_id: str) -> dict:
    automation = StageAutomation(
        jd_id=data["jd_id"],
        trigger_stage=data["trigger_stage"],
        email_subject=data["email_subject"],
        email_body=data["email_body"],
        is_active=data.get("is_active", True),
        created_by=user_id,
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return _automation_to_dict(automation)


async def get_automations(db: AsyncSession, jd_id: Optional[int] = None) -> List[dict]:
    query = select(StageAutomation).order_by(StageAutomation.created_at.desc())
    if jd_id is not None:
        query = query.where(StageAutomation.jd_id == jd_id)
    result = await db.execute(query)
    return [_automation_to_dict(a) for a in result.scalars().all()]


async def update_automation(db: AsyncSession, automation_id: int, data: dict) -> Optional[dict]:
    result = await db.execute(
        select(StageAutomation).where(StageAutomation.id == automation_id)
    )
    automation = result.scalar_one_or_none()
    if not automation:
        return None

    update_values = {k: v for k, v in data.items() if v is not None}
    if not update_values:
        return _automation_to_dict(automation)

    await db.execute(
        update(StageAutomation)
        .where(StageAutomation.id == automation_id)
        .values(**update_values)
    )
    await db.commit()

    result = await db.execute(
        select(StageAutomation).where(StageAutomation.id == automation_id)
    )
    automation = result.scalar_one_or_none()
    return _automation_to_dict(automation) if automation else None


async def delete_automation(db: AsyncSession, automation_id: int) -> bool:
    result = await db.execute(
        delete(StageAutomation).where(StageAutomation.id == automation_id)
    )
    await db.commit()
    return result.rowcount > 0


async def trigger_stage_email(db: AsyncSession, candidate_entry: CandidateJobEntry, to_stage: str) -> None:
    """Check if a stage automation exists for the candidate's jd_id + to_stage.
    If yes, send a real stage-change email. Called from candidate_service on stage change."""
    result = await db.execute(
        select(StageAutomation).where(
            StageAutomation.jd_id == candidate_entry.jd_id,
            StageAutomation.trigger_stage == to_stage,
            StageAutomation.is_active.is_(True),
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        return

    # Resolve candidate email from profile
    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == candidate_entry.profile_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.email:
        logger.warning(
            "Stage automation %d triggered but candidate profile %d has no email",
            automation.id, candidate_entry.profile_id,
        )
        return

    # Resolve job title for the email
    from app.db.models import JobDescription
    jd_result = await db.execute(
        select(JobDescription.title).where(JobDescription.id == candidate_entry.jd_id)
    )
    job_title = jd_result.scalar_one_or_none() or "Open Position"

    from_stage = candidate_entry.pipeline_stage or "applied"
    await send_stage_change(
        candidate_email=profile.email,
        candidate_name=profile.full_name or profile.email,
        job_title=job_title,
        from_stage=from_stage,
        to_stage=to_stage,
    )

    logger.info(
        "Stage automation email sent: automation=%d, to=%s, subject=%s, stage=%s",
        automation.id,
        profile.email,
        automation.email_subject,
        to_stage,
    )
