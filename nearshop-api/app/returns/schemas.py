"""Returns Schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


RETURN_REASONS = [
    {"key": "damaged", "label": "Item was damaged"},
    {"key": "wrong_item", "label": "Received wrong item"},
    {"key": "not_as_described", "label": "Not as described"},
    {"key": "defective", "label": "Product is defective"},
    {"key": "size_issue", "label": "Size/fit issue"},
    {"key": "changed_mind", "label": "Changed my mind"},
    {"key": "other", "label": "Other reason"},
]


class ReturnRequestCreate(BaseModel):
    order_id: UUID
    product_id: Optional[UUID] = None
    item_name: str
    item_quantity: int = 1
    item_price: Decimal
    reason: str
    description: Optional[str] = None
    images: Optional[List[str]] = None


class ReturnRequestUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    refund_amount: Optional[Decimal] = None
    refund_method: Optional[str] = None


class TimelineEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    event_type: str
    old_status: Optional[str]
    new_status: Optional[str]
    message: Optional[str]
    actor_role: Optional[str]
    created_at: datetime


class ReturnRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    order_id: UUID
    customer_id: UUID
    shop_id: UUID
    product_id: Optional[UUID]
    item_name: str
    item_quantity: int
    item_price: Decimal
    reason: str
    description: Optional[str]
    images: Optional[List[str]]
    status: str
    refund_amount: Optional[Decimal]
    refund_method: Optional[str]
    refund_status: Optional[str]
    requested_at: datetime
    approved_at: Optional[datetime]
    rejected_at: Optional[datetime]
    completed_at: Optional[datetime]
    resolution_notes: Optional[str]
    # Denormalized
    order_number: Optional[str] = None
    shop_name: Optional[str] = None
    product_image: Optional[str] = None


class ReturnRequestDetail(ReturnRequestResponse):
    timeline: List[TimelineEvent] = []


class ReturnListResponse(BaseModel):
    items: List[ReturnRequestResponse]
    total: int


class PolicyCreate(BaseModel):
    returns_enabled: str = "Y"
    return_window_days: int = 7
    refund_processing_days: int = 5
    returnable_categories: Optional[List[str]] = None
    non_returnable_categories: Optional[List[str]] = None
    require_images: str = "Y"
    require_original_packaging: str = "N"
    partial_refund_percentage: int = 100
    policy_text: Optional[str] = None


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    shop_id: UUID
    returns_enabled: str
    return_window_days: int
    refund_processing_days: int
    returnable_categories: Optional[List[str]]
    non_returnable_categories: Optional[List[str]]
    require_images: str
    require_original_packaging: str
    partial_refund_percentage: int
    policy_text: Optional[str]
