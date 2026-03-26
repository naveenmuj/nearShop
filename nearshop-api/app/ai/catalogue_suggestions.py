"""Feature 10: Smart Catalogue Completion Suggestions.

Market basket analysis on Order.items JSONB data.
Identifies product categories frequently bought together in the local area,
then compares with the shop's existing catalog to find gaps.
"""
import logging
from collections import defaultdict, Counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop
from app.core.geo import within_radius

logger = logging.getLogger(__name__)

# Minimum support count for a category pair to be considered
_MIN_SUPPORT = 2


async def get_catalogue_suggestions(
    db: AsyncSession,
    shop_id: UUID,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
) -> dict:
    """
    Analyse orders in the area to find category combinations that sell together.
    Compare with the shop's catalog to identify missing high-opportunity categories.

    Returns:
        {
          "existing_categories": [...],
          "missing_opportunities": [
            {
              "category": str,
              "co_occurs_with": str,
              "support": int,       # how often this pair appears in orders
              "confidence": float,  # % of orders with co_occurs_with that also had category
              "message": str,
            }
          ],
          "top_local_categories": [...],   # most popular categories in local orders
        }
    """

    # ── Step 1: Get shop's existing product categories ──────────────────────
    shop_prods_stmt = select(Product.category).where(
        Product.shop_id == shop_id,
        Product.category.isnot(None),
    )
    shop_categories = set(
        (c or "").strip().lower()
        for c in (await db.execute(shop_prods_stmt)).scalars().all()
        if c
    )

    # ── Step 2: Fetch nearby orders ─────────────────────────────────────────
    nearby_shops_stmt = (
        select(Shop.id)
        .where(
            Shop.is_active == True,  # noqa: E712
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
        )
        .limit(200)
    )
    nearby_shop_ids = (await db.execute(nearby_shops_stmt)).scalars().all()

    if not nearby_shop_ids:
        return _empty_result(list(shop_categories))

    orders_stmt = (
        select(Order.items)
        .where(
            Order.shop_id.in_(nearby_shop_ids),
            Order.status.not_in(["cancelled", "rejected"]),
            Order.items.isnot(None),
        )
        .limit(5000)
    )
    order_rows = (await db.execute(orders_stmt)).scalars().all()

    if not order_rows:
        return _empty_result(list(shop_categories))

    # ── Step 3: Extract category sets per order ─────────────────────────────
    # We need to look up product categories from product IDs in order items
    all_product_ids = set()
    for items in order_rows:
        if isinstance(items, list):
            for item in items:
                pid = item.get("product_id") or item.get("id")
                if pid:
                    all_product_ids.add(str(pid))

    # Fetch product categories
    if not all_product_ids:
        return _empty_result(list(shop_categories))

    prod_cats_stmt = select(Product.id, Product.category).where(
        Product.id.in_(list(all_product_ids))
    )
    prod_cat_rows = (await db.execute(prod_cats_stmt)).fetchall()
    prod_cat_map = {
        str(r.id): (r.category or "").strip().lower()
        for r in prod_cat_rows
        if r.category
    }

    # Build category sets per order
    order_category_sets = []
    local_category_counter: Counter = Counter()

    for items in order_rows:
        if not isinstance(items, list):
            continue
        cats = set()
        for item in items:
            pid = item.get("product_id") or item.get("id")
            if pid and str(pid) in prod_cat_map:
                cat = prod_cat_map[str(pid)]
                cats.add(cat)
                local_category_counter[cat] += 1
        if cats:
            order_category_sets.append(cats)

    # ── Step 4: Pairwise co-occurrence (market basket) ───────────────────────
    pair_support: dict[tuple, int] = defaultdict(int)  # (A, B) → count of orders with both
    category_count: Counter = Counter()  # single category order count

    for cats in order_category_sets:
        cats_list = sorted(cats)
        for cat in cats_list:
            category_count[cat] += 1
        for i, a in enumerate(cats_list):
            for b in cats_list[i + 1:]:
                pair_support[(a, b)] += 1

    # ── Step 5: Find missing categories the shop should add ─────────────────
    opportunities = []

    for (cat_a, cat_b), support in pair_support.items():
        if support < _MIN_SUPPORT:
            continue

        # Check if shop is missing either category
        for missing, present in [(cat_a, cat_b), (cat_b, cat_a)]:
            if missing in shop_categories:
                continue  # shop already has this
            if not present:
                continue

            # Confidence: % of orders with 'present' that also had 'missing'
            present_count = category_count.get(present, 1)
            confidence = support / present_count if present_count > 0 else 0

            if confidence < 0.1:  # skip very low confidence
                continue

            opportunities.append(
                {
                    "category": missing.title(),
                    "co_occurs_with": present.title(),
                    "support": support,
                    "confidence": round(confidence * 100, 1),
                    "message": (
                        f"Customers buying {present.title()} from nearby shops also buy "
                        f"{missing.title()} {confidence*100:.0f}% of the time. "
                        f"Adding {missing.title()} could increase basket size."
                    ),
                }
            )

    # Deduplicate by missing category (keep highest confidence)
    seen_cats: dict[str, dict] = {}
    for opp in opportunities:
        cat = opp["category"]
        if cat not in seen_cats or opp["confidence"] > seen_cats[cat]["confidence"]:
            seen_cats[cat] = opp

    final_opportunities = sorted(
        seen_cats.values(), key=lambda x: (-x["confidence"], -x["support"])
    )[:10]

    top_local_cats = [
        {"category": cat.title(), "order_count": count}
        for cat, count in local_category_counter.most_common(10)
    ]

    return {
        "existing_categories": [c.title() for c in sorted(shop_categories)],
        "missing_opportunities": final_opportunities,
        "top_local_categories": top_local_cats,
        "orders_analysed": len(order_category_sets),
    }


def _empty_result(existing: list) -> dict:
    return {
        "existing_categories": [c.title() for c in existing],
        "missing_opportunities": [],
        "top_local_categories": [],
        "orders_analysed": 0,
    }
