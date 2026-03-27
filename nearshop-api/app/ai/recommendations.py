from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager

from app.core.geo import within_radius
from app.products.models import Product
from app.shops.models import Shop
from app.ranking.service import (
    RankingContext,
    build_user_preference_profile,
    product_score_breakdown,
    rank_products,
    score_product,
    top_product_reason,
)


async def get_recommendations(
    db: AsyncSession, user_id, lat: float, lng: float, limit: int = 20
) -> list:
    """Rank nearby products using a shared personalization scorer."""
    radius_km = 5.0

    stmt = (
        select(Product)
        .join(Shop, Shop.id == Product.shop_id)
        .options(contains_eager(Product.shop))
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
    )

    result = await db.execute(stmt.limit(max(limit * 10, 120)))
    candidates = list(result.scalars().all())
    if not candidates:
        return []

    profile = await build_user_preference_profile(db, user_id)
    ranked = rank_products(
        [
            product
            for product in candidates
            if str(product.id) not in profile.ordered_products
        ],
        profile,
        RankingContext(lat=lat, lng=lng, radius_km=radius_km, surface="ai_recommendations"),
    )
    if not ranked:
        ranked = rank_products(
            candidates,
            profile,
            RankingContext(lat=lat, lng=lng, radius_km=radius_km, surface="ai_recommendations"),
        )
    return ranked[:limit]


async def get_recommendation_payloads(
    db: AsyncSession, user_id, lat: float, lng: float, limit: int = 20
) -> list[dict]:
    context = RankingContext(lat=lat, lng=lng, radius_km=5.0, surface="ai_recommendations")
    profile = await build_user_preference_profile(db, user_id)
    products = await get_recommendations(db, user_id, lat, lng, limit)
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
                "ranking_score": score_product(product, shop, profile, context),
                "ranking_breakdown": product_score_breakdown(product, shop, profile, context),
            }
        )
    return payload
