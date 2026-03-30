"""Subscription Router"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business
from app.subscriptions.models import SUBSCRIPTION_TIERS
from app.subscriptions.schemas import (
    TierInfo, TierFeatures, SubscriptionResponse, InvoiceResponse,
    UsageResponse, UpgradeRequest,
)
from app.subscriptions.service import (
    get_or_create_subscription, upgrade_subscription, cancel_subscription,
    get_invoices, get_or_create_usage, check_limit, get_tier_features,
)
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/subscriptions", tags=["subscriptions"])


@router.get("/tiers", response_model=list[TierInfo])
async def list_tiers():
    return [
        TierInfo(
            key=key, name=info["name"],
            price_monthly=info["price_monthly"],
            price_yearly=info["price_yearly"],
            features=TierFeatures(**info["features"]),
        )
        for key, info in SUBSCRIPTION_TIERS.items()
    ]


@router.get("/mine", response_model=SubscriptionResponse)
async def get_my_subscription(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    subscription = await get_or_create_subscription(db, shop_id)
    tier_info = SUBSCRIPTION_TIERS.get(subscription.tier, SUBSCRIPTION_TIERS["free"])
    
    return SubscriptionResponse(
        **{k: v for k, v in subscription.__dict__.items() if not k.startswith('_')},
        tier_name=tier_info["name"],
        features=tier_info["features"],
    )


@router.post("/upgrade", response_model=SubscriptionResponse)
async def upgrade(
    body: UpgradeRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    subscription = await upgrade_subscription(db, shop_id, body.new_tier, body.billing_cycle)
    tier_info = SUBSCRIPTION_TIERS.get(subscription.tier, SUBSCRIPTION_TIERS["free"])
    
    return SubscriptionResponse(
        **{k: v for k, v in subscription.__dict__.items() if not k.startswith('_')},
        tier_name=tier_info["name"],
        features=tier_info["features"],
    )


@router.post("/cancel")
async def cancel(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    subscription = await cancel_subscription(db, shop_id)
    return {
        "message": "Subscription cancelled",
        "access_until": subscription.current_period_end,
    }


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    limit: int = 20,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    invoices = await get_invoices(db, shop_id, limit)
    return [InvoiceResponse.model_validate(i) for i in invoices]


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    subscription = await get_or_create_subscription(db, shop_id)
    usage = await get_or_create_usage(db, shop_id)
    features = get_tier_features(subscription.tier)
    
    return UsageResponse(
        products_count=usage.products_count,
        products_limit=features["products_limit"],
        orders_count=usage.orders_count,
        orders_limit=features["orders_per_month"],
        broadcasts_count=usage.broadcasts_count,
        broadcasts_limit=features["broadcast_limit"],
        period_start=usage.period_start,
        period_end=usage.period_end,
    )


@router.get("/check/{feature}")
async def check_feature_limit(
    feature: str,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    result = await check_limit(db, shop_id, feature)
    return result
