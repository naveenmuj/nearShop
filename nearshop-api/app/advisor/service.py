from uuid import UUID
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.products.models import Product
from app.orders.models import Order
from app.shops.models import Shop


async def get_smart_suggestions(db: AsyncSession, shop_id: UUID) -> list:
    suggestions = []
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)

    # 1. Dead stock
    dead = (await db.execute(
        select(Product).where(
            Product.shop_id == shop_id, Product.is_available == True,
            Product.view_count == 0, Product.created_at < d30,
        ).limit(5)
    )).scalars().all()
    if dead:
        names = ", ".join(p.name[:30] for p in dead[:3])
        suggestions.append({
            "type": "dead_stock", "priority": "high", "icon": "📦",
            "title": f"{len(dead)} products have zero views",
            "body": f"{names} haven't been viewed in 30 days. Consider removing or discounting.",
            "action": "discount_or_remove",
        })

    # 2. High views, no inquiries
    hvli = (await db.execute(
        select(Product).where(
            Product.shop_id == shop_id, Product.is_available == True,
            Product.view_count > 20, Product.inquiry_count == 0,
        ).order_by(desc(Product.view_count)).limit(3)
    )).scalars().all()
    for p in hvli:
        suggestions.append({
            "type": "pricing_issue", "priority": "high", "icon": "💰",
            "title": f"{p.name[:40]} — {p.view_count} views, 0 inquiries",
            "body": "People look but don't ask. Try reducing the price by 10-15%.",
            "action": "reduce_price", "product_id": str(p.id),
        })

    # 3. Best sellers to promote
    best = (await db.execute(
        select(Product).where(Product.shop_id == shop_id, Product.is_available == True, Product.inquiry_count > 3)
        .order_by(desc(Product.inquiry_count)).limit(2)
    )).scalars().all()
    for p in best:
        suggestions.append({
            "type": "promote", "priority": "medium", "icon": "🌟",
            "title": f"Promote {p.name[:40]} — it's popular!",
            "body": f"{p.inquiry_count} inquiries. Create a deal to boost it further.",
            "action": "create_deal", "product_id": str(p.id),
        })

    # 4. Review reminder
    shop = await db.get(Shop, shop_id)
    if shop and (shop.total_reviews or 0) < 10:
        suggestions.append({
            "type": "reviews", "priority": "low", "icon": "⭐",
            "title": "Get more reviews to rank higher",
            "body": f"You have {shop.total_reviews or 0} reviews. Shops with 10+ get 2x visibility.",
            "action": "request_reviews",
        })

    # 5. Catalog freshness
    total = (await db.execute(
        select(func.count()).select_from(Product).where(Product.shop_id == shop_id, Product.is_available == True)
    )).scalar() or 0
    if total == 0:
        suggestions.append({
            "type": "no_products", "priority": "high", "icon": "📸",
            "title": "Your catalog is empty",
            "body": "Add products to start getting orders. Use Snap & List for quick AI-powered listing.",
            "action": "add_product",
        })

    # 6. No orders in 7 days
    recent_orders = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.shop_id == shop_id, Order.created_at >= now - timedelta(days=7),
        )
    )).scalar() or 0
    if total > 0 and recent_orders == 0:
        suggestions.append({
            "type": "no_orders", "priority": "medium", "icon": "📢",
            "title": "No orders in the last 7 days",
            "body": "Share your shop link on WhatsApp and create a deal to attract customers.",
            "action": "share_shop",
        })

    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: priority_order.get(s["priority"], 3))
    return suggestions[:10]
