from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

import math

from app.products.models import Product
from app.shops.models import Shop
from app.core.geo import haversine_distance_km

# Import all models with relationships to ensure SQLAlchemy mapper resolves them
import app.auth.models  # noqa: F401 — User
import app.reviews.models  # noqa: F401 — Review
import app.orders.models  # noqa: F401 — Order
import app.deals.models  # noqa: F401 — Deal
import app.stories.models  # noqa: F401 — Story
import app.delivery.models  # noqa: F401 — DeliveryZone


def _py_haversine(lat1, lng1, lat2, lng2):
    """Pure Python haversine distance in km (for post-query calculations)."""
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return r * 2 * math.asin(math.sqrt(a))


async def search_unified(
    db: AsyncSession,
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    product_limit: int = 10,
    shop_limit: int = 8,
) -> dict:
    """
    Unified search across products and shops.

    Returns: {products: [...], shops: [...]} with formatted responses.
    """
    try:
        if not query.strip():
            return {"products": [], "shops": []}

        # Search products - select only specific columns to avoid schema issues
        ts_query = func.plainto_tsquery("english", query)
        ts_vector = func.to_tsvector(
            "english",
            func.coalesce(Product.name, "")
            + " "
            + func.coalesce(Product.description, "")
            + " "
            + func.coalesce(Product.category, ""),
        )
        like_pattern = f"%{query}%"

        product_stmt = select(Product.id, Product.name, Product.price, Product.images, Product.category, Product.shop_id).where(
            and_(
                Product.is_available == True,
                or_(
                    ts_vector.op("@@")(ts_query),
                    Product.name.ilike(like_pattern),
                    Product.category.ilike(like_pattern),
                    Product.description.ilike(like_pattern),
                ),
            )
        )

        if lat is not None and lng is not None:
            product_stmt = product_stmt.order_by(Product.name).limit(product_limit)
        else:
            product_stmt = product_stmt.order_by(Product.name).limit(product_limit)

        product_result = await db.execute(product_stmt)
        products_raw = product_result.fetchall()

        # Format products
        products = []
        for prod in products_raw:
            products.append({
                "id": str(prod[0]),
                "name": prod[1],
                "price": float(prod[2]),
                "image": prod[3][0] if prod[3] else None,
                "category": prod[4],
                "shop_id": str(prod[5]),
            })

        # Search shops - select specific columns to avoid lazy loading issues
        shop_ts_query = func.plainto_tsquery("english", query)
        shop_ts_vector = func.to_tsvector(
            "english",
            func.coalesce(Shop.name, "")
            + " "
            + func.coalesce(Shop.description, "")
            + " "
            + func.coalesce(Shop.category, ""),
        )

        shop_stmt = select(
            Shop.id, Shop.name, Shop.category, Shop.cover_image, Shop.logo_url,
            Shop.avg_rating, Shop.total_reviews, Shop.latitude, Shop.longitude,
            Shop.delivery_options, Shop.delivery_fee, Shop.min_order, Shop.score
        ).where(
            and_(
                Shop.is_active == True,
                or_(
                    shop_ts_vector.op("@@")(shop_ts_query),
                    Shop.name.ilike(like_pattern),
                    Shop.category.ilike(like_pattern),
                    Shop.description.ilike(like_pattern),
                ),
            )
        )

        if lat is not None and lng is not None:
            try:
                distance_expr = haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude)
                shop_stmt = shop_stmt.order_by(distance_expr, Shop.score.desc().nullslast()).limit(shop_limit)
            except Exception:
                shop_stmt = shop_stmt.order_by(Shop.score.desc().nullslast()).limit(shop_limit)
        else:
            shop_stmt = shop_stmt.order_by(Shop.score.desc().nullslast()).limit(shop_limit)

        shop_result = await db.execute(shop_stmt)
        shops_raw = shop_result.fetchall()

        # Format shops
        shops = []
        for shop in shops_raw:
            shop_id, name, category, cover_img, logo, rating, reviews, shop_lat, shop_lng, delivery_opts, delivery_fee, min_order, score = shop
            distance = None
            if lat is not None and lng is not None:
                distance = _py_haversine(lat, lng, shop_lat, shop_lng)

            shops.append({
                "id": str(shop_id),
                "name": name,
                "category": category,
                "cover_image": cover_img,
                "logo_url": logo,
                "rating": float(rating) if rating else 0,
                "total_reviews": reviews or 0,
                "distance": distance,
                "delivery_options": delivery_opts or [],
                "delivery_fee": float(delivery_fee) if delivery_fee else 0,
                "min_order": float(min_order) if min_order else None,
            })

        return {"products": products, "shops": shops}
    except Exception as e:
        print(f"Error in search_unified: {e}")
        return {"products": [], "shops": []}


async def get_search_suggestions(
    db: AsyncSession,
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = 8,
) -> list[dict]:
    """
    Get smart search suggestions (products + shops + recent searches).

    Returns: List of suggestion dicts with type, name, icon, etc.
    """
    suggestions = []

    if not query.strip() or len(query) < 2:
        return suggestions

    prefix = f"{query.lower()}%"
    like_pattern = f"%{query}%"

    # Product suggestions (prioritized)
    product_result = await db.execute(
        select(Product.id, Product.name, Product.category, Product.price)
        .where(
            and_(
                Product.is_available == True,
                or_(
                    Product.name.ilike(prefix),
                    Product.name.ilike(like_pattern),
                ),
            )
        )
        .order_by(Product.name)
        .limit(limit // 2)
    )

    for product_id, name, category, price in product_result.fetchall():
        suggestions.append(
            {
                "id": str(product_id),
                "type": "product",
                "name": name,
                "category": category,
                "price": float(price),
                "icon": "🛍️",
            }
        )

    # Shop suggestions
    shop_result = await db.execute(
        select(Shop.id, Shop.name, Shop.category)
        .where(
            and_(
                Shop.is_active == True,
                or_(
                    Shop.name.ilike(prefix),
                    Shop.name.ilike(like_pattern),
                ),
            )
        )
        .order_by(Shop.name)
        .limit(limit // 2)
    )

    for shop_id, name, category in shop_result.fetchall():
        distance_text = ""
        if lat is not None and lng is not None:
            # Get shop coords for distance
            shop_result_coord = await db.execute(
                select(Shop.latitude, Shop.longitude).where(Shop.id == shop_id)
            )
            coords = shop_result_coord.first()
            if coords:
                dist = haversine_distance_km(
                    lat, lng, coords[0], coords[1]
                )
                distance_text = f" • {dist:.1f}km away"

        suggestions.append(
            {
                "id": str(shop_id),
                "type": "shop",
                "name": name,
                "category": category,
                "distance_text": distance_text,
                "icon": "🏪",
            }
        )

    return suggestions[:limit]


async def get_nearby_deliverable_shops(
    db: AsyncSession,
    customer_lat: float,
    customer_lng: float,
    radius_km: float = 5.0,
    limit: int = 10,
) -> list[dict]:
    """
    Get shops that deliver to customer location within radius.

    Returns: List of shop dicts with delivery info and distance.
    """
    try:
        # Get all active shops within radius - select specific columns to avoid lazy loading
        distance_expr = haversine_distance_km(customer_lat, customer_lng, Shop.latitude, Shop.longitude)

        stmt = select(
            Shop.id, Shop.name, Shop.category, Shop.cover_image, Shop.logo_url,
            Shop.avg_rating, Shop.total_reviews, Shop.latitude, Shop.longitude,
            Shop.delivery_options, Shop.delivery_fee, Shop.free_delivery_above,
            Shop.min_order, Shop.opening_hours,
            distance_expr.label("distance")
        ).where(
            and_(
                Shop.is_active == True,
                distance_expr <= radius_km
            )
        ).order_by(distance_expr).limit(limit)

        result = await db.execute(stmt)
        shops_with_distance = result.all()

        # Format shops with only those that have delivery enabled
        deliverable_shops = []
        for shop_row in shops_with_distance:
            shop_id, name, category, cover_img, logo, rating, reviews, shop_lat, shop_lng, delivery_opts, delivery_fee, free_above, min_order, opening_hours, distance = shop_row

            # Check if delivery is enabled
            if delivery_opts and 'delivery' in delivery_opts:
                deliverable_shops.append({
                    "id": str(shop_id),
                    "name": name,
                    "category": category,
                    "cover_image": cover_img,
                    "logo_url": logo,
                    "rating": float(rating),
                    "total_reviews": reviews,
                    "distance": float(distance),
                    "delivery_fee": float(delivery_fee),
                    "free_delivery_above": float(free_above) if free_above else None,
                    "min_order": float(min_order) if min_order else None,
                    "is_open": _check_is_open_now(opening_hours),
                })

        return deliverable_shops
    except Exception as e:
        print(f"Error in get_nearby_deliverable_shops: {e}")
        import traceback
        traceback.print_exc()
        return []


def _check_is_open_now(opening_hours: dict | None) -> bool:
    """Check if a shop is currently open."""
    if not opening_hours:
        return False
    from datetime import datetime, timezone

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
