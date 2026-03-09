from fastapi import HTTPException
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.models import User, PasswordResetToken
from app.core.security import hash_password, verify_password, create_access_token
from app.models.common import Role
from app.events.publisher import publish_event
from app.utils.email_service import send_email
from app.utils.oauth_google import get_google_client
from app.core.config import settings
import secrets
import hashlib
import httpx
import logging

logger = logging.getLogger(__name__)


async def signup_user(db: AsyncSession, email: str, password: str, first_name: str, last_name: str, role: Role = Role.HR):
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_detected",
                "duplicate_info": {
                    "match_reasons": ["email"],
                    "message": "An account with this email already exists.",
                },
            },
        )

    now = datetime.utcnow()
    new_user = User(
        email=email,
        hashed_password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
        must_change_password=False,
        created_at=now,
        last_login=now
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def login_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


async def reset_password(db: AsyncSession, user_id: int, new_password: str):
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            hashed_password=hash_password(new_password),
            must_change_password=False,
            last_login=datetime.utcnow()
        )
    )
    await db.commit()


async def handle_google_auth(db: AsyncSession, user_info: dict) -> str:
    email = user_info["email"]
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    now = datetime.utcnow()
    profile_pic = user_info.get("picture", "")

    if not user:
        user = User(
            email=email,
            first_name=user_info.get("given_name", "Google"),
            last_name=user_info.get("family_name", "User"),
            hashed_password="",
            role=Role.CANDIDATE,
            is_active=True,
            must_change_password=False,
            created_at=now,
            last_login=now,
            provider="google",
            picture=profile_pic,
            google_refresh_token=user_info.get("refresh_token"),
            google_access_token=user_info.get("access_token"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                last_login=now,
                picture=profile_pic,
                google_access_token=user_info.get("access_token"),
                google_refresh_token=user_info.get("refresh_token", user.google_refresh_token),
            )
        )
        await db.commit()
        await db.refresh(user)

    # Ensure CandidateProfile exists in svc-recruiting for new candidate users
    if user.role == "candidate":
        full_name = f"{user.first_name} {user.last_name}".strip()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "http://localhost:8002/internal/ensure-profile",
                    json={
                        "email": email,
                        "full_name": full_name,
                        "source": "google",
                    },
                    headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
                )
        except Exception as e:
            logger.warning("Failed to ensure candidate profile in svc-recruiting: %s", e)

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "profile_complete": user.profile_complete,
        "resume_url": user.resume_url or "",
        "phone": user.phone or "",
        "created_at": str(user.created_at)
    }
    return create_access_token(token_data)


async def handle_linkedin_auth(db: AsyncSession, user_info: dict) -> str:
    """Create or update a candidate user from LinkedIn OAuth data, then ensure a CandidateProfile exists."""
    email = user_info["email"]
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    now = datetime.utcnow()
    profile_pic = user_info.get("picture", "")
    linkedin_id = user_info.get("sub", "")

    if not user:
        user = User(
            email=email,
            first_name=user_info.get("given_name", "LinkedIn"),
            last_name=user_info.get("family_name", "User"),
            hashed_password="",
            role="candidate",
            is_active=True,
            must_change_password=False,
            created_at=now,
            last_login=now,
            provider="linkedin",
            picture=profile_pic,
            linkedin_id=linkedin_id,
            linkedin_access_token=user_info.get("access_token"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                last_login=now,
                picture=profile_pic,
                linkedin_id=linkedin_id,
                linkedin_access_token=user_info.get("access_token"),
            )
        )
        await db.commit()
        await db.refresh(user)

    # Ensure CandidateProfile exists in svc-recruiting (service-to-service)
    full_name = f"{user.first_name} {user.last_name}".strip()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "http://localhost:8002/internal/ensure-profile",
                json={
                    "email": email,
                    "full_name": full_name,
                    "source": "linkedin",
                },
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY},
            )
    except Exception as e:
        logger.warning("Failed to ensure candidate profile in svc-recruiting: %s", e)

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "profile_complete": user.profile_complete,
        "resume_url": user.resume_url or "",
        "phone": user.phone or "",
        "created_at": str(user.created_at),
    }
    return create_access_token(token_data)


async def refresh_google_token(db: AsyncSession, user: User) -> str:
    if not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="No Google refresh token found")

    client = get_google_client()
    token = await client.refresh_token(
        url=client.metadata["token_endpoint"],
        refresh_token=user.google_refresh_token
    )

    new_access_token = token.get("access_token")
    await db.execute(
        update(User).where(User.id == user.id).values(google_access_token=new_access_token)
    )
    await db.commit()

    return create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "profile_complete": user.profile_complete,
        "resume_url": user.resume_url or "",
        "phone": user.phone or "",
        "created_at": str(user.created_at)
    })


async def get_all_users(db: AsyncSession):
    result = await db.execute(select(User))
    return result.scalars().all()


async def create_new_user(db: AsyncSession, user):
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already exists")

    now = datetime.utcnow()
    new_user = User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        hashed_password=hash_password(user.password),
        created_at=now,
        last_login=now,
        is_active=True,
        must_change_password=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await publish_event("USER_CREATED", {"user_id": str(new_user.id), "email": new_user.email})
    return {"message": "User created successfully"}


async def update_user(db: AsyncSession, user_id: str, user):
    update_data = user.model_dump(exclude_unset=True)
    await db.execute(update(User).where(User.id == int(user_id)).values(**update_data))
    await db.commit()
    await publish_event("USER_UPDATED", {"user_id": user_id, "fields": list(update_data.keys())})
    return {"message": "User updated successfully"}


async def delete_user(db: AsyncSession, user_id: str):
    await db.execute(delete(User).where(User.id == int(user_id)))
    await db.commit()
    await publish_event("USER_DELETED", {"user_id": user_id})
    return {"message": "User deleted successfully"}


async def reset_user_password_admin(db: AsyncSession, user_id: str, new_password: str):
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.execute(
        update(User)
        .where(User.id == int(user_id))
        .values(
            hashed_password=hash_password(new_password),
            must_change_password=True,
            last_login=datetime.utcnow()
        )
    )
    await db.commit()

    subject = "Your password has been reset by Admin"
    body = f"Hello {user.first_name},<br><br>Your password has been reset by an admin. Please login and set a new password."
    await send_email(subject, body, user.email)

    await publish_event("USER_PASSWORD_RESET", {
        "user_id": str(user.id),
        "email": user.email,
        "event": "admin_reset"
    })


async def request_password_reset(db: AsyncSession, email: str, frontend_url: str):
    """Generate a reset token, store it, and email a reset link."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        # Don't reveal whether email exists — return silently
        return

    # Invalidate any existing unused tokens for this user
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used == False)
        .values(used=True)
    )

    # Generate token
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(reset_token)
    await db.commit()

    # Send email with reset link
    reset_link = f"{frontend_url}/reset-password?token={raw_token}"
    subject = "Reset Your Password — Orbis"
    body = (
        f"Hi {user.first_name},<br><br>"
        f"We received a request to reset your password. Click the link below to set a new password:<br><br>"
        f'<a href="{reset_link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;'
        f'text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a><br><br>'
        f"This link expires in 1 hour. If you didn't request this, you can safely ignore this email.<br><br>"
        f"— The Orbis Team"
    )
    try:
        await send_email(subject, body, user.email)
    except Exception:
        # Log but don't fail — user shouldn't know if email config is broken
        pass


async def reset_password_with_token(db: AsyncSession, raw_token: str, new_password: str):
    """Validate a reset token and update the user's password."""
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
        )
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if reset_token.expires_at < datetime.utcnow():
        # Mark as used so it can't be retried
        reset_token.used = True
        await db.commit()
        raise HTTPException(status_code=400, detail="Reset link has expired")

    # Update password
    await db.execute(
        update(User)
        .where(User.id == reset_token.user_id)
        .values(
            hashed_password=hash_password(new_password),
            must_change_password=False,
        )
    )

    # Mark token as used
    reset_token.used = True
    await db.commit()


async def invite_user(
    db: AsyncSession,
    email: str,
    first_name: str,
    last_name: str,
    role: str = "interviewer",
) -> dict:
    """Create a user with a temp password and return an invite token."""
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    temp_password = secrets.token_urlsafe(16)
    now = datetime.utcnow()
    user = User(
        email=email,
        hashed_password=hash_password(temp_password),
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
        must_change_password=True,
        created_at=now,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    invite_token = create_access_token(
        data={"sub": str(user.id), "type": "invite"},
        expires_minutes=1440,
    )
    return {
        "user_id": user.id,
        "invite_token": invite_token,
    }


async def accept_invite(db: AsyncSession, token: str, new_password: str) -> User:
    """Decode invite token and set the user's password."""
    from jose import jwt, JWTError
    from app.core.config import settings

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")

    if payload.get("type") != "invite":
        raise HTTPException(status_code=400, detail="Invalid token type")

    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await db.commit()
    await db.refresh(user)
    return user
