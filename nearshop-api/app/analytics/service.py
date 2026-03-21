from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.core.geo import within_radius
from app.auth.models import UserEvent, SearchLog
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop

PERIOD_MAP = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
}


def _period_start(period: str) -> datetime:
    days = PERIOD_MAP.get(period)
    if days is None:
        raise BadRequestError(f"Invalid period '{period}'. Use one of: 7d, 30d, 90d")
    return datetime.now(timezone.utc) - timedelta(days=days)


async def get_shop_stats(
    db: AsyncSession,
    shop_id: UUID,
    period: str = "7d",
) -> dict:
    """Aggregate shop-level stats for the given period."""
    start = _period_start(period)

    # Total views (UserEvent where entity_type='shop' and entity_id=shop_id)
    views_q = (
        select(func.count())
        .select_from(UserEvent)
        .where(
            and_(
                UserEvent.entity_type == "shop",
                UserEvent.entity_id == shop_id,
                UserEvent.event_type == "view",
                UserEvent.created_at >= start,
            )
        )
    )
    views_result = await db.execute(views_q)
    total_views: int = views_result.scalar() or 0

    # Unique visitors
    visitors_q = (
        select(func.count(func.distinct(UserEvent.user_id)))
        .select_from(UserEvent)
        .where(
            and_(
                UserEvent.entity_type == "shop",
                UserEvent.entity_id == shop_id,
                UserEvent.event_type == "view",
                UserEvent.created_at >= start,
            )
        )
    )
    visitors_result = await db.execute(visitors_q)
    unique_visitors: int = visitors_result.scalar() or 0

    # Total orders
    orders_q = (
        select(func.count())
        .select_from(Order)
        .where(
            and_(
                Order.shop_id == shop_id,
                Order.created_at >= start,
            )
        )
    )
    orders_result = await db.execute(orders_q)
    total_orders: int = orders_result.scalar() or 0

    # Total revenue (completed orders)
    revenue_q = (
        select(func.coalesce(func.sum(Order.total), 0))
        .select_from(Order)
        .where(
            and_(
                Order.shop_id == shop_id,
                Order.status == "completed",
                Order.created_at >= start,
            )
        )
    )
    revenue_result = await db.execute(revenue_q)
    total_revenue: float = float(revenue_result.scalar() or 0)

    return {
        "shop_id": str(shop_id),
        "period": period,
        "total_views": total_views,
        "unique_visitors": unique_visitors,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
    }


async def get_product_analytics(
    db: AsyncSession,
    shop_id: UUID,
) -> list[dict]:
    """Per-product analytics for a shop, sorted by view_count descending."""
    query = (
        select(
            Product.id,
            Product.name,
            Product.price,
            Product.images,
            Product.is_available,
            Product.view_count,
            Product.wishlist_count,
            Product.inquiry_count,
        )
        .where(Product.shop_id == shop_id)
        .order_by(Product.view_count.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "name": row.name,
            "price": float(row.price),
            "images": row.images,
            "is_available": row.is_available,
            "view_count": row.view_count,
            "wishlist_count": row.wishlist_count,
            "inquiry_count": row.inquiry_count,
        }
        for row in rows
    ]


async def get_demand_insights(
    db: AsyncSession,
    shop_id: UUID,
    lat: float,
    lng: float,
) -> list[dict]:
    """Top search queries near the shop within the last 30 days (3 km radius)."""
    radius_km = 3.0
    since = datetime.now(timezone.utc) - timedelta(days=30)

    query = (
        select(
            SearchLog.query_text,
            func.count().label("search_count"),
        )
        .where(
            and_(
                SearchLog.query_text.isnot(None),
                SearchLog.query_text != "",
                SearchLog.created_at >= since,
                within_radius(
                    SearchLog.latitude, SearchLog.longitude, lat, lng, radius_km
                ),
            )
        )
        .group_by(SearchLog.query_text)
        .order_by(func.count().desc())
        .limit(20)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {"query": row.query_text, "count": row.search_count}
        for row in rows
    ]
