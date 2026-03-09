from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.core.security import get_current_user, is_admin_user
from app.services import admin_service, auth_service
from app.schemas.auth_schema import UserOut, CreateUserRequest, UpdateUserRequest, ResetPasswordRequest, UpdateUserStatusRequest

router = APIRouter()


@router.get("/stats")
async def get_stats(
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    total_users = await admin_service.count_users(db)
    admin_users = await admin_service.count_admin_users(db)
    hr_users = await admin_service.count_hr_users(db)
    active_sessions = await admin_service.count_active_sessions(db)

    recruiting_stats = {}
    try:
        recruiting_stats = await admin_service.get_job_and_candidate_counts()
    except Exception:
        pass

    return {
        "total_users": total_users,
        "admin_users": admin_users,
        "hr_users": hr_users,
        "active_sessions": active_sessions,
        **recruiting_stats,
    }


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    result = await auth_service.get_all_users(db, page=page, page_size=page_size)
    result["items"] = [UserOut.model_validate(u).model_dump() for u in result["items"]]
    return result


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    return await auth_service.get_user_by_id(db, user_id)


@router.post("/users", response_model=UserOut)
async def create_user(
    body: CreateUserRequest,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    return await auth_service.create_new_user(db, body.model_dump())


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    return await auth_service.update_user(db, user_id, body.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await auth_service.delete_user(db, user_id)
    return {"message": "User deleted successfully"}


@router.put("/users/{user_id}/status", response_model=UserOut)
async def update_user_status(
    user_id: str,
    body: UpdateUserStatusRequest,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    return await auth_service.update_user(db, user_id, {"is_active": body.is_active})


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    user=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await auth_service.reset_user_password_admin(db, user_id, body.new_password)
    return {"message": "Password reset successfully"}
