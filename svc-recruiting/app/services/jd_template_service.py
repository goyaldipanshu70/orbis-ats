import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.db.models import JDTemplate

logger = logging.getLogger("svc-recruiting")


async def create_template(db: AsyncSession, data: dict, created_by: str) -> dict:
    template = JDTemplate(
        name=data["name"],
        category=data.get("category"),
        description=data.get("description"),
        jd_content=data.get("jd_content", {}),
        skills=data.get("skills"),
        experience_range=data.get("experience_range"),
        salary_range=data.get("salary_range"),
        benefits=data.get("benefits"),
        screening_questions=data.get("screening_questions"),
        is_active=True,
        usage_count=0,
        created_by=created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_dict(template)


async def list_templates(db: AsyncSession, category: Optional[str] = None) -> List[dict]:
    query = select(JDTemplate).where(JDTemplate.is_active == True).order_by(JDTemplate.usage_count.desc())
    if category:
        query = query.where(JDTemplate.category == category)
    result = await db.execute(query)
    return [_template_to_dict(t) for t in result.scalars().all()]


async def get_template(db: AsyncSession, template_id: int) -> Optional[dict]:
    result = await db.execute(select(JDTemplate).where(JDTemplate.id == template_id))
    t = result.scalar_one_or_none()
    return _template_to_dict(t) if t else None


async def update_template(db: AsyncSession, template_id: int, data: dict) -> Optional[dict]:
    update_vals = {k: v for k, v in data.items() if k in (
        "name", "category", "description", "jd_content", "skills",
        "experience_range", "salary_range", "benefits", "screening_questions", "is_active",
    )}
    update_vals["updated_at"] = datetime.utcnow()
    result = await db.execute(
        update(JDTemplate).where(JDTemplate.id == template_id).values(**update_vals).returning(JDTemplate)
    )
    await db.commit()
    t = result.scalar_one_or_none()
    return _template_to_dict(t) if t else None


async def delete_template(db: AsyncSession, template_id: int) -> bool:
    result = await db.execute(
        update(JDTemplate).where(JDTemplate.id == template_id).values(is_active=False, updated_at=datetime.utcnow())
    )
    await db.commit()
    return result.rowcount > 0


async def increment_usage(db: AsyncSession, template_id: int):
    await db.execute(
        update(JDTemplate).where(JDTemplate.id == template_id).values(usage_count=JDTemplate.usage_count + 1)
    )
    await db.commit()


async def get_categories(db: AsyncSession) -> List[str]:
    result = await db.execute(
        select(JDTemplate.category).where(JDTemplate.is_active == True, JDTemplate.category.isnot(None)).distinct()
    )
    return [row[0] for row in result.all()]


def _template_to_dict(t: JDTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "description": t.description,
        "jd_content": t.jd_content,
        "skills": t.skills,
        "experience_range": t.experience_range,
        "salary_range": t.salary_range,
        "benefits": t.benefits,
        "screening_questions": t.screening_questions,
        "is_active": t.is_active,
        "usage_count": t.usage_count,
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
