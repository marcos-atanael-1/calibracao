from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


# --- Request schemas ---

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.TECNICO


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


class ChangePasswordRequest(BaseModel):
    new_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# --- Response schemas ---

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: UserRole
    is_active: bool
    must_change_password: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    user: UserResponse
