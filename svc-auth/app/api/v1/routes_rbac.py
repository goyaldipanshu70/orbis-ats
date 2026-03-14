# svc-auth/app/api/v1/routes_rbac.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, is_admin_user
from app.services import rbac_service, org_service
from app.schemas.rbac_schema import RoleOut, RoleCreate, RoleUpdate, OrgNodeOut, SetReportingRequest

router = APIRouter()


# ── Roles ────────────────────────────────────────────────────────────────

@router.get("/roles")
async def list_roles(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    roles = await rbac_service.list_roles(db)
    return [RoleOut.model_validate(r).model_dump() for r in roles]


@router.get("/roles/permissions-schema")
async def get_permission_schema(user=Depends(get_current_user)):
    """Return the full permission module structure for the UI permission matrix."""
    return rbac_service.get_permission_modules()


@router.get("/roles/{role_id}")
async def get_role(role_id: int, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    role = await rbac_service.get_role(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleOut.model_validate(role).model_dump()


@router.post("/roles")
async def create_role(body: RoleCreate, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    existing = await rbac_service.get_role_by_name(db, body.name)
    if existing:
        raise HTTPException(status_code=409, detail="Role name already exists")
    role = await rbac_service.create_role(db, body.model_dump())
    return RoleOut.model_validate(role).model_dump()


@router.put("/roles/{role_id}")
async def update_role(role_id: int, body: RoleUpdate, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    role = await rbac_service.update_role(db, role_id, body.model_dump(exclude_unset=True))
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleOut.model_validate(role).model_dump()


@router.delete("/roles/{role_id}")
async def delete_role(role_id: int, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    try:
        deleted = await rbac_service.delete_role(db, role_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted"}


# ── Org Hierarchy ────────────────────────────────────────────────────────

@router.get("/org-hierarchy")
async def get_org_tree(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await org_service.get_org_tree(db)


@router.get("/org-hierarchy/{user_id}/reports")
async def get_direct_reports(user_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await org_service.get_direct_reports(db, user_id)


@router.get("/org-hierarchy/{user_id}/chain")
async def get_reporting_chain(user_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await org_service.get_reporting_chain(db, user_id)


@router.post("/org-hierarchy")
async def set_reporting(body: SetReportingRequest, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    await org_service.set_reporting(db, body.user_id, body.reports_to, body.department, body.title)
    return {"message": "Reporting relationship updated"}


@router.delete("/org-hierarchy/{user_id}")
async def remove_from_org(user_id: int, user=Depends(is_admin_user), db: AsyncSession = Depends(get_db)):
    await org_service.remove_from_org(db, user_id)
    return {"message": "User removed from org hierarchy"}
