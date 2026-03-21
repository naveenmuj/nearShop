from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.geo import within_radius
from app.auth.models import Follow
from app.shops.models import Shop
from app.stories.models import Story
from app.stories.schemas import StoryCreate, StoryResponse, ShopStoriesGroup


async def create_story(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
    data: StoryCreate,
) -> Story:
    """Create a story for a shop after verifying ownership."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    now = datetime.now(timezone.utc)
    story = Story(
        shop_id=shop_id,
        media_url=data.media_url,
        media_type=data.media_type,
        caption=data.caption,
        product_tags=data.product_tags,
        expires_at=now + timedelta(hours=24),
    )
    db.add(story)
    await db.flush()
    await db.refresh(story)

    # Attach shop info for response
    story.shop_name = shop.name  # type: ignore[attr-defined]
    story.shop_logo = shop.logo_url  # type: ignore[attr-defined]
    return story


async def get_story_feed(
    db: AsyncSession,
    user_id: UUID,
) -> list[ShopStoriesGroup]:
    """Get non-expired stories from shops the user follows, grouped by shop."""
    now = datetime.now(timezone.utc)

    # Get followed shop IDs
    follow_result = await db.execute(
        select(Follow.shop_id).where(Follow.user_id == user_id)
    )
    followed_shop_ids = list(follow_result.scalars().all())

    if not followed_shop_ids:
        return []

    # Get non-expired stories from followed shops
    stories_result = await db.execute(
        select(Story)
        .join(Shop, Story.shop_id == Shop.id)
        .where(
            and_(
                Story.shop_id.in_(followed_shop_ids),
                Story.expires_at > now,
            )
        )
        .order_by(Story.created_at.desc())
    )
    stories = list(stories_result.scalars().all())

    if not stories:
        return []

    # Fetch shop info for all relevant shops
    shop_ids = list({s.shop_id for s in stories})
    shops_result = await db.execute(
        select(Shop).where(Shop.id.in_(shop_ids))
    )
    shops_map = {s.id: s for s in shops_result.scalars().all()}

    # Group by shop
    grouped: dict[UUID, list[Story]] = defaultdict(list)
    for story in stories:
        grouped[story.shop_id].append(story)

    feed: list[ShopStoriesGroup] = []
    for sid, shop_stories in grouped.items():
        shop = shops_map.get(sid)
        if not shop:
            continue
        feed.append(
            ShopStoriesGroup(
                shop_id=sid,
                shop_name=shop.name,
                shop_logo=shop.logo_url,
                stories=[
                    StoryResponse(
                        id=s.id,
                        shop_id=s.shop_id,
                        media_url=s.media_url,
                        media_type=s.media_type,
                        caption=s.caption,
                        product_tags=s.product_tags,
                        views=s.views,
                        expires_at=s.expires_at,
                        created_at=s.created_at,
                        shop_name=shop.name,
                        shop_logo=shop.logo_url,
                    )
                    for s in shop_stories
                ],
            )
        )

    return feed


async def get_discover_stories(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
) -> list[ShopStoriesGroup]:
    """Get non-expired stories from nearby shops NOT followed by the user."""
    now = datetime.now(timezone.utc)
    radius_km = 5.0  # 5 km default discovery radius

    # Get followed shop IDs to exclude
    follow_result = await db.execute(
        select(Follow.shop_id).where(Follow.user_id == user_id)
    )
    followed_shop_ids = list(follow_result.scalars().all())

    # Get non-expired stories from nearby non-followed shops
    query = (
        select(Story)
        .join(Shop, Story.shop_id == Shop.id)
        .where(
            and_(
                Story.expires_at > now,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
        .order_by(Story.created_at.desc())
        .limit(50)
    )

    if followed_shop_ids:
        query = query.where(Story.shop_id.notin_(followed_shop_ids))

    stories_result = await db.execute(query)
    stories = list(stories_result.scalars().all())

    if not stories:
        return []

    # Fetch shop info
    shop_ids = list({s.shop_id for s in stories})
    shops_result = await db.execute(
        select(Shop).where(Shop.id.in_(shop_ids))
    )
    shops_map = {s.id: s for s in shops_result.scalars().all()}

    # Group by shop
    grouped: dict[UUID, list[Story]] = defaultdict(list)
    for story in stories:
        grouped[story.shop_id].append(story)

    feed: list[ShopStoriesGroup] = []
    for sid, shop_stories in grouped.items():
        shop = shops_map.get(sid)
        if not shop:
            continue
        feed.append(
            ShopStoriesGroup(
                shop_id=sid,
                shop_name=shop.name,
                shop_logo=shop.logo_url,
                stories=[
                    StoryResponse(
                        id=s.id,
                        shop_id=s.shop_id,
                        media_url=s.media_url,
                        media_type=s.media_type,
                        caption=s.caption,
                        product_tags=s.product_tags,
                        views=s.views,
                        expires_at=s.expires_at,
                        created_at=s.created_at,
                        shop_name=shop.name,
                        shop_logo=shop.logo_url,
                    )
                    for s in shop_stories
                ],
            )
        )

    return feed


async def get_shop_stories(
    db: AsyncSession,
    shop_id: UUID,
) -> list[Story]:
    """Get all non-expired stories for a specific shop."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story)
        .where(and_(Story.shop_id == shop_id, Story.expires_at > now))
        .order_by(Story.created_at.desc())
    )
    return list(result.scalars().all())


async def record_view(
    db: AsyncSession,
    story_id: UUID,
) -> Story:
    """Increment view count for a story."""
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        raise NotFoundError("Story not found")

    story.views += 1
    await db.flush()
    await db.refresh(story)
    return story


async def delete_story(
    db: AsyncSession,
    story_id: UUID,
    owner_id: UUID,
) -> None:
    """Delete a story after verifying shop ownership."""
    result = await db.execute(
        select(Story).options(joinedload(Story.shop)).where(Story.id == story_id)
    )
    story = result.scalar_one_or_none()
    if not story:
        raise NotFoundError("Story not found")
    if story.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    db.delete(story)
    await db.flush()
