from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.nodes import NODE_REGISTRY
from app.db.models import CustomNodeType

_HIDDEN_ALIASES = {"google_search"}


def get_builtin_node_types():
    result = []
    for node_type, cls in NODE_REGISTRY.items():
        if node_type in _HIDDEN_ALIASES:
            continue
        result.append({
            "type": node_type,
            "category": cls.category,
            "display_name": cls.display_name,
            "description": cls.description,
            "config_schema": cls.config_schema,
            "is_custom": False,
        })
    return result


async def get_all_node_types(db: AsyncSession):
    result = get_builtin_node_types()
    stmt = select(CustomNodeType).where(CustomNodeType.status == "published")
    rows = await db.execute(stmt)
    for row in rows.scalars():
        result.append({
            "type": row.node_type,
            "category": row.category,
            "display_name": row.display_name,
            "description": row.description,
            "config_schema": row.config_schema or {},
            "is_custom": True,
            "id": row.id,
        })
    return result


def get_node_types():
    return get_builtin_node_types()
