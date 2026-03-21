from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business, require_customer
from app.stories.schemas import StoryCreate, StoryResponse, StoryFeedResponse
from app.stories.service import (
    create_story,
    get_story_feed,
    get_discover_stories,
    get_shop_stories,
    record_view,
    delete_story,
)

router = APIRouter(prefix="/api/v1/stories", tags=["stories"])


@router.post("", response_model=StoryResponse)
async def create_story_endpoint(
    body: StoryCreate,
    shop_id: UUID = Query(..., description="Shop ID to create the story for"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    story = await create_story(db, shop_id, current_user.id, body)
    return StoryResponse.model_validate(story)


@router.get("/feed", response_model=StoryFeedResponse)
async def get_story_feed_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    groups = await get_story_feed(db, current_user.id)
    return StoryFeedResponse(items=groups)


@router.get("/discover", response_model=StoryFeedResponse)
async def get_discover_stories_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    groups = await get_discover_stories(db, current_user.id, lat, lng)
    return StoryFeedResponse(items=groups)


@router.get("/shop/{shop_id}", response_model=list[StoryResponse])
async def get_shop_stories_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Get active stories for a shop (business owner view)."""
    stories = await get_shop_stories(db, shop_id)
    return [StoryResponse.model_validate(s) for s in stories]


@router.post("/{story_id}/view", response_model=StoryResponse)
async def record_view_endpoint(
    story_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    story = await record_view(db, story_id)
    return StoryResponse.model_validate(story)


@router.delete("/{story_id}")
async def delete_story_endpoint(
    story_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    await delete_story(db, story_id, current_user.id)
    return {"detail": "Story deleted successfully"}
