from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StartHaggleRequest(BaseModel):
    product_id: UUID
    offer_amount: float
    message: str | None = None


class HaggleOfferRequest(BaseModel):
    offer_amount: float
    message: str | None = None


class HaggleMessageResponse(BaseModel):
    id: UUID
    sender_role: str
    offer_amount: Optional[Decimal] = None
    message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HaggleSessionResponse(BaseModel):
    id: UUID
    customer_id: UUID
    shop_id: UUID
    product_id: UUID
    status: str
    listed_price: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    messages: list[HaggleMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)


class HaggleListResponse(BaseModel):
    items: list[HaggleSessionResponse]
    total: int
