"""Subscription Service"""
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.subscriptions.models import ShopSubscription, SubscriptionInvoice, FeatureUsage, SUBSCRIPTION_TIERS
from app.subscriptions.schemas import SubscriptionCreate


def generate_invoice_number() -> str:
    return f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"


async def get_or_create_subscription(db: AsyncSession, shop_id: UUID) -> ShopSubscription:
    result = await db.execute(select(ShopSubscription).where(ShopSubscription.shop_id == shop_id))
    subscription = result.scalar_one_or_none()
    
    if subscription:
        return subscription
    
    # Create free tier subscription
    subscription = ShopSubscription(
        shop_id=shop_id, tier="free", status="active", started_at=datetime.utcnow(),
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def upgrade_subscription(
    db: AsyncSession, shop_id: UUID, new_tier: str, billing_cycle: str = "monthly",
) -> ShopSubscription:
    if new_tier not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    subscription = await get_or_create_subscription(db, shop_id)
    tier_info = SUBSCRIPTION_TIERS[new_tier]
    
    price = tier_info["price_monthly"] if billing_cycle == "monthly" else tier_info["price_yearly"]
    
    subscription.tier = new_tier
    subscription.billing_cycle = billing_cycle
    subscription.price = Decimal(price)
    subscription.current_period_start = datetime.utcnow()
    
    if billing_cycle == "monthly":
        subscription.current_period_end = datetime.utcnow() + timedelta(days=30)
    else:
        subscription.current_period_end = datetime.utcnow() + timedelta(days=365)
    
    # Create invoice if paid tier
    if price > 0:
        invoice = SubscriptionInvoice(
            subscription_id=subscription.id, shop_id=shop_id,
            invoice_number=generate_invoice_number(),
            amount=Decimal(price), tax=Decimal(price * 0.18), total=Decimal(price * 1.18),
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
        )
        db.add(invoice)
    
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def cancel_subscription(db: AsyncSession, shop_id: UUID) -> ShopSubscription:
    subscription = await get_or_create_subscription(db, shop_id)
    
    subscription.status = "cancelled"
    subscription.cancelled_at = datetime.utcnow()
    # Keep access until period end
    
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def get_invoices(db: AsyncSession, shop_id: UUID, limit: int = 20) -> List[SubscriptionInvoice]:
    result = await db.execute(
        select(SubscriptionInvoice).where(SubscriptionInvoice.shop_id == shop_id)
        .order_by(SubscriptionInvoice.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def get_or_create_usage(db: AsyncSession, shop_id: UUID) -> FeatureUsage:
    # Get current period (month)
    now = datetime.utcnow()
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        period_end = period_start.replace(year=now.year + 1, month=1)
    else:
        period_end = period_start.replace(month=now.month + 1)
    
    result = await db.execute(
        select(FeatureUsage).where(and_(
            FeatureUsage.shop_id == shop_id,
            FeatureUsage.period_start == period_start,
        ))
    )
    usage = result.scalar_one_or_none()
    
    if usage:
        return usage
    
    usage = FeatureUsage(shop_id=shop_id, period_start=period_start, period_end=period_end)
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    return usage


async def increment_usage(
    db: AsyncSession, shop_id: UUID, feature: str, count: int = 1,
) -> FeatureUsage:
    usage = await get_or_create_usage(db, shop_id)
    
    if feature == "products":
        usage.products_count += count
    elif feature == "orders":
        usage.orders_count += count
    elif feature == "broadcasts":
        usage.broadcasts_count += count
    elif feature == "ai_requests":
        usage.ai_requests_count += count
    
    await db.commit()
    await db.refresh(usage)
    return usage


async def check_limit(db: AsyncSession, shop_id: UUID, feature: str) -> dict:
    subscription = await get_or_create_subscription(db, shop_id)
    usage = await get_or_create_usage(db, shop_id)
    tier_info = SUBSCRIPTION_TIERS.get(subscription.tier, SUBSCRIPTION_TIERS["free"])
    features = tier_info["features"]
    
    limits = {
        "products": features["products_limit"],
        "orders": features["orders_per_month"],
        "broadcasts": features["broadcast_limit"],
    }
    
    current = {
        "products": usage.products_count,
        "orders": usage.orders_count,
        "broadcasts": usage.broadcasts_count,
    }
    
    limit = limits.get(feature, -1)
    current_count = current.get(feature, 0)
    
    if limit == -1:  # unlimited
        return {"allowed": True, "current": current_count, "limit": -1, "remaining": -1}
    
    remaining = limit - current_count
    return {
        "allowed": remaining > 0,
        "current": current_count,
        "limit": limit,
        "remaining": max(0, remaining),
    }


def get_tier_features(tier: str) -> dict:
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    return tier_info["features"]
