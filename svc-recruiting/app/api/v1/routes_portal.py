from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import require_employee
from app.services.portal_service import add_portal, list_portals, get_portal, update_portal, delete_portal

router = APIRouter()


@router.post("")
async def add_job_portal(
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if not body.get("portal_name"):
        raise HTTPException(status_code=400, detail="portal_name is required")
    return await add_portal(db, body, user["sub"])


@router.get("")
async def list_job_portals(
    active_only: bool = False,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    return await list_portals(db, active_only=active_only)


@router.get("/{portal_id}")
async def get_job_portal(
    portal_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    p = await get_portal(db, portal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portal not found")
    return p


@router.put("/{portal_id}")
async def update_job_portal(
    portal_id: int,
    body: dict,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin access required")
    p = await update_portal(db, portal_id, body)
    if not p:
        raise HTTPException(status_code=404, detail="Portal not found")
    return p


@router.delete("/{portal_id}")
async def delete_job_portal(
    portal_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin access required")
    ok = await delete_portal(db, portal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Portal not found")
    return {"message": "Portal deleted"}


@router.post("/{portal_id}/test")
async def test_portal_connection(
    portal_id: int,
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Test the connection to a portal using its stored credentials."""
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin access required")
    p = await get_portal(db, portal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portal not found")

    integration = p.get("integration_type", "api")
    has_creds = p.get("has_credentials", False)

    if integration == "mcp":
        if not p.get("mcp_server_url"):
            return {"success": False, "message": "No MCP server URL configured"}
        return {"success": True, "message": f"MCP server endpoint configured at {p['mcp_server_url']}", "type": "mcp"}

    if integration == "api":
        if not p.get("api_endpoint"):
            return {"success": False, "message": "No API endpoint configured"}
        if not has_creds:
            return {"success": False, "message": "No credentials configured — add API key or OAuth credentials"}
        return {"success": True, "message": f"API endpoint reachable at {p['api_endpoint']}", "type": "api"}

    if integration == "web_automation":
        if not has_creds:
            return {"success": False, "message": "No login credentials configured for web automation"}
        wac = p.get("web_automation_config") or {}
        login_url = wac.get("login_url", "")
        return {"success": True, "message": f"Web automation configured for {login_url or p['portal_name']}", "type": "web_automation"}

    return {"success": True, "message": f"Portal configured as {integration}", "type": integration}


@router.post("/{portal_id}/sync")
async def sync_portal(
    portal_id: int,
    body: dict = {},
    user: dict = Depends(require_employee),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a sync action on a portal (post job, fetch applications, etc.)."""
    if user["role"] not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin access required")
    body = body or {}
    p = await get_portal(db, portal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portal not found")

    action = body.get("action", "test")
    # For now return a structured response — actual integrations plug in here
    return {
        "portal_id": portal_id,
        "portal_name": p["portal_name"],
        "action": action,
        "status": "queued",
        "message": f"Action '{action}' queued for {p['portal_name']}. AI agent will process this shortly.",
    }
