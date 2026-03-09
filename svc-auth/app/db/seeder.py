import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import User
from app.core.security import hash_password
from app.models.common import Role
from app.core.config import settings

logger = logging.getLogger("svc-auth")


async def seed_admin_user(db: AsyncSession):
    try:
        result = await db.execute(select(User).where(User.role == Role.ADMIN))
        existing_admin = result.scalar_one_or_none()
        if not existing_admin:
            logger.info("No admin found — creating default admin user")
            admin = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                first_name="Super",
                last_name="Admin",
                hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                role=Role.ADMIN,
                is_active=True,
                must_change_password=False,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow()
            )
            db.add(admin)
            await db.commit()
            logger.info("Admin seeded: %s", settings.DEFAULT_ADMIN_EMAIL)
        else:
            logger.info("Admin user already exists")
    except Exception as e:
        logger.error("Failed to seed admin user: %s", e)
        await db.rollback()
