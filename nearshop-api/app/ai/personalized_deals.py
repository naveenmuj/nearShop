"""Personalized deal feed powered by shared ranking signals."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.deals.models import Deal
from app.products.models import Product
from app.ranking.service import RankingContext, build_user_preference_profile, rank_deals, score_deal
from app.shops.models import Shop


async def get_personalized_deals(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 20,
) -> list[dict]:
    """Return active nearby deals ranked with shared personalization signals."""
    now = datetime.now(timezone.utc)
    profile = await build_user_preference_profile(db, user_id)
    context = RankingContext(lat=lat, lng=lng, radius_km=radius_km, surface="personalized_deals")

    stmt = (
        select(Deal, Shop, Product)
        .join(Shop, Shop.id == Deal.shop_id)
        .outerjoin(Product, Product.id == Deal.product_id)
        .where(
            Deal.is_active == True,  # noqa: E712
            Deal.expires_at > now,
            Shop.is_active == True,  # noqa: E712
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
        )
        .order_by(desc(Deal.created_at))
        .limit(200)
    )
    rows = (await db.execute(stmt)).fetchall()
    if not rows:
        return []

    ranked_rows = rank_deals(rows, profile, context)
    scored = []
    for deal, shop, product in ranked_rows[:limit]:
        score = score_deal(deal, shop, product, profile, context)
        scored.append(
            {
                "id": str(deal.id),
                "title": deal.title,
                "description": deal.description,
                "discount_pct": deal.discount_pct or 0,
                "discount_amount": float(deal.discount_amount or 0),
                "expires_at": deal.expires_at.isoformat() if deal.expires_at else None,
                "shop_id": str(deal.shop_id),
                "shop_name": shop.name,
                "shop_rating": round(float(shop.avg_rating or 3.0), 1),
                "product_id": str(deal.product_id) if deal.product_id else None,
                "current_claims": deal.current_claims,
                "max_claims": deal.max_claims,
                "personalisation_score": round(score, 1),
                "match_reason": _match_reason(
                    score,
                    str(deal.shop_id) in profile.followed_shops or str(deal.shop_id) in profile.viewed_shops,
                ),
            }
        )

    return scored


def _match_reason(score: float, has_shop_affinity: bool) -> str:
    if has_shop_affinity:
        return "From a shop you follow or visit"
    if score >= 50:
        return "Strong match for your interests"
    if score >= 30:
        return "High-value nearby deal"
    return "Available nearby"
