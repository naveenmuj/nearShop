from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DealCreate(BaseModel):
    product_id: Optional[UUID] = None
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    discount_pct: Optional[int] = Field(None, ge=5, le=90)
    discount_amount: Optional[float] = None
    duration_hours: int = Field(..., ge=1, le=168)
    max_claims: Optional[int] = None


class DealResponse(BaseModel):
    id: UUID
    shop_id: UUID
    product_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    discount_pct: Optional[int] = None
    discount_amount: Optional[Decimal] = None
    starts_at: datetime
    expires_at: datetime
    is_active: bool = True
    max_claims: Optional[int] = None
    current_claims: int = 0
    views: int = 0
    created_at: datetime
    shop_name: Optional[str] = None
    product_name: Optional[str] = None
    image_url: Optional[str] = None  # Product image URL for display
    category: Optional[str] = None  # Product category
    reason: Optional[str] = None
    ranking_profile: Optional[str] = None
    ranking_experiment: Optional[str] = None
    ranking_variant: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DealListResponse(BaseModel):
    items: list[DealResponse]
    total: int
    page: int
    per_page: int
