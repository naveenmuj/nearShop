from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    shop_id: UUID
    order_id: Optional[UUID] = None
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    images: Optional[list[str]] = None


class ShopReplyRequest(BaseModel):
    reply: str


class ReviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    shop_id: UUID
    order_id: Optional[UUID] = None
    rating: int
    comment: Optional[str] = None
    images: Optional[list[str]] = None
    is_trusted: bool = False
    shop_reply: Optional[str] = None
    shop_replied_at: Optional[datetime] = None
    created_at: datetime
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ShopReviewsResponse(BaseModel):
    average_rating: float
    rating_distribution: dict[str, int]
    reviews: list[ReviewResponse]
    total: int
    page: int
    per_page: int
