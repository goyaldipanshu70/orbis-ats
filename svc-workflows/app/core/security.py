import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from typing import Dict

logger = logging.getLogger("svc-workflows")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    """
    JWT-only validation -- decodes token without DB lookup.
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


async def require_employee(user: dict = Depends(get_current_user)) -> dict:
    """Block candidates from accessing internal employee endpoints."""
    if user.get("role") == "candidate":
        raise HTTPException(status_code=403, detail="Employee access required")
    return user


async def require_hr_or_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin or hr role."""
    if user.get("role") not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or Admin access required")
    return user
