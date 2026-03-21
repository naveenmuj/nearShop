"""Admin analytics service — platform-wide statistics."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, text, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, SearchLog, UserEvent
from app.shops.models import Shop
from app.products.models import Product, Wishlist
from app.orders.models import Order
from app.reviews.models import Review
from app.deals.models import Deal
from app.stories.models import Story
from app.haggle.models import HaggleSession
from app.loyalty.models import ShopCoinsLedger
from app.community.models import CommunityPost
from app.reservations.models import Reservation


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    mapping = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    return now - timedelta(days=mapping.get(period, 30))


async def get_overview(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar() or 0
    customers = (await db.execute(select(func.count()).select_from(User).where(text("'customer' = ANY(roles)")))).scalar() or 0
    businesses = (await db.execute(select(func.count()).select_from(User).where(text("'business' = ANY(roles)")))).scalar() or 0
    new_users_7d = (await db.execute(select(func.count()).select_from(User).where(User.created_at >= d7))).scalar() or 0
    new_users_30d = (await db.execute(select(func.count()).select_from(User).where(User.created_at >= d30))).scalar() or 0

    total_shops = (await db.execute(select(func.count()).select_from(Shop).where(Shop.is_active == True))).scalar() or 0
    verified_shops = (await db.execute(select(func.count()).select_from(Shop).where(Shop.is_active == True, Shop.is_verified == True))).scalar() or 0
    new_shops_7d = (await db.execute(select(func.count()).select_from(Shop).where(Shop.created_at >= d7))).scalar() or 0

    total_products = (await db.execute(select(func.count()).select_from(Product))).scalar() or 0
    available_products = (await db.execute(select(func.count()).select_from(Product).where(Product.is_available == True))).scalar() or 0
    new_products_7d = (await db.execute(select(func.count()).select_from(Product).where(Product.created_at >= d7))).scalar() or 0
    ai_products = (await db.execute(select(func.count()).select_from(Product).where(Product.ai_generated == True))).scalar() or 0

    active_deals = (await db.execute(select(func.count()).select_from(Deal).where(Deal.is_active == True, Deal.expires_at > now))).scalar() or 0

    total_orders = (await db.execute(select(func.count()).select_from(Order))).scalar() or 0
    orders_7d = (await db.execute(select(func.count()).select_from(Order).where(Order.created_at >= d7))).scalar() or 0
    gmv_total = float((await db.execute(select(func.sum(Order.total)).where(Order.status != "cancelled"))).scalar() or 0)
    gmv_7d = float((await db.execute(select(func.sum(Order.total)).where(Order.created_at >= d7, Order.status != "cancelled"))).scalar() or 0)
    avg_order = round(gmv_total / total_orders, 2) if total_orders > 0 else 0
    cancelled = (await db.execute(select(func.count()).select_from(Order).where(Order.status == "cancelled"))).scalar() or 0
    cancel_rate = round(cancelled / total_orders * 100, 1) if total_orders > 0 else 0

    total_reviews = (await db.execute(select(func.count()).select_from(Review))).scalar() or 0
    avg_rating = round(float((await db.execute(select(func.avg(Review.rating)))).scalar() or 0), 1)

    total_wishlists = (await db.execute(select(func.count()).select_from(Wishlist))).scalar() or 0
    total_haggles = (await db.execute(select(func.count()).select_from(HaggleSession))).scalar() or 0
    total_reservations = (await db.execute(select(func.count()).select_from(Reservation))).scalar() or 0
    fulfilled_res = (await db.execute(select(func.count()).select_from(Reservation).where(Reservation.status == "fulfilled"))).scalar() or 0
    res_rate = round(fulfilled_res / total_reservations * 100, 1) if total_reservations > 0 else 0

    coins_earned = float((await db.execute(select(func.sum(ShopCoinsLedger.amount)).where(ShopCoinsLedger.amount > 0))).scalar() or 0)
    coins_spent = float((await db.execute(select(func.sum(func.abs(ShopCoinsLedger.amount))).where(ShopCoinsLedger.amount < 0))).scalar() or 0)

    community_posts = (await db.execute(select(func.count()).select_from(CommunityPost))).scalar() or 0
    active_stories = (await db.execute(select(func.count()).select_from(Story).where(Story.expires_at > now))).scalar() or 0

    try:
        searches_7d = (await db.execute(select(func.count()).select_from(SearchLog).where(SearchLog.created_at >= d7))).scalar() or 0
        zero_results_7d = (await db.execute(select(func.count()).select_from(SearchLog).where(SearchLog.created_at >= d7, SearchLog.results_count == 0))).scalar() or 0
    except Exception:
        searches_7d = 0
        zero_results_7d = 0

    try:
        inquiries_7d = (await db.execute(select(func.count()).select_from(UserEvent).where(UserEvent.event_type == "inquiry", UserEvent.created_at >= d7))).scalar() or 0
        total_inquiries = (await db.execute(select(func.count()).select_from(UserEvent).where(UserEvent.event_type == "inquiry"))).scalar() or 0
    except Exception:
        inquiries_7d = 0
        total_inquiries = 0

    return {
        "total_users": total_users, "customers": customers, "businesses": businesses,
        "new_users_7d": new_users_7d, "new_users_30d": new_users_30d,
        "total_shops": total_shops, "verified_shops": verified_shops, "new_shops_7d": new_shops_7d,
        "total_products": total_products, "available_products": available_products,
        "new_products_7d": new_products_7d,
        "ai_generated_products": ai_products,
        "ai_percentage": round(ai_products / total_products * 100, 1) if total_products > 0 else 0,
        "active_deals": active_deals,
        "total_orders": total_orders, "orders_7d": orders_7d,
        "gmv_total": gmv_total, "gmv_7d": gmv_7d,
        "avg_order_value": avg_order, "cancellation_rate": cancel_rate,
        "total_reviews": total_reviews, "avg_platform_rating": avg_rating,
        "total_inquiries": total_inquiries, "inquiries_7d": inquiries_7d,
        "total_wishlists": total_wishlists, "total_haggles": total_haggles,
        "total_reservations": total_reservations,
        "reservation_fulfillment_rate": res_rate,
        "shopcoins_earned": coins_earned, "shopcoins_spent": coins_spent,
        "shopcoins_circulation": coins_earned - coins_spent,
        "community_posts": community_posts, "active_stories": active_stories,
        "total_searches_7d": searches_7d, "zero_result_searches_7d": zero_results_7d,
    }


async def get_user_growth(db: AsyncSession, period: str = "30d", interval: str = "daily") -> list:
    start = _period_start(period)
    trunc = "day" if interval == "daily" else "week" if interval == "weekly" else "month"
    result = await db.execute(text(f"""
        SELECT date_trunc('{trunc}', created_at) AS period,
               COUNT(*) FILTER (WHERE 'customer' = ANY(roles)) AS customers,
               COUNT(*) FILTER (WHERE 'business' = ANY(roles)) AS businesses,
               COUNT(*) AS total
        FROM users WHERE created_at >= :start
        GROUP BY 1 ORDER BY 1
    """).bindparams(start=start))
    return [{"period": str(r[0])[:10], "customers": r[1], "businesses": r[2], "total": r[3]}
            for r in result.all()]


async def get_user_segmentation(db: AsyncSession) -> dict:
    customers = (await db.execute(select(func.count()).select_from(User).where(text("'customer' = ANY(roles)")))).scalar() or 0
    businesses = (await db.execute(select(func.count()).select_from(User).where(text("'business' = ANY(roles)")))).scalar() or 0
    both = (await db.execute(select(func.count()).select_from(User).where(
        text("'customer' = ANY(roles) AND 'business' = ANY(roles)")
    ))).scalar() or 0
    return {
        "customers_only": customers - both,
        "businesses_only": businesses - both,
        "both_roles": both,
    }


async def get_recent_users(db: AsyncSession, limit: int = 20) -> list:
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(limit))
    return [
        {"id": str(u.id), "name": u.name or "—", "phone": u.phone or "—",
         "roles": u.roles, "active_role": u.active_role,
         "created_at": str(u.created_at)[:19]}
        for u in result.scalars().all()
    ]


async def get_shop_leaderboard(db: AsyncSession, sort_by: str = "score", limit: int = 50) -> list:
    valid_sort = {"score": Shop.score, "total_products": Shop.total_products,
                  "avg_rating": Shop.avg_rating, "total_reviews": Shop.total_reviews,
                  "created_at": Shop.created_at}
    sort_col = valid_sort.get(sort_by, Shop.score)
    result = await db.execute(
        select(Shop).where(Shop.is_active == True).order_by(desc(sort_col)).limit(limit)
    )
    shops = []
    for s in result.scalars().all():
        order_count = (await db.execute(select(func.count()).select_from(Order).where(Order.shop_id == s.id))).scalar() or 0
        revenue = float((await db.execute(select(func.sum(Order.total)).where(Order.shop_id == s.id, Order.status != "cancelled"))).scalar() or 0)
        shops.append({
            "id": str(s.id), "name": s.name, "category": s.category or "—",
            "products": s.total_products or 0, "orders": order_count,
            "revenue": revenue, "avg_rating": float(s.avg_rating or 0),
            "reviews": s.total_reviews or 0, "score": float(s.score or 0),
            "verified": s.is_verified, "created_at": str(s.created_at)[:10],
        })
    return shops


async def get_shop_categories(db: AsyncSession) -> list:
    result = await db.execute(
        select(Shop.category, func.count()).where(Shop.is_active == True).group_by(Shop.category)
    )
    return [{"category": r[0] or "Other", "count": r[1]} for r in result.all()]


async def get_shop_growth(db: AsyncSession, period: str = "30d") -> list:
    start = _period_start(period)
    result = await db.execute(text("""
        SELECT day, count, SUM(count) OVER (ORDER BY day) AS cumulative
        FROM (
            SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS count
            FROM shops WHERE created_at >= :start
            GROUP BY 1
        ) sub
        ORDER BY day
    """).bindparams(start=start))
    return [{"date": str(r[0]), "new": int(r[1]), "cumulative": int(r[2])} for r in result.all()]


async def get_shops_needing_attention(db: AsyncSession) -> list:
    result = await db.execute(
        select(Shop).where(Shop.is_active == True)
        .order_by(Shop.total_products.asc()).limit(30)
    )
    alerts = []
    for s in result.scalars().all():
        issues = []
        score = float(s.score or 0)
        if score < 30:
            issues.append("Low score")
        if (s.total_products or 0) == 0:
            issues.append("No products")
        if (s.total_reviews or 0) == 0:
            issues.append("No reviews")
        if issues:
            alerts.append({
                "id": str(s.id), "name": s.name, "category": s.category or "—",
                "score": score, "products": s.total_products or 0,
                "reviews": s.total_reviews or 0, "issues": issues,
            })
    return alerts


async def get_products_by_category(db: AsyncSession) -> list:
    result = await db.execute(
        select(Product.category, func.count()).where(Product.is_available == True)
        .group_by(Product.category).order_by(func.count().desc())
    )
    return [{"category": r[0] or "Other", "count": r[1]} for r in result.all()]


async def get_top_products(db: AsyncSession, sort_by: str = "view_count", limit: int = 20) -> list:
    valid = {"view_count": Product.view_count, "wishlist_count": Product.wishlist_count,
             "inquiry_count": Product.inquiry_count}
    col = valid.get(sort_by, Product.view_count)
    result = await db.execute(
        select(Product, Shop.name.label("shop_name"))
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.is_available == True)
        .order_by(desc(col)).limit(limit)
    )
    return [
        {"id": str(p.id), "name": p.name, "price": float(p.price),
         "category": p.category or "—",
         "views": p.view_count or 0, "wishlisted": p.wishlist_count or 0,
         "inquiries": p.inquiry_count or 0, "shop_name": shop_name,
         "image": p.images[0] if p.images else None}
        for p, shop_name in result.all()
    ]


async def get_products_growth(db: AsyncSession, period: str = "30d") -> list:
    start = _period_start(period)
    result = await db.execute(text("""
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS count
        FROM products WHERE created_at >= :start
        GROUP BY 1 ORDER BY 1
    """).bindparams(start=start))
    return [{"date": str(r[0]), "count": int(r[1])} for r in result.all()]


async def get_price_distribution(db: AsyncSession) -> list:
    ranges = [
        (0, 100, "₹0–100"), (100, 500, "₹100–500"), (500, 1000, "₹500–1K"),
        (1000, 2000, "₹1K–2K"), (2000, 5000, "₹2K–5K"),
        (5000, 10000, "₹5K–10K"), (10000, 999999, "₹10K+"),
    ]
    out = []
    for low, high, label in ranges:
        count = (await db.execute(
            select(func.count()).select_from(Product).where(
                Product.price >= low, Product.price < high, Product.is_available == True
            )
        )).scalar() or 0
        out.append({"range": label, "count": count})
    return out


async def get_ai_stats(db: AsyncSession) -> dict:
    total = (await db.execute(select(func.count()).select_from(Product))).scalar() or 0
    ai = (await db.execute(select(func.count()).select_from(Product).where(Product.ai_generated == True))).scalar() or 0
    return {"total": total, "ai_generated": ai, "manual": total - ai,
            "ai_percentage": round(ai / total * 100, 1) if total > 0 else 0}


async def get_orders_trend(db: AsyncSession, period: str = "30d") -> list:
    start = _period_start(period)
    result = await db.execute(text("""
        SELECT date_trunc('day', created_at)::date AS day,
               COUNT(*) AS orders,
               COALESCE(SUM(total), 0) AS gmv
        FROM orders
        WHERE created_at >= :start AND status != 'cancelled'
        GROUP BY 1 ORDER BY 1
    """).bindparams(start=start))
    return [{"date": str(r[0]), "orders": int(r[1]), "gmv": float(r[2])} for r in result.all()]


async def get_order_funnel(db: AsyncSession) -> list:
    statuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]
    out = []
    for s in statuses:
        count = (await db.execute(
            select(func.count()).select_from(Order).where(Order.status == s)
        )).scalar() or 0
        out.append({"status": s, "count": count})
    return out


async def get_recent_orders(db: AsyncSession, limit: int = 50) -> list:
    result = await db.execute(
        select(Order, User.name.label("customer_name"), Shop.name.label("shop_name"))
        .join(User, User.id == Order.customer_id)
        .join(Shop, Shop.id == Order.shop_id)
        .order_by(Order.created_at.desc()).limit(limit)
    )
    return [
        {"id": str(o.id), "order_number": o.order_number,
         "customer": cname or "—", "shop": sname or "—",
         "total": float(o.total), "status": o.status,
         "delivery_type": o.delivery_type or "—",
         "created_at": str(o.created_at)[:19]}
        for o, cname, sname in result.all()
    ]


async def get_feature_usage(db: AsyncSession) -> list:
    deals_claims = float((await db.execute(select(func.sum(Deal.current_claims)))).scalar() or 0)
    return [
        {"name": "Wishlists", "count": (await db.execute(select(func.count()).select_from(Wishlist))).scalar() or 0},
        {"name": "Haggles", "count": (await db.execute(select(func.count()).select_from(HaggleSession))).scalar() or 0},
        {"name": "Deals Claimed", "count": int(deals_claims)},
        {"name": "Reviews", "count": (await db.execute(select(func.count()).select_from(Review))).scalar() or 0},
        {"name": "Reservations", "count": (await db.execute(select(func.count()).select_from(Reservation))).scalar() or 0},
        {"name": "Community Posts", "count": (await db.execute(select(func.count()).select_from(CommunityPost))).scalar() or 0},
        {"name": "Stories", "count": (await db.execute(select(func.count()).select_from(Story))).scalar() or 0},
        {"name": "Orders", "count": (await db.execute(select(func.count()).select_from(Order))).scalar() or 0},
    ]


async def get_top_searches(db: AsyncSession, limit: int = 30) -> list:
    try:
        result = await db.execute(text("""
            SELECT query_text, COUNT(*) AS freq, AVG(results_count) AS avg_results
            FROM search_logs
            WHERE query_text IS NOT NULL AND query_text != ''
            GROUP BY query_text ORDER BY freq DESC LIMIT :lim
        """).bindparams(lim=limit))
        return [{"query": r[0], "count": int(r[1]), "avg_results": round(float(r[2] or 0), 1)}
                for r in result.all()]
    except Exception:
        return []


async def get_demand_gaps(db: AsyncSession, limit: int = 20) -> list:
    try:
        result = await db.execute(text("""
            SELECT query_text, COUNT(*) AS freq
            FROM search_logs
            WHERE results_count = 0 AND query_text IS NOT NULL AND query_text != ''
            GROUP BY query_text ORDER BY freq DESC LIMIT :lim
        """).bindparams(lim=limit))
        return [{"query": r[0], "count": int(r[1])} for r in result.all()]
    except Exception:
        return []


async def get_shopcoins_economy(db: AsyncSession, period: str = "30d") -> dict:
    start = _period_start(period)
    earned = float((await db.execute(select(func.sum(ShopCoinsLedger.amount)).where(ShopCoinsLedger.amount > 0))).scalar() or 0)
    spent = float((await db.execute(select(func.sum(func.abs(ShopCoinsLedger.amount))).where(ShopCoinsLedger.amount < 0))).scalar() or 0)
    try:
        trend_result = await db.execute(text("""
            SELECT date_trunc('day', created_at)::date AS day,
                   SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS earned,
                   SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spent
            FROM shopcoins_ledger WHERE created_at >= :start
            GROUP BY 1 ORDER BY 1
        """).bindparams(start=start))
        trend = [{"date": str(r[0]), "earned": float(r[1]), "spent": float(r[2])}
                 for r in trend_result.all()]
    except Exception:
        trend = []
    return {"total_earned": earned, "total_spent": spent,
            "circulation": earned - spent, "trend": trend}


async def get_haggle_stats(db: AsyncSession) -> dict:
    total = (await db.execute(select(func.count()).select_from(HaggleSession))).scalar() or 0
    accepted = (await db.execute(select(func.count()).select_from(HaggleSession).where(HaggleSession.status == "accepted"))).scalar() or 0
    rejected = (await db.execute(select(func.count()).select_from(HaggleSession).where(HaggleSession.status == "rejected"))).scalar() or 0
    active = (await db.execute(select(func.count()).select_from(HaggleSession).where(HaggleSession.status == "active"))).scalar() or 0
    return {
        "total": total, "accepted": accepted, "rejected": rejected, "active": active,
        "acceptance_rate": round(accepted / total * 100, 1) if total > 0 else 0,
    }


async def get_deal_performance(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    total = (await db.execute(select(func.count()).select_from(Deal))).scalar() or 0
    active = (await db.execute(select(func.count()).select_from(Deal).where(Deal.is_active == True, Deal.expires_at > now))).scalar() or 0
    total_claims = int((await db.execute(select(func.sum(Deal.current_claims)))).scalar() or 0)
    return {"total_deals": total, "active_deals": active, "total_claims": total_claims}


async def get_rating_distribution(db: AsyncSession) -> list:
    result = await db.execute(
        select(Review.rating, func.count()).group_by(Review.rating).order_by(Review.rating)
    )
    return [{"rating": r[0], "count": r[1]} for r in result.all()]


async def get_user_detail(db: AsyncSession, user_id) -> dict | None:
    from app.auth.models import Follow

    user = await db.get(User, user_id)
    if not user:
        return None

    orders_result = await db.execute(
        select(Order, Shop.name.label("shop_name"))
        .join(Shop, Shop.id == Order.shop_id)
        .where(Order.customer_id == user_id)
        .order_by(Order.created_at.desc()).limit(20)
    )
    user_orders = [
        {"id": str(o.id), "order_number": o.order_number, "shop": sn,
         "total": float(o.total), "status": o.status, "date": str(o.created_at)[:10]}
        for o, sn in orders_result.all()
    ]

    try:
        reviews_result = await db.execute(
            select(Review, Shop.name.label("shop_name"))
            .join(Shop, Shop.id == Review.shop_id)
            .where(Review.user_id == user_id)
            .order_by(Review.created_at.desc()).limit(20)
        )
        user_reviews = [
            {"shop": sn, "rating": r.rating, "comment": r.comment, "date": str(r.created_at)[:10]}
            for r, sn in reviews_result.all()
        ]
    except Exception:
        user_reviews = []

    wishlist_count = (await db.execute(select(func.count()).select_from(Wishlist).where(Wishlist.user_id == user_id))).scalar() or 0
    coins = float((await db.execute(select(func.sum(ShopCoinsLedger.amount)).where(ShopCoinsLedger.user_id == user_id))).scalar() or 0)
    haggle_count = (await db.execute(select(func.count()).select_from(HaggleSession).where(HaggleSession.customer_id == user_id))).scalar() or 0
    reservation_count = (await db.execute(select(func.count()).select_from(Reservation).where(Reservation.customer_id == user_id))).scalar() or 0
    follows = (await db.execute(select(func.count()).select_from(Follow).where(Follow.user_id == user_id))).scalar() or 0

    return {
        "id": str(user.id), "name": user.name, "phone": user.phone, "email": user.email,
        "roles": user.roles, "active_role": user.active_role,
        "interests": user.interests, "referral_code": user.referral_code,
        "created_at": str(user.created_at),
        "stats": {
            "orders": len(user_orders), "reviews": len(user_reviews),
            "wishlists": wishlist_count, "coins": coins,
            "haggles": haggle_count, "reservations": reservation_count,
            "followed_shops": follows,
        },
        "recent_orders": user_orders,
        "recent_reviews": user_reviews,
    }


async def get_shop_detail_admin(db: AsyncSession, shop_id) -> dict | None:
    from app.auth.models import Follow

    shop = await db.get(Shop, shop_id)
    if not shop:
        return None

    owner = await db.get(User, shop.owner_id) if shop.owner_id else None

    products_result = await db.execute(
        select(Product).where(Product.shop_id == shop_id)
        .order_by(Product.view_count.desc()).limit(50)
    )
    shop_products = [
        {"id": str(p.id), "name": p.name, "price": float(p.price),
         "category": p.category, "views": p.view_count or 0,
         "wishlisted": p.wishlist_count or 0, "inquiries": p.inquiry_count or 0,
         "available": p.is_available, "ai_generated": p.ai_generated or False,
         "image": p.images[0] if p.images else None,
         "created_at": str(p.created_at)[:10]}
        for p in products_result.scalars().all()
    ]

    order_count = (await db.execute(select(func.count()).select_from(Order).where(Order.shop_id == shop_id))).scalar() or 0
    revenue = float((await db.execute(select(func.sum(Order.total)).where(Order.shop_id == shop_id, Order.status != "cancelled"))).scalar() or 0)

    recent_orders_result = await db.execute(
        select(Order, User.name.label("customer_name"))
        .join(User, User.id == Order.customer_id)
        .where(Order.shop_id == shop_id)
        .order_by(Order.created_at.desc()).limit(20)
    )
    orders_list = [
        {"id": str(o.id), "order_number": o.order_number, "customer": cn,
         "total": float(o.total), "status": o.status, "date": str(o.created_at)[:10]}
        for o, cn in recent_orders_result.all()
    ]

    try:
        reviews_result = await db.execute(
            select(Review, User.name.label("reviewer"))
            .join(User, User.id == Review.user_id)
            .where(Review.shop_id == shop_id)
            .order_by(Review.created_at.desc()).limit(20)
        )
        reviews_list = [
            {"reviewer": rn, "rating": r.rating, "comment": r.comment,
             "reply": r.shop_reply, "date": str(r.created_at)[:10]}
            for r, rn in reviews_result.all()
        ]
    except Exception:
        reviews_list = []

    deals_result = await db.execute(
        select(Deal).where(Deal.shop_id == shop_id).order_by(Deal.created_at.desc()).limit(10)
    )
    deals_list = [
        {"id": str(d.id), "title": d.title, "discount": d.discount_pct,
         "claims": d.current_claims or 0, "active": d.is_active, "expires": str(d.expires_at)[:10]}
        for d in deals_result.scalars().all()
    ]

    followers = (await db.execute(select(func.count()).select_from(Follow).where(Follow.shop_id == shop_id))).scalar() or 0

    return {
        "id": str(shop.id), "name": shop.name, "slug": shop.slug,
        "category": shop.category, "description": shop.description,
        "address": shop.address, "phone": shop.phone, "whatsapp": shop.whatsapp,
        "cover_image": shop.cover_image, "is_verified": shop.is_verified,
        "avg_rating": float(shop.avg_rating or 0), "total_reviews": shop.total_reviews or 0,
        "score": float(shop.score or 0),
        "created_at": str(shop.created_at),
        "owner": {"name": owner.name if owner else "Unknown", "phone": owner.phone if owner else ""},
        "stats": {
            "products": len(shop_products), "orders": order_count,
            "revenue": revenue, "followers": followers, "deals": len(deals_list),
        },
        "products": shop_products,
        "recent_orders": orders_list,
        "reviews": reviews_list,
        "deals": deals_list,
    }


async def get_product_detail_admin(db: AsyncSession, product_id) -> dict | None:
    from app.products.models import PriceHistory

    product = await db.get(Product, product_id)
    if not product:
        return None

    shop = await db.get(Shop, product.shop_id) if product.shop_id else None

    try:
        history_result = await db.execute(
            select(PriceHistory).where(PriceHistory.product_id == product_id)
            .order_by(PriceHistory.changed_at.desc()).limit(20)
        )
        price_history = [
            {"old": float(h.old_price), "new": float(h.new_price), "date": str(h.changed_at)[:10]}
            for h in history_result.scalars().all()
        ]
    except Exception:
        price_history = []

    wishlisted_by = (await db.execute(select(func.count()).select_from(Wishlist).where(Wishlist.product_id == product_id))).scalar() or 0

    return {
        "id": str(product.id), "name": product.name, "description": product.description,
        "price": float(product.price), "compare_price": float(product.compare_price or 0),
        "category": product.category, "subcategory": product.subcategory,
        "attributes": product.attributes, "tags": product.tags,
        "images": product.images or [], "is_available": product.is_available,
        "ai_generated": product.ai_generated or False,
        "views": product.view_count or 0, "wishlisted": wishlisted_by,
        "inquiries": product.inquiry_count or 0,
        "created_at": str(product.created_at),
        "shop": {"id": str(shop.id), "name": shop.name, "category": shop.category} if shop else None,
        "price_history": price_history,
    }


async def get_order_detail_admin(db: AsyncSession, order_id) -> dict | None:
    order = await db.get(Order, order_id)
    if not order:
        return None

    customer = await db.get(User, order.customer_id) if order.customer_id else None
    shop = await db.get(Shop, order.shop_id) if order.shop_id else None

    return {
        "id": str(order.id), "order_number": order.order_number,
        "customer": {"name": customer.name if customer else "", "phone": customer.phone if customer else ""},
        "shop": {"name": shop.name if shop else "", "id": str(order.shop_id)},
        "items": order.items or [],
        "subtotal": float(order.subtotal or 0),
        "delivery_fee": float(order.delivery_fee or 0),
        "discount": float(order.discount or 0),
        "total": float(order.total),
        "status": order.status,
        "delivery_type": order.delivery_type,
        "delivery_address": order.delivery_address,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "notes": order.notes,
        "created_at": str(order.created_at),
        "updated_at": str(order.updated_at),
    }
