from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.models import Base
from typing import AsyncGenerator

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

# Separate engine for recruiting_db (hiring agent context + tool execution)
_recruiting_engine = None
_RecruitingSessionLocal = None


def _init_recruiting_engine():
    global _recruiting_engine, _RecruitingSessionLocal
    if settings.RECRUITING_DB_URL and not _recruiting_engine:
        _recruiting_engine = create_async_engine(
            settings.RECRUITING_DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10,
        )
        _RecruitingSessionLocal = async_sessionmaker(
            bind=_recruiting_engine, expire_on_commit=False, class_=AsyncSession,
        )


async def init_db():
    _init_recruiting_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_recruiting_db() -> AsyncGenerator[AsyncSession, None]:
    if _RecruitingSessionLocal is None:
        _init_recruiting_engine()
    if _RecruitingSessionLocal is None:
        raise RuntimeError("RECRUITING_DB_URL not configured")
    async with _RecruitingSessionLocal() as session:
        yield session
