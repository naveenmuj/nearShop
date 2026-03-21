from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.auth.models import User
from app.notifications.service import create_notification
from app.reviews.models import Review
from app.shops.models import Shop
from app.shops.service import recalculate_shop_score


async def create_review(
    db: AsyncSession,
    user_id: UUID,
    data,
) -> Review:
    """Create a review, checking for duplicates and updating shop stats."""
    # Check for duplicate review
    dup_query = select(Review).where(
        and_(
            Review.user_id == user_id,
            Review.shop_id == data.shop_id,
            Review.order_id == data.order_id,
        )
    )
    dup_result = await db.execute(dup_query)
    if dup_result.scalar_one_or_none():
        raise BadRequestError("You have already reviewed this shop for this order")

    review = Review(
        user_id=user_id,
        shop_id=data.shop_id,
        order_id=data.order_id,
        rating=data.rating,
        comment=data.comment,
        images=data.images,
    )
    db.add(review)
    await db.flush()

    # Recalculate shop avg_rating and increment total_reviews
    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.shop_id == data.shop_id)
    )
    new_avg = avg_result.scalar() or 0

    shop_result = await db.execute(select(Shop).where(Shop.id == data.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        shop.avg_rating = round(float(new_avg), 1)
        shop.total_reviews = (shop.total_reviews or 0) + 1

    await db.flush()
    await db.refresh(review)

    # Recalculate shop score after review stats updated
    await recalculate_shop_score(db, shop_id=review.shop_id)

    # Notify shop owner about the new review
    if shop:
        comment_preview = (review.comment or "")[:50]
        try:
            await create_notification(
                db,
                user_id=shop.owner_id,
                notification_type="new_review",
                reference_type="review",
                reference_id=review.id,
                customer_name="A customer",
                rating=str(review.rating),
            )
        except Exception:
            pass

    return review


async def get_shop_reviews(
    db: AsyncSession,
    shop_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Get paginated reviews for a shop with rating distribution and average."""
    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Review).where(Review.shop_id == shop_id)
    )
    total = count_result.scalar() or 0

    # Average rating
    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.shop_id == shop_id)
    )
    average_rating = float(avg_result.scalar() or 0)

    # Rating distribution using case/when
    dist_result = await db.execute(
        select(
            *[
                func.count(case((Review.rating == i, 1))).label(f"star_{i}")
                for i in range(1, 6)
            ]
        ).where(Review.shop_id == shop_id)
    )
    dist_row = dist_result.one()
    rating_distribution = {
        str(i): getattr(dist_row, f"star_{i}") or 0 for i in range(1, 6)
    }

    # Paginated reviews with user name
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Review, User.name.label("user_name"))
        .outerjoin(User, Review.user_id == User.id)
        .where(Review.shop_id == shop_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = result.all()

    reviews = []
    for row in rows:
        review = row[0]
        user_name = row[1]
        review.user_name = user_name
        reviews.append(review)

    return {
        "average_rating": round(average_rating, 2),
        "rating_distribution": rating_distribution,
        "reviews": reviews,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


async def reply_to_review(
    db: AsyncSession,
    review_id: UUID,
    owner_id: UUID,
    reply: str,
) -> Review:
    """Reply to a review as the shop owner."""
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise NotFoundError("Review not found")

    shop_result = await db.execute(select(Shop).where(Shop.id == review.shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop or shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    review.shop_reply = reply
    review.shop_replied_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(review)
    return review


async def get_user_reviews(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Review], int]:
    """Get paginated reviews by a user."""
    count_result = await db.execute(
        select(func.count()).select_from(Review).where(Review.user_id == user_id)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        select(Review)
        .where(Review.user_id == user_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    reviews = list(result.scalars().all())

    return reviews, total
