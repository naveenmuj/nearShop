"""Subscription Schemas"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class TierFeatures(BaseModel):
    products_limit: int
    orders_per_month: int
    staff_members: int
    analytics: str
    support: str
    commission_rate: float
    custom_domain: bool
    priority_listing: bool
    ai_features: bool
    broadcast_limit: int


class TierInfo(BaseModel):
    key: str
    name: str
    price_monthly: int
    price_yearly: int
    features: TierFeatures


class SubscriptionCreate(BaseModel):
    tier: str
    billing_cycle: str = "monthly"
    payment_method: Optional[str] = None


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    shop_id: UUID
    tier: str
    billing_cycle: Optional[str]
    price: Decimal
    status: str
    started_at: Optional[datetime]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancelled_at: Optional[datetime]
    trial_ends_at: Optional[datetime]
    # Computed
    tier_name: Optional[str] = None
    features: Optional[Dict[str, Any]] = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    subscription_id: UUID
    invoice_number: str
    amount: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    status: str
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime


class UsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    products_count: int
    products_limit: int
    orders_count: int
    orders_limit: int
    broadcasts_count: int
    broadcasts_limit: int
    period_start: datetime
    period_end: datetime


class UpgradeRequest(BaseModel):
    new_tier: str
    billing_cycle: str = "monthly"
