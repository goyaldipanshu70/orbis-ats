"""OTP-based candidate signup flow: initiate -> verify email -> verify phone -> account created."""
import logging
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger("svc-auth")

from app.db.postgres import get_db
from app.db.models import User, PendingSignup
from app.schemas.auth_schema import CandidateSignUpInitiateRequest, VerifyOTPRequest, ResendOTPRequest
from app.core.security import hash_password, create_access_token, create_refresh_token_value, store_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES
from app.services.otp_service import create_otp, verify_otp, is_verified
from app.utils.phone_utils import normalize_phone
from app.utils.sms_service import send_sms

router = APIRouter()


@router.post("/signup/candidate/initiate")
async def initiate_candidate_signup(data: CandidateSignUpInitiateRequest, db: AsyncSession = Depends(get_db)):
    """Step 1: Validate form, check email uniqueness, store pending signup, send email OTP."""
    # Check email uniqueness
    existing = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if existing:
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

    # Generate session token
    session_token = secrets.token_hex(32)

    # Store pending signup (30 min expiry)
    pending = PendingSignup(
        session_token=session_token,
        email=data.email,
        phone=normalize_phone(data.phone),
        first_name=data.first_name,
        last_name=data.last_name,
        hashed_password=hash_password(data.password),
        expires_at=datetime.utcnow() + timedelta(minutes=30),
    )
    db.add(pending)
    await db.commit()

    # Generate and send email OTP
    otp = await create_otp(db, data.email, "email", session_token)

    # Send via email (console fallback)
    try:
        from app.utils.email_service import send_email
        await send_email(
            subject="Your verification code",
            body=f"<h2>Your verification code is: <strong>{otp}</strong></h2><p>This code expires in 10 minutes.</p>",
            to=data.email,
        )
    except Exception as e:
        logger.info("OTP email fallback — To: %s | Code: %s", data.email, otp)

    return {"session_token": session_token, "message": "Verification code sent to your email."}


@router.post("/signup/candidate/verify-email")
async def verify_email_otp(data: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Step 2: Verify email OTP, then send phone OTP."""
    # Load pending signup
    pending = (await db.execute(
        select(PendingSignup).where(PendingSignup.session_token == data.session_token)
    )).scalar_one_or_none()
    if not pending or datetime.utcnow() > pending.expires_at:
        raise HTTPException(status_code=400, detail="Session expired or invalid. Please start over.")

    success = await verify_otp(db, pending.email, "email", data.session_token, data.otp)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    # Send phone OTP
    otp = await create_otp(db, pending.phone, "phone", data.session_token)
    await send_sms(pending.phone, f"Your verification code is: {otp}")

    return {"message": "Email verified. Verification code sent to your phone."}


@router.post("/signup/candidate/verify-phone")
async def verify_phone_otp(data: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Step 3: Verify phone OTP, create user account, return tokens."""
    # Load pending signup
    pending = (await db.execute(
        select(PendingSignup).where(PendingSignup.session_token == data.session_token)
    )).scalar_one_or_none()
    if not pending or datetime.utcnow() > pending.expires_at:
        raise HTTPException(status_code=400, detail="Session expired or invalid. Please start over.")

    # Ensure email was already verified
    email_ok = await is_verified(db, pending.email, "email", data.session_token)
    if not email_ok:
        raise HTTPException(status_code=400, detail="Email not yet verified.")

    success = await verify_otp(db, pending.phone, "phone", data.session_token, data.otp)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    # Double-check email uniqueness before creating user
    existing = (await db.execute(select(User).where(User.email == pending.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email was created while you were verifying.")

    # Create the user
    now = datetime.utcnow()
    user = User(
        email=pending.email,
        hashed_password=pending.hashed_password,
        first_name=pending.first_name,
        last_name=pending.last_name,
        role="candidate",
        phone=pending.phone,
        is_active=True,
        must_change_password=False,
        email_verified=True,
        phone_verified=True,
        created_at=now,
        last_login=now,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "profile_complete": False,
        "phone": user.phone or "",
        "created_at": str(user.created_at),
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


@router.post("/signup/candidate/resend-otp")
async def resend_otp(data: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Resend OTP for email or phone."""
    if data.type not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="Type must be 'email' or 'phone'.")

    pending = (await db.execute(
        select(PendingSignup).where(PendingSignup.session_token == data.session_token)
    )).scalar_one_or_none()
    if not pending or datetime.utcnow() > pending.expires_at:
        raise HTTPException(status_code=400, detail="Session expired or invalid. Please start over.")

    identifier = pending.email if data.type == "email" else pending.phone
    otp = await create_otp(db, identifier, data.type, data.session_token)

    if data.type == "email":
        try:
            from app.utils.email_service import send_email
            await send_email(
                subject="Your verification code",
                body=f"<h2>Your verification code is: <strong>{otp}</strong></h2><p>This code expires in 10 minutes.</p>",
                to=pending.email,
            )
        except Exception:
            logger.info("OTP email fallback — To: %s | Code: %s", pending.email, otp)
    else:
        await send_sms(pending.phone, f"Your verification code is: {otp}")

    return {"message": f"Verification code resent to your {data.type}."}
