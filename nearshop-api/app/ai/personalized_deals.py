"""Feature 7: Personalised Deal Feed + Push Timing Optimiser.

Scores active deals for a specific user by combining:
  - Interest match (user.interests vs deal category/product category)
  - Discount depth (higher % discount = higher score)
  - Shop rating signal
  - Recency (newer deals score higher)
  - Engagement history (shops the user has visited)
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserEvent
from app.deals.models import Deal
from app.products.models import Product
from app.shops.models import Shop
from app.core.geo import within_radius


async def get_personalized_deals(
    db: AsyncSession,
    user_id: UUID,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 20,
) -> list[dict]:
    """
    Return active deals near the user, personalised by interest match.
    """
    now = datetime.now(timezone.utc)

    # Get user interests
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    interests = set(i.lower() for i in (user.interests or [])) if user else set()

    # Shops the user has visited recently (implicit preference)
    visited_stmt = (
        select(UserEvent.entity_id)
        .where(
            UserEvent.user_id == user_id,
            UserEvent.entity_type == "shop",
            UserEvent.event_type.in_(["shop_view", "product_view"]),
        )
        .limit(30)
    )
    visited_shop_ids = set(
        str(r) for r in (await db.execute(visited_stmt)).scalars().all()
    )

    # Fetch active deals from shops in radius
    stmt = (
        select(Deal, Shop.name.label("shop_name"), Shop.avg_rating, Shop.latitude, Shop.longitude)
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

    scored = []
    for row in rows:
        deal = row.Deal
        shop_name = row.shop_name
        shop_rating = float(row.avg_rating or 3.0)

        # ── Scoring components ──────────────────────────────────────────────
        score = 0.0

        # 1. Discount depth (0-40 pts)
        discount = deal.discount_pct or 0
        score += min(discount, 80) * 0.5  # caps at 40 pts for 80% discount

        # 2. Shop rating bonus (0-10 pts)
        score += (shop_rating - 3) * 5  # +5 per star above 3

        # 3. Interest match (0-30 pts)
        if interests:
            title_words = set((deal.title or "").lower().split())
            if title_words & interests:
                score += 30
            elif title_words & {i[:4] for i in interests}:  # partial match
                score += 15

        # 4. Visited shop bonus (0-20 pts)
        if str(deal.shop_id) in visited_shop_ids:
            score += 20

        # 5. Recency boost (0-10 pts) — decays over 7 days
        if deal.created_at:
            age_hours = (now - deal.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            score += max(0, 10 - age_hours / 16.8)  # full 10 pts if < 1 hour old

        # 6. Scarcity signal (0-10 pts)
        if deal.max_claims and deal.current_claims:
            remaining_pct = 1 - (deal.current_claims / deal.max_claims)
            score += (1 - remaining_pct) * 10  # higher score when almost sold out

        scored.append(
            {
                "id": str(deal.id),
                "title": deal.title,
                "description": deal.description,
                "discount_pct": discount,
                "discount_amount": float(deal.discount_amount or 0),
                "expires_at": deal.expires_at.isoformat() if deal.expires_at else None,
                "shop_id": str(deal.shop_id),
                "shop_name": shop_name,
                "shop_rating": round(shop_rating, 1),
                "product_id": str(deal.product_id) if deal.product_id else None,
                "current_claims": deal.current_claims,
                "max_claims": deal.max_claims,
                "personalisation_score": round(score, 1),
                "match_reason": _match_reason(score, interests, str(deal.shop_id) in visited_shop_ids),
            }
        )

    scored.sort(key=lambda x: -x["personalisation_score"])
    return scored[:limit]


def _match_reason(score: float, interests: set, is_visited: bool) -> str:
    if is_visited:
        return "From a shop you visited"
    if score >= 50:
        return "Matches your interests"
    elif score >= 30:
        return "Hot deal near you"
    else:
        return "Available nearby"
