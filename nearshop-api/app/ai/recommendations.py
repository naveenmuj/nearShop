from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only

from app.core.geo import within_radius
from app.products.models import Product
from app.shops.models import Shop
from app.ranking.service import (
    RankingContext,
    build_user_preference_profile,
    product_score_breakdown,
    resolve_ranking_profile_id,
    resolve_ranking_selection,
    rank_products,
    score_product,
    top_product_reason,
)


def _normalized_tags(product: Product) -> set[str]:
    return {
        tag.strip().lower()
        for tag in (product.tags or [])
        if isinstance(tag, str) and tag.strip()
    }


def _candidate_seed_score(product: Product, profile) -> float:
    category = (product.category or "").strip().lower()
    subcategory = (product.subcategory or "").strip().lower()
    tag_set = _normalized_tags(product)
    product_id = str(product.id)
    shop_id = str(product.shop_id)

    score = 0.0
    if category:
        score += profile.categories.get(category, 0) * 1.8
    if subcategory:
        score += profile.subcategories.get(subcategory, 0) * 2.4
    score += sum(profile.tags.get(tag, 0) for tag in tag_set) * 1.2
    score += sum(profile.recent_queries.get(tag, 0) for tag in tag_set) * 0.8

    if shop_id in profile.followed_shops:
        score += 5.0
    elif shop_id in profile.viewed_shops:
        score += 2.0

    if product_id in profile.viewed_products:
        score += 1.5
    if product_id in profile.ordered_products:
        score -= 10.0

    score += float(product.wishlist_count or 0) * 0.15
    score += float(product.view_count or 0) * 0.03
    score += float(product.inquiry_count or 0) * 0.25
    return score


def _select_candidate_pool(candidates: list[Product], profile, limit: int) -> list[Product]:
    ranked_candidates: list[tuple[float, Product]] = []
    fallback_candidates: list[tuple[float, Product]] = []

    for product in candidates:
        seed_score = _candidate_seed_score(product, profile)
        if str(product.id) not in profile.ordered_products:
            ranked_candidates.append((seed_score, product))
        fallback_candidates.append((seed_score, product))

    ranked_candidates.sort(
        key=lambda item: (
            item[0],
            float(item[1].wishlist_count or 0),
            float(item[1].view_count or 0),
            float(item[1].inquiry_count or 0),
        ),
        reverse=True,
    )
    fallback_candidates.sort(
        key=lambda item: (
            item[0],
            float(item[1].wishlist_count or 0),
            float(item[1].view_count or 0),
            float(item[1].inquiry_count or 0),
        ),
        reverse=True,
    )

    target_size = max(limit * 6, 60)
    selected = [product for _, product in ranked_candidates[:target_size]]
    if len(selected) >= max(limit * 2, 20):
        return selected
    return [product for _, product in fallback_candidates[:target_size]]


def _diversify_ranked_products(ranked: list[Product], profile, context: RankingContext, limit: int) -> list[Product]:
    if len(ranked) <= limit:
        return ranked[:limit]

    candidate_rows = []
    for product in ranked[: max(limit * 4, 40)]:
        candidate_rows.append(
            {
                "product": product,
                "score": score_product(product, getattr(product, "shop", None), profile, context),
                "shop_id": str(product.shop_id),
                "category": (product.category or "").strip().lower(),
                "subcategory": (product.subcategory or "").strip().lower(),
                "tags": _normalized_tags(product),
            }
        )

    selected: list[Product] = []
    shop_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    subcategory_counts: Counter[str] = Counter()
    selected_tag_sets: list[set[str]] = []

    while candidate_rows and len(selected) < limit:
        best_index = 0
        best_adjusted = None

        for index, candidate in enumerate(candidate_rows):
            adjusted = float(candidate["score"])
            product = candidate["product"]
            product_id = str(product.id)

            adjusted -= shop_counts[candidate["shop_id"]] * 4.5
            if candidate["category"]:
                adjusted -= category_counts[candidate["category"]] * 2.0
            if candidate["subcategory"]:
                adjusted -= subcategory_counts[candidate["subcategory"]] * 2.8
            for existing_tags in selected_tag_sets:
                adjusted -= len(candidate["tags"].intersection(existing_tags)) * 0.9

            if product_id in profile.viewed_products:
                adjusted -= 1.0
            if product_id in profile.ordered_products:
                adjusted -= 8.0

            if best_adjusted is None or adjusted > best_adjusted:
                best_adjusted = adjusted
                best_index = index

        chosen = candidate_rows.pop(best_index)
        selected.append(chosen["product"])
        shop_counts[chosen["shop_id"]] += 1
        if chosen["category"]:
            category_counts[chosen["category"]] += 1
        if chosen["subcategory"]:
            subcategory_counts[chosen["subcategory"]] += 1
        selected_tag_sets.append(chosen["tags"])

    return selected


async def get_recommendations(
    db: AsyncSession,
    user_id,
    lat: float,
    lng: float,
    limit: int = 20,
    profile_id: str | None = None,
    profile=None,
) -> list:
    """Rank nearby products using a shared personalization scorer."""
    radius_km = 5.0

    stmt = (
        select(Product)
        .join(Shop, Shop.id == Product.shop_id)
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
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
    )

    result = await db.execute(stmt.limit(max(limit * 10, 120)))
    candidates = list(result.scalars().all())
    if not candidates:
        return []

    if profile is None:
        profile = await build_user_preference_profile(db, user_id)
    selection = resolve_ranking_selection("ai_recommendations", str(user_id) if user_id else None, profile_id)
    resolved_profile_id = selection["profile_id"]
    context = RankingContext(
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        surface="ai_recommendations",
        profile_id=resolved_profile_id,
        user_id=str(user_id) if user_id else None,
    )
    candidate_pool = _select_candidate_pool(candidates, profile, limit)
    ranked = rank_products(
        candidate_pool,
        profile,
        context,
    )
    if not ranked:
        ranked = rank_products(
            candidates,
            profile,
            context,
        )
    return _diversify_ranked_products(ranked, profile, context, limit)


async def get_recommendation_payloads(
    db: AsyncSession, user_id, lat: float, lng: float, limit: int = 20, profile_id: str | None = None
) -> list[dict]:
    selection = resolve_ranking_selection("ai_recommendations", str(user_id) if user_id else None, profile_id)
    context = RankingContext(
        lat=lat,
        lng=lng,
        radius_km=5.0,
        surface="ai_recommendations",
        profile_id=selection["profile_id"],
        user_id=str(user_id) if user_id else None,
    )
    resolved_profile_id = resolve_ranking_profile_id(context.surface, context.profile_id)
    profile = await build_user_preference_profile(db, user_id)
    products = await get_recommendations(db, user_id, lat, lng, limit, profile_id=profile_id, profile=profile)
    payload: list[dict] = []
    for product in products:
        shop = getattr(product, "shop", None)
        payload.append(
            {
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price or 0),
                "images": product.images or [],
                "category": product.category,
                "subcategory": product.subcategory,
                "tags": product.tags or [],
                "shop_id": str(product.shop_id),
                "reason": top_product_reason(product, shop, profile, context),
                "ranking_profile": resolved_profile_id,
                "ranking_experiment": selection["experiment_id"],
                "ranking_variant": selection["variant_id"],
                "ranking_score": score_product(product, shop, profile, context),
                "ranking_breakdown": product_score_breakdown(product, shop, profile, context),
            }
        )
    return payload
