"""Candidate profile endpoints — manage stored resume and profile data."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update as sql_update

from app.db.postgres import get_db
from app.db.models import User
from app.core.security import get_current_user

router = APIRouter()


class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    location: Optional[str] = None
    current_role: Optional[str] = None
    resume_url: Optional[str] = None


@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get full user profile with resume info."""
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "phone": user.phone,
        "location": user.location,
        "current_role": user.current_role,
        "resume_url": user.resume_url,
        "profile_complete": user.profile_complete,
        "picture": user.picture,
        "created_at": str(user.created_at),
    }


@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update candidate profile (phone, location, current_role, resume_url)."""
    update_values = data.model_dump(exclude_unset=True)
    if not update_values:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.execute(
        sql_update(User).where(User.id == user.id).values(**update_values)
    )

    # Check if profile is now complete
    updated = await db.get(User, user.id)
    profile_complete = bool(updated.resume_url and updated.phone)
    if profile_complete != updated.profile_complete:
        await db.execute(
            sql_update(User).where(User.id == user.id).values(profile_complete=profile_complete)
        )

    await db.commit()

    return {"message": "Profile updated", "profile_complete": profile_complete}
