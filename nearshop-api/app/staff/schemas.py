"""Staff Schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class StaffInvite(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "staff"
    permissions: Optional[List[str]] = None


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    status: Optional[str] = None


class StaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    shop_id: UUID
    user_id: Optional[UUID]
    email: Optional[str]
    phone: Optional[str]
    name: str
    role: str
    permissions: Optional[List[str]]
    status: str
    joined_at: Optional[datetime]
    created_at: datetime
    # Denormalized
    user_avatar: Optional[str] = None


class StaffListResponse(BaseModel):
    items: List[StaffResponse]
    total: int


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    staff_id: UUID
    action: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    description: Optional[str]
    metadata: Optional[dict]
    created_at: datetime
    staff_name: Optional[str] = None


class AcceptInviteRequest(BaseModel):
    invite_code: str
