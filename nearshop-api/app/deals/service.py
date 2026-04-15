from datetime import datetime, timedelta, timezone
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.core.geo import within_radius
from app.deals.models import Deal
from app.deals.schemas import DealCreate
from app.products.models import Product
from app.ranking.service import RankingContext, build_user_preference_profile, rank_deals, resolve_ranking_profile_id, resolve_ranking_selection
from app.shops.models import Shop


def _calculate_savings_pct(original_price: Decimal | None, deal_price: Decimal | None) -> int | None:
    """Calculate savings percentage from original and deal prices."""
    if not original_price or not deal_price or original_price == 0:
        return None
    try:
        savings = (float(original_price) - float(deal_price)) / float(original_price) * 100
        return int(round(max(0, savings)))
    except (TypeError, ValueError, ZeroDivisionError):
        return None


async def create_deal(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
    data: DealCreate,
) -> Deal:
    """Create a new deal for a shop after verifying ownership."""
    # Verify shop ownership
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    # Check max 5 active deals per shop
    now = datetime.now(timezone.utc)
    active_count_result = await db.execute(
        select(func.count()).select_from(Deal).where(
            and_(
                Deal.shop_id == shop_id,
                Deal.is_active == True,
                Deal.expires_at > now,
            )
        )
    )
    active_count = active_count_result.scalar() or 0
    if active_count >= 5:
        raise BadRequestError("Maximum of 5 active deals per shop reached")

    # Get product data if product_id provided
    product = None
    if data.product_id:
        product_result = await db.execute(select(Product).where(Product.id == data.product_id))
        product = product_result.scalar_one_or_none()

    deal = Deal(
        shop_id=shop_id,
        product_id=data.product_id,
        title=data.title,
        description=data.description,
        discount_pct=data.discount_pct,
        discount_amount=data.discount_amount,
        starts_at=now,
        expires_at=now + timedelta(hours=data.duration_hours),
        max_claims=data.max_claims,
    )
    db.add(deal)
    await db.flush()
    await db.refresh(deal)

    # Attach shop name and product data for response
    deal.shop_name = shop.name  # type: ignore[attr-defined]
    if product:
        deal.product_name = product.name  # type: ignore[attr-defined]
        deal.image_url = product.images[0] if product.images else None  # type: ignore[attr-defined]
        deal.category = product.category  # type: ignore[attr-defined]
        deal.original_price = product.price  # type: ignore[attr-defined]
        deal.deal_price = max(
            Decimal('0'),
            Decimal(product.price) - (Decimal(product.price) * Decimal(data.discount_pct or 0) / Decimal('100'))
            if data.discount_pct
            else Decimal(product.price) - Decimal(data.discount_amount or 0),
        )  # type: ignore[attr-defined]
    else:
        deal.product_name = None  # type: ignore[attr-defined]
        deal.image_url = None  # type: ignore[attr-defined]
        deal.category = None  # type: ignore[attr-defined]
        deal.original_price = None  # type: ignore[attr-defined]
        deal.deal_price = None  # type: ignore[attr-defined]
    
    return deal


async def get_nearby_deals(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    category: str | None = None,
    page: int = 1,
    per_page: int = 20,
    user_id: UUID | None = None,
) -> tuple[list[Deal], int]:
    """Get active deals from nearby shops using Haversine geo filtering."""
    now = datetime.now(timezone.utc)

    base_query = (
        select(Deal, Shop, Product)
        .join(Shop, Deal.shop_id == Shop.id)
        .outerjoin(Product, Deal.product_id == Product.id)
        .where(
            and_(
                Deal.is_active == True,
                Deal.expires_at > now,
                Shop.is_active == True,
                within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km),
            )
        )
    )

    if category:
        base_query = base_query.where(Shop.category == category)

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    should_rank = user_id is not None

    if should_rank:
        selection = resolve_ranking_selection("nearby_deals", str(user_id) if user_id else None)
        result = await db.execute(base_query.limit(min(max(per_page * 5, 80), 200)))
        rows = result.all()
        profile = await build_user_preference_profile(db, user_id)
        ranked_rows = rank_deals(
            rows,
            profile,
            RankingContext(lat=lat, lng=lng, radius_km=radius_km, surface="nearby_deals", profile_id=selection["profile_id"], user_id=str(user_id) if user_id else None),
        )
        resolved_profile_id = resolve_ranking_profile_id("nearby_deals")
        deals = []
        for row in ranked_rows[offset : offset + per_page]:
            deal, shop, product = row
            # Attach shop name and product data to deal object
            deal.shop_name = shop.name  # type: ignore[attr-defined]
            if product:
                deal.product_name = product.name  # type: ignore[attr-defined]
                deal.image_url = product.images[0] if product.images else None  # type: ignore[attr-defined]
                deal.category = product.category  # type: ignore[attr-defined]
                deal.original_price = product.price  # type: ignore[attr-defined]
                deal.deal_price = max(
                    Decimal('0'),
                    Decimal(product.price) - (Decimal(product.price) * Decimal(deal.discount_pct or 0) / Decimal('100'))
                    if deal.discount_pct
                    else Decimal(product.price) - Decimal(deal.discount_amount or 0),
                )  # type: ignore[attr-defined]
                deal.savings_pct = _calculate_savings_pct(deal.original_price, deal.deal_price)  # type: ignore[attr-defined]
            else:
                deal.product_name = None  # type: ignore[attr-defined]
                deal.image_url = None  # type: ignore[attr-defined]
                deal.category = None  # type: ignore[attr-defined]
                deal.original_price = None  # type: ignore[attr-defined]
                deal.deal_price = None  # type: ignore[attr-defined]
                deal.savings_pct = None  # type: ignore[attr-defined]
            deal.reason = "Recommended for this shopper"  # type: ignore[attr-defined]
            deal.ranking_profile = resolved_profile_id  # type: ignore[attr-defined]
            deal.ranking_experiment = selection["experiment_id"]  # type: ignore[attr-defined]
            deal.ranking_variant = selection["variant_id"]  # type: ignore[attr-defined]
            deals.append(deal)
    else:
        ordered_query = base_query.order_by(Deal.expires_at.asc()).offset(offset).limit(per_page)
        result = await db.execute(ordered_query)
        deals = []
        for row in result.all():
            deal, shop, product = row
            # Attach shop name and product data to deal object
            deal.shop_name = shop.name  # type: ignore[attr-defined]
            if product:
                deal.product_name = product.name  # type: ignore[attr-defined]
                deal.image_url = product.images[0] if product.images else None  # type: ignore[attr-defined]
                deal.category = product.category  # type: ignore[attr-defined]
                deal.original_price = product.price  # type: ignore[attr-defined]
                deal.deal_price = max(
                    Decimal('0'),
                    Decimal(product.price) - (Decimal(product.price) * Decimal(deal.discount_pct or 0) / Decimal('100'))
                    if deal.discount_pct
                    else Decimal(product.price) - Decimal(deal.discount_amount or 0),
                )  # type: ignore[attr-defined]
                deal.savings_pct = _calculate_savings_pct(deal.original_price, deal.deal_price)  # type: ignore[attr-defined]
            else:
                deal.product_name = None  # type: ignore[attr-defined]
                deal.image_url = None  # type: ignore[attr-defined]
                deal.category = None  # type: ignore[attr-defined]
                deal.original_price = None  # type: ignore[attr-defined]
                deal.deal_price = None  # type: ignore[attr-defined]
                deal.savings_pct = None  # type: ignore[attr-defined]
            deals.append(deal)

    return deals, total


async def claim_deal(
    db: AsyncSession,
    deal_id: UUID,
    user_id: UUID,
) -> Deal:
    """Claim a deal: check active, not expired, max_claims not reached, then increment."""
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise NotFoundError("Deal not found")
    if not deal.is_active:
        raise BadRequestError("Deal is no longer active")
    if deal.expires_at <= now:
        raise BadRequestError("Deal has expired")
    if deal.max_claims is not None and deal.current_claims >= deal.max_claims:
        raise BadRequestError("Deal has reached maximum claims")

    deal.current_claims += 1
    await db.flush()
    await db.refresh(deal)
    return deal


async def end_deal(
    db: AsyncSession,
    deal_id: UUID,
    owner_id: UUID,
) -> Deal:
    """End a deal by setting is_active=false after verifying shop ownership."""
    result = await db.execute(
        select(Deal).options(joinedload(Deal.shop)).where(Deal.id == deal_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise NotFoundError("Deal not found")
    if deal.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    deal.is_active = False
    await db.flush()
    await db.refresh(deal)
    return deal


async def get_shop_deals(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
) -> list[Deal]:
    """Get all deals for a shop after verifying ownership."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    deals_result = await db.execute(
        select(Deal)
        .where(Deal.shop_id == shop_id)
        .order_by(Deal.created_at.desc())
    )
    return list(deals_result.scalars().all())
