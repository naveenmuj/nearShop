from collections import Counter, defaultdict

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.auth.models import User, UserEvent
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop


async def get_recommendations(
    db: AsyncSession, user_id, lat: float, lng: float, limit: int = 20
) -> list:
    """Rank nearby products using interests, recent interactions, and popularity."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    radius_km = 5.0

    preferred_categories = Counter(user.interests or []) if user else Counter()
    preferred_subcategories: Counter[str] = Counter()
    preferred_tags: Counter[str] = Counter()
    interacted_product_ids: set[str] = set()

    recent_events = (
        await db.execute(
            select(UserEvent.entity_id)
            .where(
                UserEvent.user_id == user_id,
                UserEvent.entity_type == "product",
                UserEvent.event_type.in_(["product_view", "wishlist_add", "add_to_cart"]),
            )
            .order_by(desc(UserEvent.created_at))
            .limit(50)
        )
    ).scalars().all()
    for entity_id in recent_events:
        if entity_id:
            interacted_product_ids.add(str(entity_id))

    # Pull metadata for recent products so recommendations follow actual browse intent.
    if interacted_product_ids:
        viewed_products = (
            await db.execute(
                select(Product.category, Product.subcategory, Product.tags)
                .where(Product.id.in_(list(interacted_product_ids)))
            )
        ).all()
        for row in viewed_products:
            if row.category:
                preferred_categories[row.category] += 4
            if row.subcategory:
                preferred_subcategories[row.subcategory] += 5
            for tag in row.tags or []:
                if isinstance(tag, str) and tag.strip():
                    preferred_tags[tag.strip().lower()] += 2

    # Purchases are a stronger signal than views and help when the user has sparse events.
    order_rows = (
        await db.execute(
            select(Order.items)
            .where(
                Order.customer_id == user_id,
                Order.status.not_in(["cancelled", "rejected"]),
            )
            .order_by(desc(Order.created_at))
            .limit(20)
        )
    ).scalars().all()
    ordered_product_ids: set[str] = set()
    for items in order_rows:
        if not isinstance(items, list):
            continue
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            if not product_id:
                continue
            ordered_product_ids.add(str(product_id))

    if ordered_product_ids:
        ordered_products = (
            await db.execute(
                select(Product.category, Product.subcategory, Product.tags)
                .where(Product.id.in_(list(ordered_product_ids)))
            )
        ).all()
        for row in ordered_products:
            if row.category:
                preferred_categories[row.category] += 6
            if row.subcategory:
                preferred_subcategories[row.subcategory] += 8
            for tag in row.tags or []:
                if isinstance(tag, str) and tag.strip():
                    preferred_tags[tag.strip().lower()] += 3

    stmt = (
        select(Product)
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
    )

    if preferred_categories:
        stmt = stmt.where(Product.category.in_(list(preferred_categories.keys())))

    result = await db.execute(stmt.limit(max(limit * 6, 60)))
    candidates = list(result.scalars().all())
    if not candidates:
        return []

    scored: list[tuple[float, Product]] = []
    for product in candidates:
        product_id = str(product.id)
        if product_id in ordered_product_ids:
            continue

        score = 0.0
        if product.category:
            score += preferred_categories.get(product.category, 0) * 2.5
        if product.subcategory:
            score += preferred_subcategories.get(product.subcategory, 0) * 3.5

        tag_overlap = 0
        for tag in product.tags or []:
            if isinstance(tag, str):
                tag_overlap += preferred_tags.get(tag.strip().lower(), 0)
        score += tag_overlap * 1.5

        # Popular products still matter, but behavior match should dominate.
        score += float(product.view_count or 0) * 0.15
        score += float(product.wishlist_count or 0) * 0.8
        score += float(product.inquiry_count or 0) * 1.2
        if product.is_featured:
            score += 1.0
        if product_id in interacted_product_ids:
            score += 4.0

        scored.append((score, product))

    if not scored:
        fallback = sorted(
            candidates,
            key=lambda product: (
                float(product.wishlist_count or 0) * 2 + float(product.view_count or 0)
            ),
            reverse=True,
        )
        return fallback[:limit]

    scored.sort(
        key=lambda item: (
            item[0],
            float(item[1].wishlist_count or 0),
            float(item[1].view_count or 0),
        ),
        reverse=True,
    )
    return [product for _, product in scored[:limit]]
