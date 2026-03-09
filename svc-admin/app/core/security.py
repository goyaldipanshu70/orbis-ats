import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
import bcrypt

logger = logging.getLogger("svc-admin")
from datetime import datetime, timedelta
from typing import Dict

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
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
            "department": payload.get("department"),
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


async def is_admin_or_hr_user(role: str = Depends(get_current_user_role)) -> str:
    if role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="Admin or HR access required")
    return role
