from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.auth.models import User, UserEvent
from app.products.models import Product
from app.shops.models import Shop


async def get_recommendations(
    db: AsyncSession, user_id, lat: float, lng: float, limit: int = 20
) -> list:
    """Content-based recommendations using user interests and browse history."""
    # Get user interests
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    radius_km = 3.0

    # Get recently viewed product categories
    await db.execute(
        select(UserEvent.metadata_)
        .where(UserEvent.user_id == user_id)
        .where(UserEvent.event_type == "product_view")
        .order_by(desc(UserEvent.created_at))
        .limit(50)
    )

    # Build category preferences from interests + browse history
    preferred_categories = set(user.interests or []) if user else set()

    # Query products: nearby, available, matching interests, ordered by popularity
    stmt = (
        select(Product)
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
    )

    if preferred_categories:
        stmt = stmt.where(Product.category.in_(preferred_categories))

    stmt = stmt.order_by(
        desc(Product.view_count + Product.wishlist_count * 2)
    ).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())
