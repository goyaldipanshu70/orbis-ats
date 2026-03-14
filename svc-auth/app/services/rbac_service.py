# svc-auth/app/services/rbac_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models import RoleDefinition
from datetime import datetime

# ── Default permission sets for system roles ─────────────────────────────

PERMISSION_MODULES = {
    "jobs": ["view_all", "view_assigned", "create", "edit_assigned", "edit_all", "delete", "publish"],
    "candidates": ["view", "add", "edit", "delete", "export", "view_scores"],
    "pipeline": ["view", "move_stages", "reject", "offer", "hire"],
    "interviews": ["view", "schedule", "evaluate", "upload_transcript", "view_feedback", "manage_panels", "ai_interview_manage", "ai_interview_view_results"],
    "reports": ["view_dashboard", "view_analytics", "view_people_analytics", "export"],
    "admin": ["manage_users", "manage_roles", "manage_settings", "view_audit_logs", "manage_templates"],
    "ai": ["use_screening", "use_ranking", "use_jd_generator", "use_interview", "use_salary_insights", "use_bias_checker"],
    "requisitions": ["create", "approve", "view_all", "view_own"],
    "org": ["view_hierarchy", "manage_hierarchy", "delegate_jobs"],
}


def _all_perms(value: bool) -> dict:
    """Generate a permission dict with all permissions set to given value."""
    perms = {}
    for module, actions in PERMISSION_MODULES.items():
        for action in actions:
            perms[f"{module}.{action}"] = value
    return perms


def _build_perms(**module_overrides) -> dict:
    """Start with all False, then set specific modules/actions to True."""
    perms = _all_perms(False)
    for key, val in module_overrides.items():
        perms[key] = val
    return perms


SYSTEM_ROLES = [
    {
        "name": "admin",
        "display_name": "Administrator",
        "description": "Full system access. Can manage users, roles, settings, and all features.",
        "color": "#ef4444",
        "permissions": _all_perms(True),
    },
    {
        "name": "hr",
        "display_name": "HR Manager",
        "description": "Manages jobs, candidates, pipeline, interviews, and reports. Can approve requisitions.",
        "color": "#3b82f6",
        "permissions": {
            **_all_perms(False),
            "jobs.view_all": True, "jobs.create": True, "jobs.edit_all": True, "jobs.publish": True,
            "candidates.view": True, "candidates.add": True, "candidates.edit": True, "candidates.export": True, "candidates.view_scores": True,
            "pipeline.view": True, "pipeline.move_stages": True, "pipeline.reject": True, "pipeline.offer": True, "pipeline.hire": True,
            "interviews.view": True, "interviews.schedule": True, "interviews.evaluate": True, "interviews.upload_transcript": True,
            "interviews.view_feedback": True, "interviews.manage_panels": True, "interviews.ai_interview_manage": True, "interviews.ai_interview_view_results": True,
            "reports.view_dashboard": True, "reports.view_analytics": True, "reports.export": True,
            "ai.use_screening": True, "ai.use_ranking": True, "ai.use_jd_generator": True, "ai.use_interview": True, "ai.use_salary_insights": True, "ai.use_bias_checker": True,
            "requisitions.approve": True, "requisitions.view_all": True,
            "org.view_hierarchy": True, "org.delegate_jobs": True,
        },
    },
    {
        "name": "hiring_manager",
        "display_name": "Hiring Manager",
        "description": "Manages assigned jobs, reviews candidates, conducts interviews. Can delegate jobs to team.",
        "color": "#8b5cf6",
        "permissions": {
            **_all_perms(False),
            "jobs.view_assigned": True, "jobs.create": True, "jobs.edit_assigned": True, "jobs.publish": True,
            "candidates.view": True, "candidates.add": True, "candidates.edit": True, "candidates.view_scores": True,
            "pipeline.view": True, "pipeline.move_stages": True, "pipeline.reject": True, "pipeline.offer": True,
            "interviews.view": True, "interviews.schedule": True, "interviews.evaluate": True, "interviews.view_feedback": True,
            "interviews.manage_panels": True, "interviews.ai_interview_manage": True, "interviews.ai_interview_view_results": True,
            "reports.view_dashboard": True,
            "ai.use_screening": True, "ai.use_ranking": True, "ai.use_jd_generator": True, "ai.use_interview": True,
            "requisitions.view_all": True, "requisitions.approve": True,
            "org.view_hierarchy": True, "org.delegate_jobs": True,
        },
    },
    {
        "name": "manager",
        "display_name": "Department Manager",
        "description": "Raises job requisitions, views team members and their interview schedules. Cannot directly manage jobs.",
        "color": "#f59e0b",
        "permissions": {
            **_all_perms(False),
            "jobs.view_assigned": True,
            "candidates.view": True, "candidates.view_scores": True,
            "interviews.view": True, "interviews.view_feedback": True,
            "reports.view_dashboard": True,
            "requisitions.create": True, "requisitions.view_own": True,
            "org.view_hierarchy": True,
        },
    },
    {
        "name": "interviewer",
        "display_name": "Interviewer",
        "description": "Conducts interviews and submits evaluations. Limited candidate visibility.",
        "color": "#10b981",
        "permissions": {
            **_all_perms(False),
            "candidates.view": True, "candidates.view_scores": True,
            "interviews.view": True, "interviews.evaluate": True, "interviews.view_feedback": True,
            "interviews.upload_transcript": True, "interviews.ai_interview_view_results": True,
            "reports.view_dashboard": True,
        },
    },
    {
        "name": "candidate",
        "display_name": "Candidate",
        "description": "Job applicant. Can view jobs, apply, and complete assessments.",
        "color": "#64748b",
        "permissions": _all_perms(False),
    },
]


async def seed_system_roles(db: AsyncSession):
    """Create system roles if they don't exist. Update permissions on existing ones."""
    for role_data in SYSTEM_ROLES:
        result = await db.execute(
            select(RoleDefinition).where(RoleDefinition.name == role_data["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.permissions = role_data["permissions"]
            existing.display_name = role_data["display_name"]
            existing.description = role_data["description"]
            existing.color = role_data["color"]
            existing.updated_at = datetime.utcnow()
        else:
            db.add(RoleDefinition(
                name=role_data["name"],
                display_name=role_data["display_name"],
                description=role_data["description"],
                color=role_data["color"],
                is_system=True,
                permissions=role_data["permissions"],
            ))
    await db.commit()


async def list_roles(db: AsyncSession):
    """List all active roles."""
    result = await db.execute(
        select(RoleDefinition).order_by(RoleDefinition.is_system.desc(), RoleDefinition.display_name)
    )
    return result.scalars().all()


async def get_role(db: AsyncSession, role_id: int):
    result = await db.execute(select(RoleDefinition).where(RoleDefinition.id == role_id))
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, name: str):
    result = await db.execute(select(RoleDefinition).where(RoleDefinition.name == name))
    return result.scalar_one_or_none()


async def create_role(db: AsyncSession, data: dict):
    role = RoleDefinition(**data)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


async def update_role(db: AsyncSession, role_id: int, data: dict):
    role = await get_role(db, role_id)
    if not role:
        return None
    for k, v in data.items():
        setattr(role, k, v)
    role.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(role)
    return role


async def delete_role(db: AsyncSession, role_id: int):
    role = await get_role(db, role_id)
    if not role:
        return False
    if role.is_system:
        raise ValueError("Cannot delete system roles")
    await db.delete(role)
    await db.commit()
    return True


async def get_permissions_for_role(db: AsyncSession, role_name: str) -> dict:
    """Get the flat permission dict for a role name. Used during JWT creation."""
    role = await get_role_by_name(db, role_name)
    if not role:
        return {}
    return role.permissions or {}


def get_permission_modules() -> dict:
    """Return the full permission module structure for the UI."""
    return PERMISSION_MODULES
