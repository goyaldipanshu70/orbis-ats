import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.db.models import User
from app.core.security import hash_password
from fastapi import HTTPException, status


async def get_all_users(db: AsyncSession, page: int = 1, page_size: int = 20) -> dict:
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(select(User).order_by(User.id).offset(offset).limit(page_size))
    return {
        "items": list(result.scalars().all()),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def create_new_user(db: AsyncSession, user_data: dict) -> User:
    existing = await db.execute(select(User).where(User.email == user_data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=user_data["email"],
        hashed_password=hash_password(user_data["password"]),
        first_name=user_data["first_name"],
        last_name=user_data["last_name"],
        role=user_data.get("role", "hr"),
        department=user_data.get("department"),
        is_active=user_data.get("is_active", True),
        must_change_password=user_data.get("must_change_password", False),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user_id: str, update_data: dict) -> User:
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    allowed_fields = {"first_name", "last_name", "role", "department", "is_active", "must_change_password"}
    # Allow department to be set to None (clear it), but filter out other None values
    fields = {k: v for k, v in update_data.items() if k in allowed_fields and (v is not None or k == "department")}
    if fields:
        await db.execute(update(User).where(User.id == int(user_id)).values(**fields))
        await db.commit()
        await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.execute(delete(User).where(User.id == int(user_id)))
    await db.commit()


async def reset_user_password_admin(db: AsyncSession, user_id: str, new_password: str) -> None:
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.execute(
        update(User).where(User.id == int(user_id)).values(
            hashed_password=hash_password(new_password),
            must_change_password=True
        )
    )
    await db.commit()
