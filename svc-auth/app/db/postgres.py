import logging

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.models import Base
from typing import AsyncGenerator

logger = logging.getLogger("svc-auth")

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

    # V3 migrations — User profile columns (separate transaction)
    async with engine.begin() as conn:
        text = __import__("sqlalchemy").text
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS "current_role" VARCHAR(255)'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url TEXT'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT FALSE'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE'))
        await conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE'))

    # Migrate legacy recruiter roles (separate transaction, safe to fail on fresh DB)
    try:
        async with engine.begin() as conn:
            text = __import__("sqlalchemy").text
            await conn.execute(text("UPDATE users SET role='hr' WHERE role='recruiter' AND department='hr'"))
            await conn.execute(text("UPDATE users SET role='hiring_manager' WHERE role='recruiter' AND (department!='hr' OR department IS NULL)"))
    except Exception:
        pass

    logger.info("PostgreSQL tables initialized")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
