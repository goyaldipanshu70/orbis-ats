import logging

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.models import Base
from typing import AsyncGenerator

logger = logging.getLogger("svc-admin")

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Migrate legacy recruiter roles (separate transaction, safe to fail on fresh DB)
    try:
        async with engine.begin() as conn:
            text = __import__("sqlalchemy").text
            await conn.execute(text("UPDATE users SET role='hr' WHERE role='recruiter' AND department='hr'"))
            await conn.execute(text("UPDATE users SET role='hiring_manager' WHERE role='recruiter' AND (department!='hr' OR department IS NULL)"))
    except Exception:
        pass

    # Seed default ATS settings
    async with engine.begin() as conn:
        text = __import__("sqlalchemy").text
        await conn.execute(text("""
            INSERT INTO app_settings (key, value, updated_at)
            VALUES ('ats_settings', '{"default_rejection_lock_days": 90, "rejection_lock_enabled": true, "otp_email_required": true, "otp_phone_required": true, "otp_expiry_minutes": 10, "otp_max_attempts": 5}', NOW())
            ON CONFLICT (key) DO NOTHING
        """))

    logger.info("PostgreSQL tables initialized")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
