"""Feature 9: Hyperlocal Trending Feed.

Counts UserEvents (product_view, wishlist_add, add_to_cart) in the last 24 h
within a configurable radius, then ranks products by event velocity.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, desc, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserEvent
from app.products.models import Product
from app.shops.models import Shop
from app.core.geo import within_radius


# Event weights: how much each event type contributes to trend score
_WEIGHTS = {
    "product_view": 1,
    "wishlist_add": 3,
    "add_to_cart": 5,
    "purchase": 10,
}


async def get_trending_products(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    hours: int = 24,
    limit: int = 20,
) -> list[dict]:
    """
    Return trending products near the user based on recent event velocity.

    Scans UserEvents in the last *hours* hours within *radius_km* km,
    weights by event type, and returns top products with trend metadata.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Count weighted events per product from events that have location
    stmt = (
        select(
            UserEvent.entity_id.label("product_id"),
            func.coalesce(
                func.sum(
                    case(
                        *[
                            (UserEvent.event_type == event_type, weight)
                            for event_type, weight in _WEIGHTS.items()
                        ],
                        else_=0,
                    )
                ),
                0,
            ).label("weighted_score"),
            func.count(func.distinct(UserEvent.user_id)).label("unique_users"),
            func.count(UserEvent.id).label("event_count"),
        )
        .where(
            and_(
                UserEvent.entity_type == "product",
                UserEvent.event_type.in_(list(_WEIGHTS.keys())),
                UserEvent.created_at >= since,
                UserEvent.latitude.isnot(None),
                UserEvent.longitude.isnot(None),
                within_radius(
                    UserEvent.latitude,
                    UserEvent.longitude,
                    lat,
                    lng,
                    radius_km,
                ),
            )
        )
        .group_by(UserEvent.entity_id)
        .order_by(desc("weighted_score"), desc(func.count(UserEvent.id)))
        .limit(limit * 3)  # over-fetch so we can join & filter inactive
    )

    event_rows = (await db.execute(stmt)).fetchall()

    if not event_rows:
        return []

    product_ids = [row.product_id for row in event_rows]
    event_map = {
        str(row.product_id): {
            "weighted_score": int(row.weighted_score or 0),
            "event_count": row.event_count,
            "unique_users": row.unique_users,
        }
        for row in event_rows
    }

    # Fetch product details (only active products in active shops)
    prod_stmt = (
        select(Product, Shop.name.label("shop_name"), Shop.avg_rating.label("shop_rating"))
        .join(Shop, Shop.id == Product.shop_id)
        .where(
            Product.id.in_(product_ids),
            Product.is_available == True,  # noqa: E712
            Shop.is_active == True,  # noqa: E712
        )
    )
    prod_rows = (await db.execute(prod_stmt)).fetchall()

    if not prod_rows:
        return []

    results = []
    for row in prod_rows:
        p = row.Product
        ev = event_map.get(str(p.id), {"event_count": 0, "unique_users": 0})
        results.append(
            {
                "id": str(p.id),
                "name": p.name,
                "price": float(p.price or 0),
                "compare_price": float(p.compare_price) if p.compare_price else None,
                "images": p.images or [],
                "category": p.category,
                "shop_id": str(p.shop_id),
                "shop_name": row.shop_name,
                "shop_rating": float(row.shop_rating) if row.shop_rating else None,
                "trending_score": ev["weighted_score"],
                "event_count": ev["event_count"],
                "unique_viewers": ev["unique_users"],
                "trend_label": _trend_label(ev["weighted_score"]),
            }
        )

    # Sort by trending_score descending and cap at limit
    results.sort(key=lambda x: x["trending_score"], reverse=True)
    return results[:limit]


def _trend_label(score: int) -> str:
    if score >= 20:
        return "🔥 Viral"
    elif score >= 10:
        return "📈 Trending"
    elif score >= 5:
        return "⚡ Rising"
    else:
        return "👀 Watched"
