from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.models import Base
from typing import AsyncGenerator

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        t = __import__("sqlalchemy").text

        # Indexes for workflow tables
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflows_status ON workflows (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflows_created_by ON workflows (created_by)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflow_runs_workflow_id ON workflow_runs (workflow_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflow_runs_status ON workflow_runs (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflow_node_runs_run_id ON workflow_node_runs (run_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_scraped_leads_run_id ON scraped_leads (workflow_run_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_scraped_leads_email ON scraped_leads (email)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_scraped_leads_source ON scraped_leads (source)"))

        # Composite indexes for common query patterns
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflows_status_created_by ON workflows (status, created_by)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflows_deleted_at ON workflows (deleted_at) WHERE deleted_at IS NULL"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_workflow_runs_wf_status ON workflow_runs (workflow_id, status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_scraped_leads_score ON scraped_leads (score DESC NULLS LAST)"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
