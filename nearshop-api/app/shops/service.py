import re
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.core.geo import haversine_distance_km, within_radius
from app.auth.models import Follow
from app.shops.models import Shop
from app.shops.schemas import ShopCreate, ShopUpdate


def _slugify(text: str) -> str:
    """Generate a URL-friendly slug from text."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _check_is_open_now(opening_hours: dict | None) -> bool:
    """Check if a shop is currently open based on opening_hours."""
    if not opening_hours:
        return False
    now = datetime.now(timezone.utc)
    day_name = now.strftime("%A").lower()
    today_hours = opening_hours.get(day_name)
    if not today_hours:
        return False
    try:
        open_time = datetime.strptime(today_hours.get("open", ""), "%H:%M").time()
        close_time = datetime.strptime(today_hours.get("close", ""), "%H:%M").time()
        return open_time <= now.time() <= close_time
    except (ValueError, AttributeError):
        return False


async def create_shop(
    db: AsyncSession,
    owner_id: UUID,
    data: ShopCreate,
) -> Shop:
    """Create a new shop with geocoded location."""
    base_slug = _slugify(data.name)
    slug = base_slug

    # Ensure unique slug
    counter = 1
    while True:
        existing = await db.execute(select(Shop).where(Shop.slug == slug))
        if existing.scalar_one_or_none() is None:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    shop = Shop(
        owner_id=owner_id,
        name=data.name,
        slug=slug,
        category=data.category,
        subcategories=data.subcategories,
        phone=data.phone,
        whatsapp=data.whatsapp,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
        opening_hours=data.opening_hours,
        delivery_options=data.delivery_options or ["pickup"],
        delivery_radius=data.delivery_radius,
        min_order=data.min_order,
    )
    db.add(shop)
    await db.flush()
    await db.refresh(shop)
    return shop


async def update_shop(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
    data: ShopUpdate,
) -> Shop:
    """Update a shop, verifying ownership."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    update_data = data.model_dump(exclude_unset=True)

    # Update slug if name changed
    if "name" in update_data:
        base_slug = _slugify(update_data["name"])
        slug = base_slug
        counter = 1
        while True:
            existing = await db.execute(
                select(Shop).where(and_(Shop.slug == slug, Shop.id != shop_id))
            )
            if existing.scalar_one_or_none() is None:
                break
            slug = f"{base_slug}-{counter}"
            counter += 1
        update_data["slug"] = slug

    for key, value in update_data.items():
        setattr(shop, key, value)

    await db.flush()
    await db.refresh(shop)
    return shop


async def get_shop(db: AsyncSession, shop_id: UUID) -> Shop:
    """Get a shop by ID with counts."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    return shop


async def get_nearby_shops(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    filters: Optional[dict[str, Any]] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Shop], int]:
    """Find shops within a radius using Haversine distance."""
    filters = filters or {}

    base_query = select(Shop).where(
        and_(
            Shop.is_active == True,
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
        )
    )

    # Apply filters
    if filters.get("category"):
        base_query = base_query.where(Shop.category == filters["category"])
    if filters.get("min_rating"):
        base_query = base_query.where(Shop.avg_rating >= filters["min_rating"])

    # Count query
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Order by distance (primary), then score descending as tiebreaker
    distance_expr = haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude)
    base_query = base_query.order_by(distance_expr, Shop.score.desc())

    # Pagination
    offset = (page - 1) * per_page
    base_query = base_query.offset(offset).limit(per_page)

    result = await db.execute(base_query)
    shops = list(result.scalars().all())

    return shops, total


async def search_shops(
    db: AsyncSession,
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> list[Shop]:
    """Search shops using full-text search + ILIKE fallback for partial queries."""
    ts_query = func.plainto_tsquery("english", query)
    ts_vector = func.to_tsvector(
        "english",
        func.coalesce(Shop.name, "") + " " +
        func.coalesce(Shop.description, "") + " " +
        func.coalesce(Shop.category, ""),
    )
    like_pattern = f"%{query}%"

    stmt = select(Shop).where(
        and_(
            Shop.is_active == True,
            or_(
                ts_vector.op("@@")(ts_query),
                Shop.name.ilike(like_pattern),
                Shop.category.ilike(like_pattern),
                Shop.description.ilike(like_pattern),
            ),
        )
    )

    if lat is not None and lng is not None:
        distance_expr = haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude)
        stmt = stmt.order_by(distance_expr, Shop.score.desc())
    else:
        stmt = stmt.order_by(Shop.score.desc()).limit(50)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def follow_shop(
    db: AsyncSession,
    user_id: UUID,
    shop_id: UUID,
) -> None:
    """Follow a shop."""
    # Verify shop exists
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")

    # Check if already following
    existing = await db.execute(
        select(Follow).where(
            and_(Follow.user_id == user_id, Follow.shop_id == shop_id)
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestError("Already following this shop")

    follow = Follow(user_id=user_id, shop_id=shop_id)
    db.add(follow)
    await db.flush()


async def unfollow_shop(
    db: AsyncSession,
    user_id: UUID,
    shop_id: UUID,
) -> None:
    """Unfollow a shop."""
    result = await db.execute(
        select(Follow).where(
            and_(Follow.user_id == user_id, Follow.shop_id == shop_id)
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise NotFoundError("Not following this shop")

    await db.execute(
        delete(Follow).where(
            and_(Follow.user_id == user_id, Follow.shop_id == shop_id)
        )
    )
    await db.flush()


async def recalculate_shop_score(db: AsyncSession, shop_id: UUID) -> None:
    """Recalculate and persist shop relevance score.

    Score = (avg_rating * 20) + (log1p(total_reviews) * 10) + (log1p(total_products) * 5)
    Capped at 100.
    """
    import math
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        return
    rating_score = float(shop.avg_rating or 0) * 20
    review_score = math.log1p(shop.total_reviews or 0) * 10
    product_score = math.log1p(shop.total_products or 0) * 5
    shop.score = min(round(rating_score + review_score + product_score, 4), 100.0)
    await db.flush()
