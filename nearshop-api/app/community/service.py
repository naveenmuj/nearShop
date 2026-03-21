from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.geo import within_radius
from app.community.models import CommunityPost, CommunityAnswer
from app.community.schemas import PostCreate, AnswerCreate


async def create_post(
    db: AsyncSession,
    user_id: UUID,
    data: PostCreate,
) -> CommunityPost:
    """Create a new community post."""
    post = CommunityPost(
        user_id=user_id,
        post_type=data.post_type,
        title=data.title,
        body=data.body,
        images=data.images,
        latitude=data.latitude if data.latitude is not None else None,
        longitude=data.longitude if data.longitude is not None else None,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    return post


async def get_local_feed(
    db: AsyncSession,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    sort: str = "trending",
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[CommunityPost], int]:
    """Get the local community feed with optional geo filtering."""
    base_query = select(CommunityPost)

    # Geo filter: within 5km
    if lat is not None and lng is not None:
        base_query = base_query.where(
            within_radius(
                CommunityPost.latitude, CommunityPost.longitude, lat, lng, 5.0
            )
        )

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sort
    if sort == "newest":
        base_query = base_query.order_by(CommunityPost.created_at.desc())
    else:
        # trending: order by (upvotes + answers_count * 2) DESC
        trending_score = (
            CommunityPost.upvotes + CommunityPost.answers_count * 2
        )
        base_query = base_query.order_by(trending_score.desc())

    # Pagination
    offset = (page - 1) * per_page
    base_query = base_query.offset(offset).limit(per_page)

    result = await db.execute(base_query)
    posts = list(result.scalars().all())

    return posts, total


async def get_post(
    db: AsyncSession,
    post_id: UUID,
) -> CommunityPost:
    """Get a single post with answers eagerly loaded."""
    result = await db.execute(
        select(CommunityPost)
        .options(selectinload(CommunityPost.answers))
        .where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")
    return post


async def create_answer(
    db: AsyncSession,
    post_id: UUID,
    user_id: UUID,
    data: AnswerCreate,
) -> CommunityAnswer:
    """Create an answer on a post and increment the answer count."""
    # Verify post exists
    result = await db.execute(
        select(CommunityPost).where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")

    answer = CommunityAnswer(
        post_id=post_id,
        user_id=user_id,
        shop_id=data.shop_id,
        body=data.body,
    )
    db.add(answer)

    # Increment answers_count
    post.answers_count = (post.answers_count or 0) + 1

    await db.flush()
    await db.refresh(answer)
    return answer


async def upvote_post(
    db: AsyncSession,
    post_id: UUID,
    user_id: UUID,
) -> CommunityPost:
    """Upvote a post (simple increment, no double-vote tracking for MVP)."""
    result = await db.execute(
        select(CommunityPost).where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")

    post.upvotes = (post.upvotes or 0) + 1
    await db.flush()
    await db.refresh(post)
    return post


async def mark_resolved(
    db: AsyncSession,
    post_id: UUID,
    user_id: UUID,
) -> CommunityPost:
    """Mark a post as resolved (only the author can do this)."""
    result = await db.execute(
        select(CommunityPost).where(CommunityPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found")

    if post.user_id != user_id:
        raise ForbiddenError("Only the post author can mark it as resolved")

    post.is_resolved = True
    await db.flush()
    await db.refresh(post)
    return post
