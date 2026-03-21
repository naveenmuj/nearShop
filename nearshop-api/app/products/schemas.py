from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(..., max_length=300)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0, decimal_places=2)
    compare_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    attributes: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None
    images: list[str] = Field(default_factory=list)
    is_featured: Optional[bool] = False
    barcode: Optional[str] = Field(None, max_length=50)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    compare_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    attributes: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None
    images: Optional[list[str]] = None
    is_featured: Optional[bool] = None
    barcode: Optional[str] = Field(None, max_length=50)


class ProductResponse(BaseModel):
    id: UUID
    shop_id: UUID
    name: str
    description: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None
    tags: Optional[list[str]] = None
    images: list[str]
    is_available: bool = True
    is_featured: bool = False
    view_count: int = 0
    wishlist_count: int = 0
    inquiry_count: int = 0
    ai_generated: bool = False
    barcode: Optional[str] = None
    shop_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    per_page: int


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
