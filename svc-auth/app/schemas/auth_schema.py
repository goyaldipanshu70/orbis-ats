from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from app.models.common import Role


class SignUpRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: Role = Role.HR


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = ""
    email: EmailStr
    first_name: str
    last_name: str
    role: Role
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id_to_str(cls, v):
        return str(v) if v is not None else ""


class CreateUser(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: Role = Role.HR


class UpdateUser(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None


class CandidateSignUpRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class CandidateSignUpInitiateRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    password: str


class VerifyOTPRequest(BaseModel):
    session_token: str
    otp: str


class ResendOTPRequest(BaseModel):
    session_token: str
    type: str  # "email" or "phone"


class ResetPasswordRequest(BaseModel):
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordWithTokenRequest(BaseModel):
    token: str
    new_password: str


class InviteRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "interviewer"


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


class InviteResponse(BaseModel):
    user_id: int
    invite_url: str
    message: str
