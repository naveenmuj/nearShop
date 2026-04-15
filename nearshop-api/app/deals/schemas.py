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
    original_price: Optional[Decimal] = None
    deal_price: Optional[Decimal] = None
    savings_pct: Optional[int] = None  # Calculated: (original - deal) / original * 100
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


class PersonalizedDealResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    discount_pct: int = 0
    discount_amount: float = 0
    expires_at: Optional[datetime] = None
    shop_id: UUID
    shop_name: Optional[str] = None
    shop_rating: float = 3.0
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    original_price: Optional[Decimal] = None
    deal_price: Optional[Decimal] = None
    savings_pct: Optional[int] = None  # Calculated: (original - deal) / original * 100
    current_claims: int = 0
    max_claims: Optional[int] = None
    personalisation_score: float = 0
    match_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PersonalizedDealListResponse(BaseModel):
    items: list[PersonalizedDealResponse]
    total: int
    page: int
    per_page: int
