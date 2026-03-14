from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.auth_schema import (
    SignUpRequest, LoginRequest, TokenResponse, ResetPasswordRequest,
    CandidateSignUpRequest, ForgotPasswordRequest, ResetPasswordWithTokenRequest,
    InviteRequest, AcceptInviteRequest,
)
from app.services.auth_service import (
    login_user,
    signup_user,
    reset_password,
    handle_google_auth,
    handle_linkedin_auth,
    refresh_google_token,
    request_password_reset,
    reset_password_with_token,
    invite_user,
    accept_invite,
)
from app.core.security import (
    create_access_token,
    get_current_user,
    create_refresh_token_value,
    store_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.services.rbac_service import get_permissions_for_role
from app.core.rate_limit import limiter
from app.db.postgres import get_db
from app.db.models import User
from app.utils.oauth_google import get_google_client
from app.utils.oauth_linkedin import get_linkedin_client
from app.core.config import settings

router = APIRouter()


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, form_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await login_user(db, form_data.email, form_data.password)

    if user.must_change_password:
        raise HTTPException(status_code=403, detail="Password change required on first login")

    permissions = await get_permissions_for_role(db, user.role)
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
        "permissions": permissions,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token_value()
    await store_refresh_token(db, user.id, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/signup")
@limiter.limit("3/minute")
async def signup(request: Request, data: SignUpRequest, db: AsyncSession = Depends(get_db)):
    await signup_user(
        db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role
    )
    return {"message": "User registered successfully"}


@router.post("/signup/candidate")
async def signup_candidate(data: CandidateSignUpRequest, db: AsyncSession = Depends(get_db)):
    """Register as a candidate — role is hardcoded server-side to prevent escalation."""
    user = await signup_user(
        db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
        role="candidate",
    )

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "profile_complete": False,
        "created_at": str(user.created_at),
        "permissions": {},
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token_value()
    await store_refresh_token(db, user.id, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    permissions = await get_permissions_for_role(db, user.role)
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
        "created_at": str(user.created_at),
        "last_login": str(user.last_login) if user.last_login else "",
        "picture": user.picture,
        "permissions": permissions,
    }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
async def refresh_access(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Exchange refresh_token for a new access_token."""
    user = await validate_refresh_token(db, body.refresh_token)
    permissions = await get_permissions_for_role(db, user.role)
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
        "permissions": permissions,
    }
    access_token = create_access_token(token_data)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/logout")
async def logout(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Revoke a refresh token."""
    await revoke_refresh_token(db, body.refresh_token)
    return {"message": "Logged out successfully"}


@router.post("/reset-password")
async def reset_user_password(body: ResetPasswordRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await reset_password(db, user.id, body.new_password)
    return {"message": "Password reset successful"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a password reset email (unauthenticated)."""
    await request_password_reset(db, body.email, settings.FRONTEND_URL)
    # Always return success to prevent email enumeration
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password-token")
@limiter.limit("5/minute")
async def reset_password_via_token(request: Request, body: ResetPasswordWithTokenRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a token from the email link (unauthenticated)."""
    await reset_password_with_token(db, body.token, body.new_password)
    return {"message": "Password reset successful. You can now log in with your new password."}


@router.get("/google/login")
async def google_login(request: Request):
    client = get_google_client()
    redirect_uri = request.url_for("google_callback")
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    client = get_google_client()
    token = await client.authorize_access_token(request)

    resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", token=token)
    user_info = resp.json()

    jwt_token = await handle_google_auth(db, user_info | token)

    return RedirectResponse(url=f"{settings.FRONTEND_URL}/login/success?token={jwt_token}")


@router.post("/google/refresh-token")
async def google_refresh_token(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    new_token = await refresh_google_token(db, user)
    return {"access_token": new_token, "token_type": "bearer"}


@router.get("/linkedin/login")
async def linkedin_login(request: Request):
    client = get_linkedin_client()
    redirect_uri = request.url_for("linkedin_callback")
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/linkedin/callback")
async def linkedin_callback(request: Request, db: AsyncSession = Depends(get_db)):
    client = get_linkedin_client()
    token = await client.authorize_access_token(request)

    # LinkedIn OpenID Connect returns userinfo via the ID token
    user_info = token.get("userinfo", {})
    if not user_info:
        resp = await client.get("https://api.linkedin.com/v2/userinfo", token=token)
        user_info = resp.json()

    jwt_token = await handle_linkedin_auth(db, user_info | token)

    return RedirectResponse(url=f"{settings.FRONTEND_URL}/linkedin/success?token={jwt_token}")


@router.get("/linkedin/token")
async def get_linkedin_token(
    user_id: Optional[int] = Query(None, description="User ID for internal service-to-service calls"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_internal_key: Optional[str] = Header(None),
):
    """Returns the user's stored LinkedIn access token for cross-service use.

    Supports two modes:
    - Authenticated user: returns the token for the current JWT user.
    - Internal service call: pass X-Internal-Key header + user_id query param.
    """
    target_user_id: int
    if x_internal_key and x_internal_key == settings.INTERNAL_API_KEY and user_id is not None:
        # Service-to-service call
        target_user_id = user_id
    else:
        # Normal authenticated user
        target_user_id = user.id

    result = await db.execute(select(User).where(User.id == target_user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if not u.linkedin_access_token:
        raise HTTPException(
            status_code=404,
            detail="No LinkedIn token found. Please connect your LinkedIn account first.",
        )
    return {"access_token": u.linkedin_access_token}


@router.post("/invite")
async def invite_endpoint(body: InviteRequest, db: AsyncSession = Depends(get_db)):
    """Create an interviewer user and return an invite URL."""
    result = await invite_user(db, body.email, body.first_name, body.last_name, body.role)
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    invite_url = f"{frontend_url}/invite/{result['invite_token']}"
    return {
        "user_id": result["user_id"],
        "invite_url": invite_url,
        "message": "Interviewer invited successfully. Share the invite URL.",
    }


@router.post("/accept-invite")
async def accept_invite_endpoint(body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    """Accept an invite and set password."""
    user = await accept_invite(db, body.token, body.password)
    access_token = create_access_token(data={
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
    })
    return {"access_token": access_token, "token_type": "bearer", "message": "Password set successfully"}
