import asyncio
import re
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.models import Offer, CandidateJobEntry, CandidateProfile, JobDescription
from app.schemas.offer_schema import OfferCreate, OfferUpdate
from app.services.candidate_service import move_candidate_stage
from app.core.http_client import get_ai_client
from app.core.config import settings

logger = logging.getLogger(__name__)


async def _fetch_template_content(template_id: int, variables: dict[str, str] | None) -> str | None:
    """Fetch a document template from svc-admin and render it with variables."""
    client = get_ai_client()
    try:
        # First fetch the template to get its raw content
        resp = await client.get(f"{settings.ADMIN_URL}/api/admin/templates/{template_id}")
        if resp.status_code != 200:
            logger.warning("Failed to fetch template %d: %s", template_id, resp.status_code)
            return None

        template_data = resp.json()
        content = template_data.get("content", "")

        # Apply variable substitution client-side (same logic as svc-admin render)
        if variables and content:
            for key, value in variables.items():
                content = content.replace("{{" + key + "}}", value)

        return content
    except Exception as exc:
        logger.error("Error fetching template %d: %s", template_id, exc)
        return None


def _offer_to_dict(o: Offer) -> dict:
    return {
        "id": o.id,
        "candidate_id": o.candidate_id,
        "jd_id": o.jd_id,
        "template_id": o.template_id,
        "salary": float(o.salary) if o.salary is not None else None,
        "salary_currency": o.salary_currency,
        "start_date": o.start_date,
        "position_title": o.position_title,
        "department": o.department,
        "content": o.content,
        "variables": o.variables,
        "status": o.status,
        "sent_at": o.sent_at.isoformat() if o.sent_at else None,
        "expires_at": o.expires_at.isoformat() if o.expires_at else None,
        "responded_at": o.responded_at.isoformat() if o.responded_at else None,
        "created_by": o.created_by,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


async def create_offer(db: AsyncSession, jd_id: int, data: OfferCreate, created_by: str) -> dict:
    # If a template_id is provided, fetch and render the template content
    rendered_content: str | None = None
    if data.template_id:
        rendered_content = await _fetch_template_content(data.template_id, data.variables)

    offer = Offer(
        candidate_id=data.candidate_id,
        jd_id=jd_id,
        template_id=data.template_id,
        salary=data.salary,
        salary_currency=data.salary_currency,
        start_date=data.start_date,
        position_title=data.position_title,
        department=data.department,
        content=rendered_content,
        variables=data.variables,
        created_by=created_by,
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return _offer_to_dict(offer)


async def get_offers_for_job(db: AsyncSession, jd_id: int) -> list[dict]:
    result = await db.execute(
        select(Offer).where(Offer.jd_id == jd_id, Offer.deleted_at.is_(None)).order_by(Offer.created_at.desc())
    )
    return [_offer_to_dict(o) for o in result.scalars().all()]


async def get_offer(db: AsyncSession, offer_id: int) -> Optional[dict]:
    result = await db.execute(select(Offer).where(Offer.id == offer_id, Offer.deleted_at.is_(None)))
    o = result.scalar_one_or_none()
    return _offer_to_dict(o) if o else None


async def update_offer(db: AsyncSession, offer_id: int, data: OfferUpdate) -> Optional[dict]:
    values = {k: v for k, v in data.model_dump().items() if v is not None}
    if not values:
        return await get_offer(db, offer_id)

    values["updated_at"] = datetime.utcnow()
    await db.execute(
        update(Offer).where(Offer.id == offer_id).values(**values)
    )
    await db.commit()
    return await get_offer(db, offer_id)


async def render_offer(db: AsyncSession, offer_id: int) -> Optional[str]:
    """Interpolate {{key}} placeholders in offer.content using offer.variables."""
    result = await db.execute(select(Offer).where(Offer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        return None

    content = offer.content or ""
    variables = offer.variables or {}

    if variables and content:
        def replacer(match):
            key = match.group(1).strip()
            return variables.get(key, match.group(0))

        rendered = re.sub(r"\{\{(\s*\w+\s*)\}\}", replacer, content)

        # Persist the rendered content back
        await db.execute(
            update(Offer).where(Offer.id == offer_id).values(content=rendered, updated_at=datetime.utcnow())
        )
        await db.commit()
        return rendered

    return content


async def send_offer(db: AsyncSession, offer_id: int, sent_by: str) -> Optional[dict]:
    result = await db.execute(select(Offer).where(Offer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        return None

    now = datetime.utcnow()
    await db.execute(
        update(Offer)
        .where(Offer.id == offer_id)
        .values(status="sent", sent_at=now, updated_at=now)
    )
    await db.commit()

    # Publish real-time event
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("offer_sent", {
            "offer_id": offer_id, "candidate_id": offer.candidate_id, "jd_id": offer.jd_id,
        })
    except Exception:
        pass

    # Move candidate to 'offer' pipeline stage
    await move_candidate_stage(db, offer.candidate_id, "offer", sent_by)

    # Fire-and-forget: send offer email
    _fire_offer_email(db, offer)

    return await get_offer(db, offer_id)


async def update_offer_status(db: AsyncSession, offer_id: int, status: str, changed_by: str) -> Optional[dict]:
    valid_statuses = {"accepted", "declined", "withdrawn"}
    if status not in valid_statuses:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    result = await db.execute(select(Offer).where(Offer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        return None

    now = datetime.utcnow()
    values = {"status": status, "updated_at": now}

    if status in ("accepted", "declined"):
        values["responded_at"] = now

    await db.execute(
        update(Offer).where(Offer.id == offer_id).values(**values)
    )
    await db.commit()

    # Publish real-time event
    try:
        from app.services.event_bus import publish_broadcast_event
        await publish_broadcast_event("offer_status_changed", {
            "offer_id": offer_id, "candidate_id": offer.candidate_id, "jd_id": offer.jd_id, "status": status,
        })
    except Exception:
        pass

    # If accepted, move candidate to 'hired'
    if status == "accepted":
        await move_candidate_stage(db, offer.candidate_id, "hired", changed_by)

    return await get_offer(db, offer_id)


# ---------------------------------------------------------------------------
# Fire-and-forget email helper for offers
# ---------------------------------------------------------------------------

def _fire_offer_email(db: AsyncSession, offer: Offer):
    """Schedule a background task to send offer notification email."""

    async def _send():
        try:
            entry_result = await db.execute(
                select(CandidateJobEntry).where(CandidateJobEntry.id == offer.candidate_id)
            )
            entry = entry_result.scalar_one_or_none()
            if not entry:
                return

            profile_result = await db.execute(
                select(CandidateProfile).where(CandidateProfile.id == entry.profile_id)
            )
            profile = profile_result.scalar_one_or_none()
            if not profile or not profile.email:
                return

            jd_result = await db.execute(
                select(JobDescription).where(JobDescription.id == offer.jd_id)
            )
            jd = jd_result.scalar_one_or_none()
            ai = jd.ai_result if jd else {}
            job_title = ai.get("job_title", "Open Position") if isinstance(ai, dict) else "Open Position"

            from app.services.email_service import send_offer_notification
            await send_offer_notification(
                candidate_email=profile.email,
                candidate_name=profile.full_name or "Candidate",
                job_title=offer.position_title or job_title,
            )
        except Exception:
            pass  # fire-and-forget

    asyncio.create_task(_send())
