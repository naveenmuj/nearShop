from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PostCreate(BaseModel):
    post_type: Literal["question", "recommendation", "collection"]
    title: str
    body: str | None = None
    images: list[str] | None = None
    latitude: float | None = None
    longitude: float | None = None


class AnswerCreate(BaseModel):
    body: str
    shop_id: UUID | None = None


class AnswerResponse(BaseModel):
    id: UUID
    post_id: UUID
    user_id: Optional[UUID] = None
    shop_id: Optional[UUID] = None
    body: str
    is_ai_generated: bool = False
    upvotes: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PostResponse(BaseModel):
    id: UUID
    user_id: UUID
    post_type: str
    title: str
    body: Optional[str] = None
    images: Optional[list[str]] = None
    upvotes: int = 0
    answers_count: int = 0
    is_resolved: bool = False
    created_at: datetime
    answers: list[AnswerResponse] | None = None

    model_config = ConfigDict(from_attributes=True)


class FeedResponse(BaseModel):
    items: list[PostResponse]
    total: int
    page: int
    per_page: int
