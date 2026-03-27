from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrderItemSchema(BaseModel):
    product_id: UUID
    quantity: int
    price: Optional[float] = None
    ranking_context: Optional[dict] = None


class OrderCreate(BaseModel):
    shop_id: UUID
    items: list[OrderItemSchema]
    delivery_type: str = "pickup"
    delivery_address: Optional[str] = None
    payment_method: str = "cod"
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str


class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    customer_id: UUID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    shop_id: UUID
    items: list[dict]
    subtotal: Optional[Decimal] = None
    delivery_fee: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    total: Decimal
    status: Optional[str] = None
    delivery_type: Optional[str] = None
    delivery_address: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    payment_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    per_page: int
