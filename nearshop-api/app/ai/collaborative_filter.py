"""Feature 1: Collaborative filtering with similarity-aware fallback."""
from collections import Counter, defaultdict
from uuid import UUID

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserEvent
from app.core.geo import within_radius
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop


def _normalized_tags(product: Product) -> set[str]:
    return {
        tag.strip().lower()
        for tag in (product.tags or [])
        if isinstance(tag, str) and tag.strip()
    }


async def get_cf_recommendations(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 20,
) -> list[dict]:
    """
    Recommend nearby products using:
    1. co-purchase signal from nearby orders
    2. similarity to the user's viewed/wishlisted/purchased products
    3. local popularity fallback when collaborative signal is sparse
    """

    event_rows = (
        await db.execute(
            select(UserEvent.entity_id, UserEvent.event_type)
            .where(
                UserEvent.user_id == user_id,
                UserEvent.entity_type == "product",
                UserEvent.event_type.in_(["product_view", "wishlist_add", "add_to_cart"]),
            )
            .order_by(desc(UserEvent.created_at))
            .limit(75)
        )
    ).all()

    interacted_ids: set[str] = set()
    strong_interest_ids: set[str] = set()
    for row in event_rows:
        if not row.entity_id:
            continue
        product_id = str(row.entity_id)
        interacted_ids.add(product_id)
        if row.event_type in {"wishlist_add", "add_to_cart"}:
            strong_interest_ids.add(product_id)

    order_rows = (
        await db.execute(
            select(Order.items)
            .where(
                Order.customer_id == user_id,
                Order.status.not_in(["cancelled", "rejected"]),
            )
            .order_by(desc(Order.created_at))
            .limit(30)
        )
    ).scalars().all()

    purchased_ids: set[str] = set()
    for items in order_rows:
        if not isinstance(items, list):
            continue
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            if product_id:
                purchased_ids.add(str(product_id))

    interacted_ids.update(purchased_ids)
    strong_interest_ids.update(purchased_ids)

    nearby_shop_ids = (
        await db.execute(
            select(Shop.id)
            .where(
                Shop.is_active == True,  # noqa: E712
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
            .limit(200)
        )
    ).scalars().all()

    if not nearby_shop_ids:
        return []

    co_occur: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    local_popularity: Counter[str] = Counter()

    nearby_orders = (
        await db.execute(
            select(Order.items)
            .where(
                Order.shop_id.in_(nearby_shop_ids),
                Order.status.not_in(["cancelled", "rejected"]),
                Order.items.isnot(None),
            )
            .limit(5000)
        )
    ).scalars().all()

    for items in nearby_orders:
        if not isinstance(items, list):
            continue
        item_ids: list[str] = []
        for item in items:
            product_id = item.get("product_id") or item.get("id")
            if not product_id:
                continue
            product_id = str(product_id)
            item_ids.append(product_id)
            local_popularity[product_id] += 1
        for index, left_id in enumerate(item_ids):
            for right_id in item_ids[index + 1:]:
                co_occur[left_id][right_id] += 1
                co_occur[right_id][left_id] += 1

    reference_ids = list(interacted_ids or strong_interest_ids)
    reference_products = {}
    if reference_ids:
        reference_rows = (
            await db.execute(
                select(Product.id, Product.category, Product.subcategory, Product.tags)
                .where(Product.id.in_(reference_ids))
            )
        ).all()
        reference_products = {
            str(row.id): {
                "category": row.category,
                "subcategory": row.subcategory,
                "tags": {
                    tag.strip().lower()
                    for tag in (row.tags or [])
                    if isinstance(tag, str) and tag.strip()
                },
            }
            for row in reference_rows
        }

    target_categories: Counter[str] = Counter()
    target_subcategories: Counter[str] = Counter()
    target_tags: Counter[str] = Counter()
    for product_id, meta in reference_products.items():
        weight = 3 if product_id in strong_interest_ids else 1
        if meta["category"]:
            target_categories[meta["category"]] += weight
        if meta["subcategory"]:
            target_subcategories[meta["subcategory"]] += weight * 2
        for tag in meta["tags"]:
            target_tags[tag] += weight

    candidate_scores: dict[str, float] = defaultdict(float)
    candidate_reasons: dict[str, str] = {}

    for seed_id in interacted_ids:
        for related_id, count in co_occur.get(seed_id, {}).items():
            if related_id in purchased_ids:
                continue
            base = float(count)
            if seed_id in strong_interest_ids:
                base *= 1.5
            candidate_scores[related_id] += base
            candidate_reasons[related_id] = "People near you also bought this"

    nearby_products = (
        await db.execute(
            select(Product, Shop.name.label("shop_name"))
            .join(Shop, Shop.id == Product.shop_id)
            .where(
                Product.shop_id.in_(nearby_shop_ids),
                Product.is_available == True,  # noqa: E712
                Shop.is_active == True,  # noqa: E712
            )
            .limit(limit * 12)
        )
    ).fetchall()

    product_rows_by_id = {}
    for row in nearby_products:
        product = row.Product
        product_id = str(product.id)
        product_rows_by_id[product_id] = row
        if product_id in purchased_ids:
            continue

        similarity = 0.0
        if product.category:
            similarity += target_categories.get(product.category, 0) * 1.25
        if product.subcategory:
            similarity += target_subcategories.get(product.subcategory, 0) * 2.0
        for tag in product.tags or []:
            if isinstance(tag, str):
                similarity += target_tags.get(tag.strip().lower(), 0) * 0.9

        popularity = float(local_popularity.get(product_id, 0)) * 0.6
        engagement = (
            float(product.view_count or 0) * 0.1
            + float(product.wishlist_count or 0) * 0.4
            + float(product.inquiry_count or 0) * 0.6
        )

        if similarity > 0:
            candidate_scores[product_id] += similarity + popularity + engagement
            candidate_reasons.setdefault(
                product_id, "Similar to products you viewed and saved nearby"
            )
        elif product_id not in candidate_scores and local_popularity.get(product_id, 0) > 0:
            candidate_scores[product_id] += popularity + engagement
            candidate_reasons.setdefault(
                product_id, "Popular with nearby shoppers"
            )

    if not candidate_scores:
        return []

    ranked_ids = sorted(
        candidate_scores,
        key=lambda product_id: (
            candidate_scores[product_id],
            local_popularity.get(product_id, 0),
        ),
        reverse=True,
    )[: limit * 3]

    ranked_candidates = []
    for product_id in ranked_ids:
        row = product_rows_by_id.get(product_id)
        if row is None:
            continue
        product = row.Product
        ranked_candidates.append(
            {
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price or 0),
                "compare_price": float(product.compare_price) if product.compare_price else None,
                "images": product.images or [],
                "category": product.category,
                "subcategory": product.subcategory,
                "tags": product.tags or [],
                "shop_id": str(product.shop_id),
                "shop_name": row.shop_name,
                "cf_score": round(candidate_scores.get(product_id, 0), 2),
                "reason": candidate_reasons.get(product_id, "Popular with nearby shoppers"),
                "_tag_set": _normalized_tags(product),
            }
        )

    # Greedy diversity pass: avoid over-concentrating on the same shop or same tag cluster.
    selected = []
    shop_counts: Counter[str] = Counter()
    selected_tag_sets: list[set[str]] = []

    while ranked_candidates and len(selected) < limit:
        best_index = 0
        best_adjusted = None

        for index, candidate in enumerate(ranked_candidates):
            adjusted = float(candidate["cf_score"])
            adjusted -= shop_counts[candidate["shop_id"]] * 5.0
            tag_set = candidate["_tag_set"]
            overlap_penalty = 0.0
            for existing_tags in selected_tag_sets:
                overlap_penalty += len(tag_set.intersection(existing_tags)) * 1.5
            adjusted -= overlap_penalty

            if best_adjusted is None or adjusted > best_adjusted:
                best_adjusted = adjusted
                best_index = index

        chosen = ranked_candidates.pop(best_index)
        shop_counts[chosen["shop_id"]] += 1
        selected_tag_sets.append(chosen["_tag_set"])
        chosen.pop("_tag_set", None)
        selected.append(chosen)

    return selected
