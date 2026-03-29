from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_, or_, func, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only

import math

from app.products.models import Product
from app.ranking.service import (
    RankingContext,
    build_user_preference_profile,
    product_score_breakdown,
    rank_products,
    rank_shops,
    resolve_ranking_profile_id,
    resolve_ranking_selection,
    score_product,
    score_shop,
    top_product_reason,
    top_shop_reason,
)
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


def _query_terms(query: str) -> list[str]:
    terms: list[str] = []
    for raw in (query or "").replace("/", " ").replace("-", " ").replace(",", " ").split():
        token = raw.strip().lower()
        if token and token not in terms:
            terms.append(token)
    return terms


INTENT_TERM_EXPANSIONS = {
    "audio": {"earbuds", "speaker", "headphones", "bluetooth", "headset", "mic"},
    "earbuds": {"audio", "headphones", "bluetooth"},
    "speaker": {"audio", "bluetooth"},
    "headphones": {"audio", "bluetooth", "earbuds"},
    "headset": {"audio", "headphones", "bluetooth"},
    "earphone": {"audio", "earbuds", "headphones"},
    "bluetooth": {"audio", "speaker", "earbuds", "headphones"},
    "streaming": {"webcam", "microphone", "ring", "light", "usb"},
    "webcam": {"streaming", "usb"},
    "microphone": {"streaming", "audio", "mic", "usb"},
    "gaming": {"keyboard", "mouse", "headset", "mousepad"},
    "keyboard": {"gaming"},
    "mouse": {"gaming", "mousepad"},
    "rice": {"basmati", "sona", "masoori", "grocery", "grain", "staples"},
    "atta": {"flour", "grocery", "staples"},
    "dal": {"lentils", "grocery", "staples", "pulses"},
    "oil": {"grocery", "staples", "cooking"},
    "grocery": {"rice", "atta", "dal", "oil", "staples"},
}


def _expanded_query_terms(query: str) -> list[str]:
    expanded: list[str] = []
    for term in _query_terms(query):
        if term not in expanded:
            expanded.append(term)
        for synonym in sorted(INTENT_TERM_EXPANSIONS.get(term, set())):
            if synonym not in expanded:
                expanded.append(synonym)
    return expanded


def _phrase_and_token_patterns(query: str) -> list[str]:
    patterns: list[str] = []
    phrase = (query or "").strip().lower()
    if phrase:
        patterns.append(f"%{phrase}%")
    for term in _expanded_query_terms(query):
        pattern = f"%{term}%"
        if pattern not in patterns:
            patterns.append(pattern)
    return patterns


async def search_unified(
    db: AsyncSession,
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    product_limit: int = 10,
    shop_limit: int = 8,
    user_id: UUID | None = None,
    profile_id: str | None = None,
    include_debug: bool = False,
) -> dict:
    """
    Unified search across products and shops.

    Returns: {products: [...], shops: [...]} with formatted responses.
    """
    try:
        if not query.strip():
            return {"products": [], "shops": []}

        profile = await build_user_preference_profile(db, user_id)
        selection = resolve_ranking_selection("unified_search", str(user_id) if user_id else None, profile_id)
        ranking_context = RankingContext(
            lat=lat,
            lng=lng,
            query=query,
            radius_km=5.0,
            surface="unified_search",
            profile_id=selection["profile_id"],
            user_id=str(user_id) if user_id else None,
            expanded_query_terms=set(_expanded_query_terms(query)),
        )
        resolved_profile_id = resolve_ranking_profile_id(ranking_context.surface, ranking_context.profile_id)

        ts_query = func.websearch_to_tsquery("english", query)
        ts_vector = func.to_tsvector(
            "english",
            func.coalesce(Product.name, "")
            + " "
            + func.coalesce(Product.description, "")
            + " "
            + func.coalesce(Product.category, ""),
        )
        product_tag_text = func.coalesce(func.array_to_string(Product.tags, " "), "")
        like_patterns = _phrase_and_token_patterns(query)
        product_match_clauses = [ts_vector.op("@@")(ts_query)]
        for pattern in like_patterns:
            product_match_clauses.extend(
                [
                    Product.name.ilike(pattern),
                    Product.category.ilike(pattern),
                    Product.subcategory.ilike(pattern),
                    Product.description.ilike(pattern),
                    product_tag_text.ilike(pattern),
                ]
            )

        product_stmt = (
            select(Product)
            .join(Shop, Product.shop_id == Shop.id)
            .options(
                joinedload(Product.shop).load_only(
                    Shop.id,
                    Shop.name,
                    Shop.slug,
                    Shop.logo_url,
                    Shop.latitude,
                    Shop.longitude,
                    Shop.avg_rating,
                    Shop.score,
                )
            )
            .where(
                and_(
                    Product.is_available == True,
                    Shop.is_active == True,
                    or_(*product_match_clauses),
                )
            )
        )

        if lat is not None and lng is not None:
            product_stmt = product_stmt.where(
                haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude) <= 8.0
            )

        product_result = await db.execute(product_stmt.limit(max(product_limit * 8, 80)))
        product_candidates = list(product_result.unique().scalars().all())
        ranked_products = rank_products(product_candidates, profile, ranking_context)[:product_limit]

        products = []
        for product in ranked_products:
            shop = getattr(product, "shop", None)
            item = {
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price or 0),
                "image": product.images[0] if product.images else None,
                "category": product.category,
                "subcategory": product.subcategory,
                "shop_id": str(product.shop_id),
                "reason": top_product_reason(product, shop, profile, ranking_context),
                "ranking_profile": resolved_profile_id,
                "ranking_experiment": selection["experiment_id"],
                "ranking_variant": selection["variant_id"],
            }
            if include_debug:
                item["ranking_score"] = score_product(product, shop, profile, ranking_context)
                item["ranking_breakdown"] = product_score_breakdown(product, shop, profile, ranking_context)
            products.append(item)

        shop_ts_query = func.websearch_to_tsquery("english", query)
        shop_ts_vector = func.to_tsvector(
            "english",
            func.coalesce(Shop.name, "")
            + " "
            + func.coalesce(Shop.description, "")
            + " "
            + func.coalesce(Shop.category, ""),
        )
        shop_subcategory_text = func.coalesce(func.array_to_string(Shop.subcategories, " "), "")
        shop_match_clauses = [shop_ts_vector.op("@@")(shop_ts_query)]
        product_exists_clauses = []
        for pattern in like_patterns:
            shop_match_clauses.extend(
                [
                    Shop.name.ilike(pattern),
                    Shop.category.ilike(pattern),
                    Shop.description.ilike(pattern),
                    shop_subcategory_text.ilike(pattern),
                ]
            )
            product_exists_clauses.append(
                exists(
                    select(Product.id).where(
                        Product.shop_id == Shop.id,
                        Product.is_available == True,
                        or_(
                            Product.name.ilike(pattern),
                            Product.category.ilike(pattern),
                            Product.subcategory.ilike(pattern),
                            Product.description.ilike(pattern),
                            product_tag_text.ilike(pattern),
                        ),
                    )
                )
            )
        shop_recall_clause = or_(*(shop_match_clauses + product_exists_clauses))

        shop_stmt = select(Shop).options(
            load_only(
                Shop.id,
                Shop.name,
                Shop.category,
                Shop.cover_image,
                Shop.logo_url,
                Shop.avg_rating,
                Shop.total_reviews,
                Shop.latitude,
                Shop.longitude,
                Shop.delivery_options,
                Shop.delivery_fee,
                Shop.min_order,
                Shop.description,
                Shop.score,
                Shop.subcategories,
            )
        ).where(
            and_(
                Shop.is_active == True,
                shop_recall_clause,
            )
        )

        if lat is not None and lng is not None:
            shop_stmt = shop_stmt.where(
                haversine_distance_km(lat, lng, Shop.latitude, Shop.longitude) <= 8.0
            )

        shop_result = await db.execute(shop_stmt.limit(max(shop_limit * 8, 50)))
        shop_candidates = list(shop_result.scalars().all())
        ranked_shops = rank_shops(shop_candidates, profile, ranking_context)[:shop_limit]

        shops = []
        for shop in ranked_shops:
            distance = None
            if lat is not None and lng is not None:
                distance = _py_haversine(lat, lng, float(shop.latitude), float(shop.longitude))

            item = {
                "id": str(shop.id),
                "name": shop.name,
                "category": shop.category,
                "cover_image": shop.cover_image,
                "logo_url": shop.logo_url,
                "rating": float(shop.avg_rating) if shop.avg_rating else 0,
                "total_reviews": shop.total_reviews or 0,
                "distance": distance,
                "delivery_options": shop.delivery_options or [],
                "delivery_fee": float(shop.delivery_fee) if shop.delivery_fee else 0,
                "min_order": float(shop.min_order) if shop.min_order else None,
                "reason": top_shop_reason(shop, profile, ranking_context),
                "ranking_profile": resolved_profile_id,
                "ranking_experiment": selection["experiment_id"],
                "ranking_variant": selection["variant_id"],
            }
            if include_debug:
                item["ranking_score"] = score_shop(shop, profile, ranking_context)
            shops.append(item)

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
