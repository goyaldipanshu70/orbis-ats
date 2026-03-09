import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func

from app.db.models import Lead, LeadList, EmailCampaign, EmailCampaignRecipient

logger = logging.getLogger("svc-recruiting")


# ── Helpers ──────────────────────────────────────────────────────────────


def _list_to_dict(ll: LeadList) -> dict:
    return {
        "id": ll.id,
        "name": ll.name,
        "description": ll.description,
        "source": ll.source,
        "jd_id": ll.jd_id,
        "lead_count": ll.lead_count,
        "status": ll.status,
        "created_by": ll.created_by,
        "created_at": ll.created_at.isoformat() if ll.created_at else None,
    }


def _lead_to_dict(lead: Lead) -> dict:
    return {
        "id": lead.id,
        "list_id": lead.list_id,
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "title": lead.title,
        "company": lead.company,
        "location": lead.location,
        "source_platform": lead.source_platform,
        "source_url": lead.source_url,
        "skills": lead.skills or [],
        "experience_years": lead.experience_years,
        "relevance_score": lead.relevance_score,
        "profile_data": lead.profile_data,
        "status": lead.status,
        "notes": lead.notes,
        "campaign_id": lead.campaign_id,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


# ── Lead Lists ───────────────────────────────────────────────────────────


async def create_lead_list(
    db: AsyncSession,
    name: str,
    source: str,
    created_by: str,
    description: Optional[str] = None,
    jd_id: Optional[int] = None,
) -> dict:
    ll = LeadList(
        name=name,
        description=description,
        source=source,
        jd_id=jd_id,
        created_by=created_by,
    )
    db.add(ll)
    await db.commit()
    await db.refresh(ll)
    return _list_to_dict(ll)


async def get_lead_lists(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    jd_id: Optional[int] = None,
) -> dict:
    conditions = []
    if status:
        conditions.append(LeadList.status == status)
    if jd_id:
        conditions.append(LeadList.jd_id == jd_id)

    total_q = select(func.count(LeadList.id))
    if conditions:
        total_q = total_q.where(*conditions)
    total = (await db.execute(total_q)).scalar() or 0

    q = select(LeadList).order_by(LeadList.created_at.desc())
    if conditions:
        q = q.where(*conditions)
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_list_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_lead_list(db: AsyncSession, list_id: int) -> Optional[dict]:
    result = await db.execute(select(LeadList).where(LeadList.id == list_id))
    ll = result.scalar_one_or_none()
    if not ll:
        return None
    d = _list_to_dict(ll)
    # Include leads
    leads_result = await db.execute(
        select(Lead).where(Lead.list_id == list_id).order_by(Lead.relevance_score.desc().nullslast())
    )
    d["leads"] = [_lead_to_dict(l) for l in leads_result.scalars().all()]
    return d


async def delete_lead_list(db: AsyncSession, list_id: int) -> bool:
    result = await db.execute(select(LeadList).where(LeadList.id == list_id))
    ll = result.scalar_one_or_none()
    if not ll:
        return False
    await db.execute(delete(Lead).where(Lead.list_id == list_id))
    await db.delete(ll)
    await db.commit()
    return True


# ── Leads CRUD ───────────────────────────────────────────────────────────


async def add_leads(
    db: AsyncSession,
    list_id: int,
    leads_data: List[dict],
) -> list[dict]:
    """Add multiple leads to a list. Returns created leads."""
    created = []
    for ld in leads_data:
        lead = Lead(
            list_id=list_id,
            name=ld.get("name", "Unknown"),
            email=ld.get("email"),
            phone=ld.get("phone"),
            title=ld.get("title"),
            company=ld.get("company"),
            location=ld.get("location"),
            source_platform=ld.get("source_platform"),
            source_url=ld.get("source_url"),
            skills=ld.get("skills"),
            experience_years=ld.get("experience_years"),
            relevance_score=ld.get("relevance_score"),
            profile_data=ld.get("profile_data"),
            notes=ld.get("notes"),
        )
        db.add(lead)
        created.append(lead)

    await db.commit()
    for lead in created:
        await db.refresh(lead)

    # Update lead count
    count = (await db.execute(
        select(func.count(Lead.id)).where(Lead.list_id == list_id)
    )).scalar() or 0
    await db.execute(
        update(LeadList).where(LeadList.id == list_id).values(lead_count=count)
    )
    await db.commit()

    return [_lead_to_dict(l) for l in created]


async def update_lead(
    db: AsyncSession,
    lead_id: int,
    data: dict,
) -> Optional[dict]:
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        return None
    for key in ("name", "email", "phone", "title", "company", "location", "status", "notes", "relevance_score"):
        if key in data:
            setattr(lead, key, data[key])
    lead.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(lead)
    return _lead_to_dict(lead)


async def delete_lead(db: AsyncSession, lead_id: int) -> bool:
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        return False
    list_id = lead.list_id
    await db.delete(lead)
    await db.commit()
    # Update count
    count = (await db.execute(
        select(func.count(Lead.id)).where(Lead.list_id == list_id)
    )).scalar() or 0
    await db.execute(
        update(LeadList).where(LeadList.id == list_id).values(lead_count=count)
    )
    await db.commit()
    return True


async def get_lead_stats(db: AsyncSession, list_id: Optional[int] = None) -> dict:
    """Get aggregate lead statistics."""
    conditions = []
    if list_id:
        conditions.append(Lead.list_id == list_id)

    total = (await db.execute(
        select(func.count(Lead.id)).where(*conditions) if conditions else select(func.count(Lead.id))
    )).scalar() or 0

    by_status = {}
    for status in ("new", "contacted", "responded", "converted", "rejected"):
        conds = [Lead.status == status] + conditions
        cnt = (await db.execute(select(func.count(Lead.id)).where(*conds))).scalar() or 0
        by_status[status] = cnt

    by_platform = {}
    platform_q = select(Lead.source_platform, func.count(Lead.id).label("count"))
    if conditions:
        platform_q = platform_q.where(*conditions)
    platform_q = platform_q.group_by(Lead.source_platform).order_by(func.count(Lead.id).desc())
    for row in (await db.execute(platform_q)).all():
        by_platform[row.source_platform or "unknown"] = row.count

    return {
        "total": total,
        "by_status": by_status,
        "by_platform": by_platform,
    }


async def push_leads_to_campaign(
    db: AsyncSession,
    list_id: int,
    campaign_id: int,
) -> dict:
    """Push all leads with email from a list into a campaign as recipients."""
    leads_result = await db.execute(
        select(Lead).where(
            Lead.list_id == list_id,
            Lead.email.isnot(None),
            Lead.email != "",
        )
    )
    leads = leads_result.scalars().all()

    added = 0
    for lead in leads:
        # Check if already a recipient
        existing = (await db.execute(
            select(func.count(EmailCampaignRecipient.id)).where(
                EmailCampaignRecipient.campaign_id == campaign_id,
                EmailCampaignRecipient.candidate_email == lead.email,
            )
        )).scalar() or 0
        if existing > 0:
            continue

        recipient = EmailCampaignRecipient(
            campaign_id=campaign_id,
            candidate_email=lead.email,
            candidate_name=lead.name,
            status="pending",
        )
        db.add(recipient)
        lead.campaign_id = campaign_id
        lead.status = "contacted"
        lead.updated_at = datetime.utcnow()
        added += 1

    await db.commit()

    # Update campaign recipient count
    count = (await db.execute(
        select(func.count(EmailCampaignRecipient.id)).where(
            EmailCampaignRecipient.campaign_id == campaign_id
        )
    )).scalar() or 0
    await db.execute(
        update(EmailCampaign).where(EmailCampaign.id == campaign_id).values(recipient_count=count)
    )
    await db.commit()

    return {"added": added, "total_recipients": count}
