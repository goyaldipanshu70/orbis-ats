import logging
import secrets
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.db.models import ReferralLink, Referral, JobDescription

logger = logging.getLogger("svc-recruiting")


def _link_to_dict(link: ReferralLink) -> dict:
    return {
        "id": link.id,
        "jd_id": link.jd_id,
        "referrer_user_id": link.referrer_user_id,
        "referrer_name": link.referrer_name,
        "referrer_email": link.referrer_email,
        "code": link.code,
        "is_active": link.is_active,
        "click_count": link.click_count,
        "reward_amount": float(link.reward_amount) if link.reward_amount else None,
        "reward_currency": link.reward_currency,
        "reward_conditions": link.reward_conditions,
        "created_at": link.created_at.isoformat() if link.created_at else None,
    }


def _referral_to_dict(r: Referral) -> dict:
    return {
        "id": r.id,
        "link_id": r.link_id,
        "candidate_profile_id": r.candidate_profile_id,
        "candidate_entry_id": r.candidate_entry_id,
        "status": r.status,
        "reward_type": r.reward_type,
        "reward_amount": float(r.reward_amount) if r.reward_amount else None,
        "reward_currency": r.reward_currency,
        "reward_status": r.reward_status,
        "reward_paid_at": r.reward_paid_at.isoformat() if r.reward_paid_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


async def create_referral_link(db: AsyncSession, jd_id: int, user: dict) -> dict:
    """Generate a unique 8-char referral code and create a referral link."""
    code = secrets.token_urlsafe(6)[:8]
    link = ReferralLink(
        jd_id=jd_id,
        referrer_user_id=str(user["sub"]),
        referrer_name=f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("email", ""),
        referrer_email=user.get("email", ""),
        code=code,
        is_active=True,
        click_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _link_to_dict(link)


async def get_links(
    db: AsyncSession, jd_id: Optional[int] = None, user_id: Optional[str] = None
) -> List[dict]:
    """List referral links with optional filters."""
    query = select(ReferralLink)
    if jd_id is not None:
        query = query.where(ReferralLink.jd_id == jd_id)
    if user_id is not None:
        query = query.where(ReferralLink.referrer_user_id == str(user_id))
    query = query.order_by(ReferralLink.created_at.desc())
    result = await db.execute(query)
    return [_link_to_dict(link) for link in result.scalars().all()]


async def track_click(db: AsyncSession, code: str) -> Optional[dict]:
    """Increment click_count on a referral link and return job info."""
    result = await db.execute(
        select(ReferralLink).where(ReferralLink.code == code, ReferralLink.is_active == True)
    )
    link = result.scalar_one_or_none()
    if not link:
        return None

    # Increment click count
    await db.execute(
        update(ReferralLink)
        .where(ReferralLink.id == link.id)
        .values(click_count=ReferralLink.click_count + 1)
    )
    await db.commit()

    # Fetch job info
    jd_result = await db.execute(
        select(JobDescription).where(JobDescription.id == link.jd_id)
    )
    jd = jd_result.scalar_one_or_none()
    job_title = "Unknown"
    if jd and jd.ai_result:
        job_title = jd.ai_result.get("job_title", "Unknown")

    return {
        "link": _link_to_dict(link),
        "job": {
            "id": link.jd_id,
            "title": job_title,
        },
    }


async def get_leaderboard(db: AsyncSession) -> List[dict]:
    """Aggregate referrals by referrer: name, email, total referrals, hired count, conversion %."""
    result = await db.execute(
        select(
            ReferralLink.referrer_name,
            ReferralLink.referrer_email,
            func.count(Referral.id).label("total_referrals"),
            func.count(func.nullif(Referral.status != "hired", True)).label("hired_count"),
        )
        .join(Referral, Referral.link_id == ReferralLink.id)
        .group_by(ReferralLink.referrer_name, ReferralLink.referrer_email)
        .order_by(func.count(Referral.id).desc())
    )
    rows = result.all()
    leaderboard = []
    for row in rows:
        total = row.total_referrals or 0
        hired = row.hired_count or 0
        conversion = round((hired / total) * 100, 1) if total > 0 else 0.0
        leaderboard.append({
            "referrer_name": row.referrer_name,
            "referrer_email": row.referrer_email,
            "total_referrals": total,
            "hired_count": hired,
            "conversion_percent": conversion,
            "total_rewards": 0,  # placeholder until rewards are tracked
        })
    return leaderboard


async def get_my_referrals(db: AsyncSession, user_id: str) -> List[dict]:
    """List referrals for a specific referrer by joining links and referrals."""
    result = await db.execute(
        select(Referral, ReferralLink)
        .join(ReferralLink, Referral.link_id == ReferralLink.id)
        .where(ReferralLink.referrer_user_id == str(user_id))
        .order_by(Referral.created_at.desc())
    )
    rows = result.all()
    referrals = []
    for referral, link in rows:
        data = _referral_to_dict(referral)
        data["referral_code"] = link.code
        data["jd_id"] = link.jd_id
        referrals.append(data)
    return referrals


async def update_referral_reward(db: AsyncSession, referral_id: int, reward_data: dict) -> Optional[dict]:
    """Update reward info on a referral (admin action)."""
    result = await db.execute(
        update(Referral)
        .where(Referral.id == referral_id)
        .values(
            reward_type=reward_data.get("reward_type"),
            reward_amount=reward_data.get("reward_amount"),
            reward_currency=reward_data.get("reward_currency", "INR"),
            reward_status=reward_data.get("reward_status", "pending"),
        )
        .returning(Referral)
    )
    await db.commit()
    r = result.scalar_one_or_none()
    return _referral_to_dict(r) if r else None
