from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import haversine_distance_km, within_radius
from app.auth.models import Follow
from app.deals.models import Deal
from app.products.models import Product
from app.shops.models import Shop
from app.stories.models import Story


async def get_personalized_feed(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
    page: int = 1,
    per_page: int = 20,
) -> list[dict]:
    """Fetch products from shops within 3 km, ordered by distance + recency."""
    radius_km = 3.0

    distance_col = haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude).label("distance_km")

    query = (
        select(
            Product,
            Shop.id.label("shop_id"),
            Shop.name.label("shop_name"),
            Shop.slug.label("shop_slug"),
            Shop.logo_url.label("shop_logo"),
            Shop.avg_rating.label("shop_rating"),
            distance_col,
        )
        .join(Shop, Product.shop_id == Shop.id)
        .where(
            and_(
                Product.is_available == True,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
        .order_by(distance_col.asc(), Product.created_at.desc())
    )

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    rows = result.all()

    items: list[dict] = []
    for row in rows:
        product = row[0]
        items.append(
            {
                "id": str(product.id),
                "name": product.name,
                "description": product.description,
                "price": float(product.price),
                "compare_price": (
                    float(product.compare_price) if product.compare_price else None
                ),
                "category": product.category,
                "images": product.images,
                "is_featured": product.is_featured,
                "view_count": product.view_count,
                "wishlist_count": product.wishlist_count,
                "created_at": product.created_at.isoformat() if product.created_at else None,
                "shop": {
                    "id": str(row.shop_id),
                    "name": row.shop_name,
                    "slug": row.shop_slug,
                    "logo_url": row.shop_logo,
                    "avg_rating": float(row.shop_rating) if row.shop_rating else 0,
                    "distance_km": round(float(row.distance_km), 2),
                },
            }
        )

    return items


async def get_dynamic_hook(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
) -> dict:
    """Return a contextual hook message based on nearby activity."""
    radius_km = 3.0
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Count nearby active deals
    deals_count_q = (
        select(func.count())
        .select_from(Deal)
        .join(Shop, Deal.shop_id == Shop.id)
        .where(
            and_(
                Deal.is_active == True,
                Deal.expires_at > now,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
    )
    deals_result = await db.execute(deals_count_q)
    deals_count: int = deals_result.scalar() or 0

    # Count new products added today from nearby shops
    products_count_q = (
        select(func.count())
        .select_from(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .where(
            and_(
                Product.is_available == True,
                Product.created_at >= today_start,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
    )
    products_result = await db.execute(products_count_q)
    new_products_count: int = products_result.scalar() or 0

    # Count followed shops with updates (new products or stories today)
    followed_updates_q = (
        select(func.count(func.distinct(Follow.shop_id)))
        .join(Shop, Follow.shop_id == Shop.id)
        .where(
            and_(
                Follow.user_id == user_id,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
        .where(
            Shop.id.in_(
                select(Product.shop_id)
                .where(Product.created_at >= today_start)
                .union(
                    select(Story.shop_id).where(Story.created_at >= today_start)
                )
            )
        )
    )
    followed_result = await db.execute(followed_updates_q)
    followed_updates: int = followed_result.scalar() or 0

    # Build contextual message -- prioritise by impact
    if deals_count > 0:
        return {
            "title": f"{deals_count} live deal{'s' if deals_count != 1 else ''} near you!",
            "subtitle": "Grab them before they expire",
            "type": "deals",
        }

    if new_products_count > 0:
        return {
            "title": f"{new_products_count} new product{'s' if new_products_count != 1 else ''} added today",
            "subtitle": "See what's fresh in your neighbourhood",
            "type": "new_products",
        }

    if followed_updates > 0:
        return {
            "title": f"{followed_updates} shop{'s' if followed_updates != 1 else ''} you follow posted updates",
            "subtitle": "Check out the latest from your favourites",
            "type": "followed_updates",
        }

    return {
        "title": "Explore shops around you",
        "subtitle": "Discover local products and deals nearby",
        "type": "explore",
    }
