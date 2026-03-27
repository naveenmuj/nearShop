from collections import defaultdict
from datetime import datetime, timedelta, timezone
import math
from uuid import UUID

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.customer_segments import get_customer_segments
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


def _series_value(series: list[float], start: int, end: int) -> float:
    window = series[start:end]
    return sum(window) / len(window) if window else 0.0


def _confidence_label(sample_size: int, high_threshold: int, medium_threshold: int) -> str:
    if sample_size >= high_threshold:
        return "high"
    if sample_size >= medium_threshold:
        return "medium"
    return "low"


async def get_operational_insights(
    db: AsyncSession,
    shop_id: UUID,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """Return operational insights for a shop using low-cost statistical methods.

    The implementation is statistical and rules-based:
    - 7-day sales forecast from rolling averages
    - reorder alerts from stock + 30-day sales velocity
    - customer segment summary from existing RFM segmentation
    - top local demand keywords when location is available
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)

    orders_stmt = (
        select(Order.created_at, Order.total, Order.items)
        .where(
            and_(
                Order.shop_id == shop_id,
                Order.created_at >= start,
                Order.status.not_in(["cancelled", "rejected"]),
            )
        )
        .order_by(Order.created_at.asc())
    )
    order_rows = (await db.execute(orders_stmt)).all()

    revenue_by_day: dict[str, float] = defaultdict(float)
    orders_by_day: dict[str, int] = defaultdict(int)
    units_sold_by_product: dict[str, int] = defaultdict(int)

    for row in order_rows:
        day = row.created_at.date().isoformat()
        revenue_by_day[day] += float(row.total or 0)
        orders_by_day[day] += 1

        items = row.items if isinstance(row.items, list) else []
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            if not product_id:
                continue
            quantity = item.get("quantity") or 1
            try:
                units_sold_by_product[str(product_id)] += max(int(quantity), 0)
            except (TypeError, ValueError):
                units_sold_by_product[str(product_id)] += 1

    day_keys = [(now.date() - timedelta(days=offset)).isoformat() for offset in range(29, -1, -1)]
    revenue_series = [round(revenue_by_day.get(day, 0.0), 2) for day in day_keys]
    orders_series = [orders_by_day.get(day, 0) for day in day_keys]
    total_orders_last_30_days = int(sum(orders_series))
    total_revenue_last_30_days = round(sum(revenue_series), 2)

    recent_revenue_avg = _series_value(revenue_series, 23, 30)
    previous_revenue_avg = _series_value(revenue_series, 16, 23)
    recent_orders_avg = _series_value([float(v) for v in orders_series], 23, 30)
    previous_orders_avg = _series_value([float(v) for v in orders_series], 16, 23)

    revenue_trend_pct = (
        round(((recent_revenue_avg - previous_revenue_avg) / previous_revenue_avg) * 100, 1)
        if previous_revenue_avg > 0
        else None
    )
    orders_trend_pct = (
        round(((recent_orders_avg - previous_orders_avg) / previous_orders_avg) * 100, 1)
        if previous_orders_avg > 0
        else None
    )

    products_stmt = (
        select(
            Product.id,
            Product.name,
            Product.category,
            Product.stock_quantity,
            Product.low_stock_threshold,
            Product.price,
            Product.is_available,
        )
        .where(
            and_(
                Product.shop_id == shop_id,
                Product.is_available == True,
                Product.stock_quantity.isnot(None),
            )
        )
        .order_by(Product.stock_quantity.asc(), Product.created_at.desc())
    )
    product_rows = (await db.execute(products_stmt)).all()

    reorder_alerts = []
    for row in product_rows:
        stock_quantity = int(row.stock_quantity or 0)
        threshold = int(row.low_stock_threshold or 0)
        sold_last_30_days = units_sold_by_product.get(str(row.id), 0)
        daily_sales_velocity = round(sold_last_30_days / 30, 2) if sold_last_30_days > 0 else 0.0
        days_left = round(stock_quantity / daily_sales_velocity, 1) if daily_sales_velocity > 0 else None
        needs_reorder = stock_quantity <= threshold or (days_left is not None and days_left <= 7)
        if not needs_reorder:
            continue

        target_stock_days = 14
        recommended_reorder_qty = (
            max(int(math.ceil((daily_sales_velocity * target_stock_days) - stock_quantity)), 1)
            if daily_sales_velocity > 0
            else max((threshold * 2) - stock_quantity, 1)
        )

        reorder_alerts.append(
            {
                "product_id": str(row.id),
                "product_name": row.name,
                "category": row.category,
                "stock_quantity": stock_quantity,
                "low_stock_threshold": threshold,
                "sold_last_30_days": sold_last_30_days,
                "daily_sales_velocity": daily_sales_velocity,
                "days_left": days_left,
                "recommended_reorder_qty": recommended_reorder_qty,
                "severity": "high" if stock_quantity <= threshold else "medium",
                "estimated_revenue_at_risk": round(float(row.price or 0) * max(sold_last_30_days / 4, 1), 2),
            }
        )

    reorder_alerts.sort(
        key=lambda item: (
            0 if item["severity"] == "high" else 1,
            item["days_left"] if item["days_left"] is not None else 999,
            item["stock_quantity"],
        )
    )

    segments = await get_customer_segments(db, shop_id)
    demand = []
    if lat is not None and lng is not None:
        demand = await get_demand_insights(db, shop_id, lat, lng)

    segment_summary = segments.get("summary", {})
    segment_breakdown = segments.get("segments", {})
    recommended_actions = []
    warnings = []

    forecast_confidence = _confidence_label(total_orders_last_30_days, high_threshold=20, medium_threshold=8)
    segment_confidence = _confidence_label(int(segment_summary.get("total") or 0), high_threshold=25, medium_threshold=8)
    demand_confidence = (
        _confidence_label(sum(item.get("count", 0) for item in demand[:8]), high_threshold=40, medium_threshold=10)
        if demand
        else "low"
    )

    if forecast_confidence == "low":
        warnings.append(
            "Forecast confidence is low because the shop has limited order history in the last 30 days."
        )
    if lat is None or lng is None:
        warnings.append(
            "Demand snapshot is unavailable because shop location coordinates were not provided."
        )
    if not product_rows:
        warnings.append(
            "Reorder analysis is limited because no active stocked products were available for evaluation."
        )
    if segment_confidence == "low":
        warnings.append(
            "Customer segmentation confidence is low because the customer sample size is still small."
        )

    if reorder_alerts:
        urgent = reorder_alerts[:3]
        recommended_actions.append(
            {
                "id": "restock-priority-products",
                "type": "inventory",
                "priority": "high",
                "title": "Restock priority products",
                "description": f"{len(reorder_alerts)} product(s) are at risk of going out of stock soon.",
                "cta_label": "Review inventory",
                "target": "inventory",
                "highlights": [
                    f"{item['product_name']}: reorder {item['recommended_reorder_qty']}"
                    for item in urgent
                ],
            }
        )

    top_demand = demand[:3]
    if top_demand:
        recommended_actions.append(
            {
                "id": "promote-demand-keywords",
                "type": "demand",
                "priority": "medium",
                "title": "Promote what customers are searching for",
                "description": "Nearby demand signals show shoppers are actively searching for these terms.",
                "cta_label": "Plan a deal",
                "target": "deals",
                "highlights": [
                    f"{item['query']} ({item['count']} searches)" for item in top_demand
                ],
            }
        )

    if revenue_trend_pct is not None and revenue_trend_pct < -10:
        recommended_actions.append(
            {
                "id": "boost-sales-this-week",
                "type": "sales",
                "priority": "high",
                "title": "Sales are slowing down this week",
                "description": (
                    f"Revenue is down {abs(revenue_trend_pct)}% versus the previous week. "
                    "A small campaign or product push may help."
                ),
                "cta_label": "Create campaign",
                "target": "marketing",
                "highlights": [
                    f"Current daily average: {round(recent_revenue_avg, 2)}",
                    "Suggested action: 10-15% offer on top-viewed products",
                ],
            }
        )

    if not recommended_actions:
        recommended_actions.append(
            {
                "id": "healthy-shop-checkin",
                "type": "insight",
                "priority": "low",
                "title": "No urgent actions detected",
                "description": "Inventory and customer activity look stable. Keep monitoring this dashboard daily.",
                "cta_label": "View analytics",
                "target": "analytics",
                "highlights": [
                    f"7-day revenue forecast: {round(recent_revenue_avg * 7, 2)}",
                    f"7-day orders forecast: {int(round(recent_orders_avg * 7))}",
                ],
            }
        )

    return {
        "shop_id": str(shop_id),
        "meta": {
            "generated_at": now.isoformat(),
            "analysis_window_days": 30,
            "forecast_horizon_days": 7,
            "location_applied": lat is not None and lng is not None,
            "methods": {
                "forecasting": "rolling_average",
                "inventory_alerts": "rules_based_velocity_threshold",
                "customer_segments": "rfm_segmentation",
                "demand_snapshot": "local_search_aggregation",
            },
            "sample_sizes": {
                "orders_last_30_days": total_orders_last_30_days,
                "revenue_last_30_days": total_revenue_last_30_days,
                "active_stocked_products": len(product_rows),
                "customers_segmented": int(segment_summary.get("total") or 0),
                "demand_queries": len(demand),
            },
            "confidence": {
                "forecast": forecast_confidence,
                "segments": segment_confidence,
                "demand": demand_confidence,
            },
            "warnings": warnings,
        },
        "sales_forecast": {
            "next_7_days_revenue": round(recent_revenue_avg * 7, 2),
            "next_7_days_orders": int(round(recent_orders_avg * 7)),
            "recent_daily_avg_revenue": round(recent_revenue_avg, 2),
            "recent_daily_avg_orders": round(recent_orders_avg, 2),
            "revenue_trend_pct": revenue_trend_pct,
            "orders_trend_pct": orders_trend_pct,
            "daily_revenue_last_30_days": [
                {"date": day, "value": revenue_by_day.get(day, 0.0)}
                for day in day_keys
            ],
            "daily_orders_last_30_days": [
                {"date": day, "value": orders_by_day.get(day, 0)}
                for day in day_keys
            ],
        },
        "reorder_alerts": reorder_alerts[:8],
        "customer_segments": {
            "summary": segment_summary,
            "segments": segment_breakdown,
            "customers": segments.get("customers", [])[:6],
        },
        "demand_snapshot": demand[:8],
        "recommended_actions": recommended_actions[:4],
    }
