from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Setting


async def get_email_settings(db: AsyncSession):
    result = await db.execute(select(Setting).where(Setting.category == "email"))
    setting = result.scalar_one_or_none()
    return setting.value if setting else None
