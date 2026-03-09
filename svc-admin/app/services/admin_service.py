from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models import User, Session
from app.clients.recruiting_client import get_recruiting_stats


async def count_users(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar_one()


async def count_admin_users(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))
    return result.scalar_one()


async def count_hr_users(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(User).where(User.role == "hr"))
    return result.scalar_one()


async def count_active_sessions(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(Session).where(Session.active == True))
    return result.scalar_one()


async def get_job_and_candidate_counts() -> dict:
    return await get_recruiting_stats()
