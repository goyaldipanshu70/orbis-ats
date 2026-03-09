from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = ""
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    must_change_password: bool
    provider: Optional[str] = None
    picture: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id_to_str(cls, v):
        return str(v) if v is not None else ""


class CreateUserRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "hr"
    is_active: bool = True
    must_change_password: bool = False


class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    must_change_password: Optional[bool] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


class UpdateUserStatusRequest(BaseModel):
    is_active: bool
