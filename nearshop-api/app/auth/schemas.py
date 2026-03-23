from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SendOTPRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    code: str


class UserResponse(BaseModel):
    id: UUID
    phone: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    firebase_uid: Optional[str] = None
    roles: list[str]
    active_role: str
    interests: Optional[list[str]] = None
    referral_code: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class CompleteProfileRequest(BaseModel):
    name: str
    role: Literal["customer", "business"]
    interests: Optional[list[str]] = None


class SwitchRoleRequest(BaseModel):
    role: Literal["customer", "business"]


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class FirebaseSignInRequest(BaseModel):
    firebase_token: Optional[str] = None
    id_token: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    interests: Optional[list[str]] = None
