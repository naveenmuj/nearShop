from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StoryCreate(BaseModel):
    media_url: str
    media_type: Literal["image", "video"] = "image"
    caption: Optional[str] = Field(None, max_length=200)
    product_tags: Optional[list[UUID]] = None


class StoryResponse(BaseModel):
    id: UUID
    shop_id: UUID
    media_url: str
    media_type: Optional[str] = None
    caption: Optional[str] = None
    product_tags: Optional[list[UUID]] = None
    views: int = 0
    expires_at: Optional[datetime] = None
    created_at: datetime
    shop_name: Optional[str] = None
    shop_logo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ShopStoriesGroup(BaseModel):
    shop_id: UUID
    shop_name: str
    shop_logo: Optional[str] = None
    stories: list[StoryResponse]


class StoryFeedResponse(BaseModel):
    items: list[ShopStoriesGroup]
