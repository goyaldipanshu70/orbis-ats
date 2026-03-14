# svc-auth/app/schemas/rbac_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RoleOut(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str] = None
    color: Optional[str] = "#1B8EE5"
    is_system: bool
    is_active: bool
    permissions: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    color: Optional[str] = "#1B8EE5"
    permissions: dict = {}


class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[dict] = None


class OrgNodeOut(BaseModel):
    id: int
    user_id: int
    reports_to: Optional[int] = None
    department: Optional[str] = None
    title: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class SetReportingRequest(BaseModel):
    user_id: int
    reports_to: Optional[int] = None
    department: Optional[str] = None
    title: Optional[str] = None
