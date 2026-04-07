"""Messaging Schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    content: Optional[str] = None
    message_type: str = "text"
    attachments: Optional[List[str]] = None
    metadata: Optional[dict] = None


class ReactionUpdate(BaseModel):
    emoji: str


class PresenceResponse(BaseModel):
    conversation_id: UUID
    role_online: dict
    role_last_seen: dict


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_role: str
    content: Optional[str]
    message_type: str
    attachments: Optional[List[str]]
    metadata: Optional[dict] = Field(default=None, alias="message_metadata")
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime


class ConversationCreate(BaseModel):
    shop_id: UUID
    product_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    initial_message: Optional[str] = None


class BusinessConversationCreate(BaseModel):
    customer_id: UUID
    shop_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    initial_message: Optional[str] = None


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    customer_id: UUID
    shop_id: UUID
    product_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    status: str
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime
    other_party_name: Optional[str] = None
    other_party_avatar: Optional[str] = None
    last_message_preview: Optional[str] = None
    shop_name: Optional[str] = None
    product_name: Optional[str] = None


class ConversationDetail(ConversationSummary):
    messages: List[MessageResponse] = []
    messages_has_more: bool = False
    messages_next_before_id: Optional[UUID] = None


class ConversationListResponse(BaseModel):
    items: List[ConversationSummary]
    total: int


class TemplateCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = "general"


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    shop_id: UUID
    title: str
    content: str
    category: Optional[str]
    is_active: bool
    use_count: int
    created_at: datetime
