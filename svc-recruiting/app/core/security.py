import logging

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings

logger = logging.getLogger("svc-recruiting")
from datetime import datetime, timedelta
from passlib.context import CryptContext
from typing import Dict, Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_minutes: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    """
    JWT-only validation — decodes token without DB lookup.
    User attributes (sub, email, role) are embedded in the JWT payload.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return {
            "sub": user_id,
            "email": payload.get("email"),
            "role": payload.get("role"),
            "first_name": payload.get("first_name"),
            "last_name": payload.get("last_name"),
        }
    except JWTError as e:
        logger.warning("JWT decode failed: %s", e)
        raise credentials_exception


async def get_current_user_role(user: dict = Depends(get_current_user)) -> str:
    role = user.get("role")
    if not role:
        raise HTTPException(status_code=403, detail="User role not found")
    return role


async def is_admin_user(role: str = Depends(get_current_user_role)) -> str:
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return role


async def require_hiring_access(user: dict = Depends(get_current_user)) -> dict:
    """Require admin, hr, or hiring_manager role."""
    if user.get("role") not in ("admin", "hr", "hiring_manager"):
        raise HTTPException(status_code=403, detail="Hiring access required")
    return user


async def require_hr_or_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin or hr role."""
    if user.get("role") not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or Admin access required")
    return user


async def require_employee(user: dict = Depends(get_current_user)) -> dict:
    """Block candidates from accessing internal employee endpoints."""
    if user.get("role") == "candidate":
        raise HTTPException(status_code=403, detail="Employee access required")
    return user


async def require_candidate(user: dict = Depends(get_current_user)) -> dict:
    """Require candidate role."""
    if user.get("role") != "candidate":
        raise HTTPException(status_code=403, detail="Candidate access required")
    return user


async def require_interviewer(user: dict = Depends(get_current_user)):
    """Allow interviewer, admin, hr, hiring_manager — anyone who can be assigned interviews."""
    role = user.get("role", "")
    if role not in ("admin", "hr", "hiring_manager", "interviewer"):
        raise HTTPException(status_code=403, detail="Interviewer access required")
    return user


async def verify_internal_key(x_internal_key: Optional[str] = Header(None)):
    """Verify shared secret for service-to-service /internal/* endpoints."""
    if not x_internal_key or x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing internal API key")
    return x_internal_key
