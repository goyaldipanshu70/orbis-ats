"""OTP generation, hashing, verification, and cleanup."""
import os
import secrets
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.db.models import OTPVerification

DEV_OTP = "123456"


def generate_otp() -> str:
    """Generate a 6-digit OTP string. Returns fixed OTP in dev mode."""
    if os.getenv("APP_ENV", "").lower() == "dev":
        return DEV_OTP
    return f"{secrets.randbelow(900000) + 100000}"


def _hash_otp(otp: str) -> str:
    return bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()


def _verify_otp_hash(otp: str, otp_hash: str) -> bool:
    return bcrypt.checkpw(otp.encode(), otp_hash.encode())


async def create_otp(
    db: AsyncSession,
    identifier: str,
    identifier_type: str,
    session_token: str,
    expiry_minutes: int = 10,
) -> str:
    """Create and store a hashed OTP. Returns the plain OTP for delivery."""
    # Invalidate any existing OTPs for this identifier+session
    await db.execute(
        delete(OTPVerification).where(
            OTPVerification.identifier == identifier,
            OTPVerification.identifier_type == identifier_type,
            OTPVerification.session_token == session_token,
        )
    )

    otp = generate_otp()
    record = OTPVerification(
        identifier=identifier,
        identifier_type=identifier_type,
        otp_hash=_hash_otp(otp),
        session_token=session_token,
        expires_at=datetime.utcnow() + timedelta(minutes=expiry_minutes),
    )
    db.add(record)
    await db.commit()
    return otp


async def verify_otp(
    db: AsyncSession,
    identifier: str,
    identifier_type: str,
    session_token: str,
    otp: str,
) -> bool:
    """Verify an OTP. Returns True on success, raises on failure."""
    result = await db.execute(
        select(OTPVerification).where(
            OTPVerification.identifier == identifier,
            OTPVerification.identifier_type == identifier_type,
            OTPVerification.session_token == session_token,
            OTPVerification.verified == False,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return False

    if datetime.utcnow() > record.expires_at:
        return False

    if record.attempts >= record.max_attempts:
        return False

    # Increment attempts
    record.attempts += 1

    if not _verify_otp_hash(otp, record.otp_hash):
        await db.commit()
        return False

    # Mark as verified
    record.verified = True
    await db.commit()
    return True


async def is_verified(
    db: AsyncSession,
    identifier: str,
    identifier_type: str,
    session_token: str,
) -> bool:
    """Check if an identifier has been verified for this session."""
    result = await db.execute(
        select(OTPVerification).where(
            OTPVerification.identifier == identifier,
            OTPVerification.identifier_type == identifier_type,
            OTPVerification.session_token == session_token,
            OTPVerification.verified == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def cleanup_expired_otps(db: AsyncSession):
    """Delete expired OTP records and pending signups."""
    now = datetime.utcnow()
    await db.execute(
        delete(OTPVerification).where(OTPVerification.expires_at < now)
    )
    from app.db.models import PendingSignup
    await db.execute(
        delete(PendingSignup).where(PendingSignup.expires_at < now)
    )
    await db.commit()
