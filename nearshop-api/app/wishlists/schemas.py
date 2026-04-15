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
    original_price: Optional[Decimal] = None  # compare_price from Product
    product_images: Optional[list[str]] = []
    shop_name: Optional[str] = None
    shop_id: Optional[str] = None
    price_at_save: Optional[Decimal] = None
    price_dropped: bool = False
    created_at: datetime
    is_available: bool = True
    stock_quantity: Optional[int] = None
    low_stock_threshold: int = 5
    
    # Convenience fields for frontend compatibility
    @property
    def price(self) -> Decimal:
        """Alias for product_price for frontend compatibility"""
        return self.product_price
    
    @property
    def image(self) -> Optional[str]:
        """First image for frontend compatibility"""
        return self.product_images[0] if self.product_images and len(self.product_images) > 0 else None

    model_config = ConfigDict(from_attributes=True)


class WishlistListResponse(BaseModel):
    items: list[WishlistItemResponse]
    total: int
    page: int
    per_page: int
