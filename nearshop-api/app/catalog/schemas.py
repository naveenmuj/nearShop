from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CatalogTemplateResponse(BaseModel):
    id: UUID
    sku: str
    name: str
    brand: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    image_urls: list[str] | None = None
    thumbnail_url: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None
    variants: Optional[dict[str, Any]] = None
    data_source: Optional[str] = None
    source_url: Optional[str] = None
    source_id: Optional[str] = None
    confidence_score: Optional[float] = None
    popularity_score: int = 0
    num_shops_using: int = 0
    avg_rating: Optional[float] = None
    num_reviews: int = 0
    base_price_inr: Optional[Decimal] = None
    compare_price_inr: Optional[Decimal] = None
    is_active: bool = True
    is_verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class CatalogTemplateListResponse(BaseModel):
    items: list[CatalogTemplateResponse]
    total: int
    page: int
    per_page: int


class CatalogCategorySummary(BaseModel):
    name: str
    count: int


class CatalogSelectionItem(BaseModel):
    catalog_id: UUID
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    stock_quantity: Optional[int] = None
    local_description: Optional[str] = None


class CatalogAddProductsRequest(BaseModel):
    items: list[CatalogSelectionItem] = Field(default_factory=list)


class CatalogAddResultItem(BaseModel):
    catalog_id: UUID
    product_id: Optional[UUID] = None
    name: str
    status: str
    message: Optional[str] = None


class CatalogAddProductsResponse(BaseModel):
    created_count: int
    updated_count: int
    skipped_count: int
    items: list[CatalogAddResultItem]


class CatalogEnableProductsRequest(BaseModel):
    product_ids: list[UUID] = Field(default_factory=list)


class CatalogEnableProductsResponse(BaseModel):
    enabled_count: int
    already_enabled_count: int
    not_found_count: int
    message: str
