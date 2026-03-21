from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WishlistItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    product_price: Decimal
    product_images: Optional[list[str]] = []
    price_at_save: Optional[Decimal] = None
    price_dropped: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WishlistListResponse(BaseModel):
    items: list[WishlistItemResponse]
    total: int
    page: int
    per_page: int
