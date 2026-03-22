from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ShopCreate(BaseModel):
    name: str = Field(..., max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    subcategories: Optional[list[str]] = None
    phone: Optional[str] = Field(None, max_length=15)
    whatsapp: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    opening_hours: Optional[dict[str, Any]] = None
    delivery_options: Optional[list[str]] = None
    delivery_radius: Optional[int] = None
    delivery_fee: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    free_delivery_above: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    min_order: Optional[Decimal] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    subcategories: Optional[list[str]] = None
    phone: Optional[str] = Field(None, max_length=15)
    whatsapp: Optional[str] = Field(None, max_length=15)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    opening_hours: Optional[dict[str, Any]] = None
    cover_image: Optional[str] = None
    logo_url: Optional[str] = None
    gallery: Optional[list[str]] = None
    delivery_options: Optional[list[str]] = None
    delivery_radius: Optional[int] = None
    delivery_fee: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    free_delivery_above: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    min_order: Optional[Decimal] = None


class ShopResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    subcategories: Optional[list[str]] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[dict[str, Any]] = None
    cover_image: Optional[str] = None
    logo_url: Optional[str] = None
    gallery: Optional[list[str]] = None
    is_verified: bool = False
    is_active: bool = True
    is_premium: bool = False
    avg_rating: Decimal = Decimal("0")
    total_reviews: int = 0
    total_products: int = 0
    delivery_options: list[str] = ["pickup"]
    delivery_radius: Optional[int] = None
    delivery_fee: Decimal = Decimal("0")
    free_delivery_above: Optional[Decimal] = None
    min_order: Optional[Decimal] = None
    is_open_now: bool = False
    product_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ShopListResponse(BaseModel):
    items: list[ShopResponse]
    total: int
    page: int
    per_page: int


class NearbyShopsRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(5.0, gt=0, le=50)
    category: Optional[str] = None
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)
