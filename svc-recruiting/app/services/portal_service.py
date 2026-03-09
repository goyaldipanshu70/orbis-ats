import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.models import JobPortalConfig

logger = logging.getLogger("svc-recruiting")


async def add_portal(db: AsyncSession, data: dict, created_by: str) -> dict:
    portal = JobPortalConfig(
        portal_name=data["portal_name"],
        api_endpoint=data.get("api_endpoint"),
        auth_type=data.get("auth_type"),
        auth_credentials=data.get("auth_credentials"),
        posting_template=data.get("posting_template"),
        field_mapping=data.get("field_mapping"),
        integration_type=data.get("integration_type", "api"),
        mcp_server_url=data.get("mcp_server_url"),
        mcp_transport=data.get("mcp_transport"),
        mcp_tools=data.get("mcp_tools"),
        web_automation_config=data.get("web_automation_config"),
        capabilities=data.get("capabilities"),
        is_active=True,
        created_by=created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(portal)
    await db.commit()
    await db.refresh(portal)
    return _portal_to_dict(portal)


async def list_portals(db: AsyncSession, active_only: bool = True) -> List[dict]:
    query = select(JobPortalConfig).order_by(JobPortalConfig.portal_name)
    if active_only:
        query = query.where(JobPortalConfig.is_active == True)
    result = await db.execute(query)
    return [_portal_to_dict(p) for p in result.scalars().all()]


async def get_portal(db: AsyncSession, portal_id: int) -> Optional[dict]:
    result = await db.execute(select(JobPortalConfig).where(JobPortalConfig.id == portal_id))
    p = result.scalar_one_or_none()
    return _portal_to_dict(p) if p else None


async def update_portal(db: AsyncSession, portal_id: int, data: dict) -> Optional[dict]:
    update_vals = {k: v for k, v in data.items() if k in (
        "portal_name", "api_endpoint", "auth_type", "auth_credentials",
        "posting_template", "field_mapping", "integration_type", "is_active",
        "mcp_server_url", "mcp_transport", "mcp_tools", "web_automation_config",
        "capabilities", "last_synced_at",
    )}
    update_vals["updated_at"] = datetime.utcnow()
    result = await db.execute(
        update(JobPortalConfig).where(JobPortalConfig.id == portal_id).values(**update_vals).returning(JobPortalConfig)
    )
    await db.commit()
    p = result.scalar_one_or_none()
    return _portal_to_dict(p) if p else None


async def delete_portal(db: AsyncSession, portal_id: int) -> bool:
    result = await db.execute(delete(JobPortalConfig).where(JobPortalConfig.id == portal_id))
    await db.commit()
    return result.rowcount > 0


def _portal_to_dict(p: JobPortalConfig) -> dict:
    # Mask sensitive credential values
    creds = p.auth_credentials or {}
    masked_creds = {}
    for k, v in creds.items():
        if isinstance(v, str) and len(v) > 4:
            masked_creds[k] = v[:2] + "•" * (len(v) - 4) + v[-2:]
        else:
            masked_creds[k] = v

    return {
        "id": p.id,
        "portal_name": p.portal_name,
        "api_endpoint": p.api_endpoint,
        "auth_type": p.auth_type,
        "auth_credentials": masked_creds if creds else None,
        "has_credentials": bool(creds),
        "posting_template": p.posting_template,
        "field_mapping": p.field_mapping,
        "integration_type": p.integration_type,
        "mcp_server_url": p.mcp_server_url,
        "mcp_transport": p.mcp_transport,
        "mcp_tools": p.mcp_tools,
        "web_automation_config": p.web_automation_config,
        "capabilities": p.capabilities,
        "is_active": p.is_active,
        "created_by": p.created_by,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "last_synced_at": p.last_synced_at.isoformat() if p.last_synced_at else None,
    }
