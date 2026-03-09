"""Rejection lock period enforcement."""
import logging
import time
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import JobApplication, JobDescription

logger = logging.getLogger("svc-recruiting")

# Simple in-memory cache for global settings (TTL 5 min)
_settings_cache: dict = {}
_settings_cache_ts: float = 0
CACHE_TTL = 300  # 5 minutes


async def _get_global_lock_days() -> int:
    """Fetch default_rejection_lock_days from svc-admin. Cached 5 min."""
    global _settings_cache, _settings_cache_ts
    now = time.time()
    if _settings_cache and (now - _settings_cache_ts) < CACHE_TTL:
        return _settings_cache.get("default_rejection_lock_days", 90)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("http://localhost:8003/api/settings/ats")
            if resp.status_code == 200:
                _settings_cache = resp.json()
                _settings_cache_ts = now
                return _settings_cache.get("default_rejection_lock_days", 90)
    except Exception as e:
        logger.warning("Failed to fetch global rejection lock settings: %s", e)

    return 90  # fallback


async def check_rejection_lock(
    db: AsyncSession,
    user_id: int,
    jd_id: int,
) -> Optional[dict]:
    """Check if a user is locked out from re-applying to a job.
    Returns None if no lock, else dict with lock info."""
    # Find most recent rejected application for this user+job
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == user_id,
            JobApplication.jd_id == jd_id,
            JobApplication.status == "rejected",
            JobApplication.deleted_at.is_(None),
        ).order_by(JobApplication.last_status_updated_at.desc()).limit(1)
    )
    rejected_app = result.scalar_one_or_none()
    if not rejected_app or not rejected_app.last_status_updated_at:
        return None

    # Determine lock days: per-job override or global default
    job = (await db.execute(
        select(JobDescription).where(JobDescription.id == jd_id)
    )).scalar_one_or_none()

    lock_days = None
    if job and job.rejection_lock_days is not None:
        lock_days = job.rejection_lock_days
    if lock_days is None:
        lock_days = await _get_global_lock_days()

    if lock_days <= 0:
        return None  # Lock disabled

    lock_expiry = rejected_app.last_status_updated_at + timedelta(days=lock_days)
    now = datetime.utcnow()

    if now >= lock_expiry:
        return None  # Lock expired

    remaining_days = (lock_expiry - now).days

    return {
        "locked": True,
        "lock_expiry": lock_expiry.isoformat(),
        "remaining_days": remaining_days,
        "message": f"You were previously rejected for this position. You can reapply after {lock_expiry.strftime('%B %d, %Y')} ({remaining_days} days remaining).",
    }
