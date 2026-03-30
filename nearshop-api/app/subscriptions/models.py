"""Subscription Models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Integer, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "features": {
            "products_limit": 25,
            "orders_per_month": 50,
            "staff_members": 0,
            "analytics": "basic",
            "support": "community",
            "commission_rate": 5.0,
            "custom_domain": False,
            "priority_listing": False,
            "ai_features": False,
            "broadcast_limit": 1,
        },
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 499,
        "price_yearly": 4999,
        "features": {
            "products_limit": 500,
            "orders_per_month": 1000,
            "staff_members": 3,
            "analytics": "advanced",
            "support": "email",
            "commission_rate": 3.0,
            "custom_domain": False,
            "priority_listing": True,
            "ai_features": True,
            "broadcast_limit": 10,
        },
    },
    "business": {
        "name": "Business",
        "price_monthly": 1499,
        "price_yearly": 14999,
        "features": {
            "products_limit": -1,  # unlimited
            "orders_per_month": -1,
            "staff_members": 10,
            "analytics": "full",
            "support": "priority",
            "commission_rate": 1.5,
            "custom_domain": True,
            "priority_listing": True,
            "ai_features": True,
            "broadcast_limit": -1,
        },
    },
}


class ShopSubscription(Base):
    """Shop subscription records."""
    __tablename__ = "shop_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, unique=True, index=True)
    
    # Subscription details
    tier = Column(String(20), server_default=text("'free'"), nullable=False)
    billing_cycle = Column(String(20), nullable=True)  # monthly, yearly
    
    # Pricing
    price = Column(Numeric(10, 2), server_default=text("0"))
    currency = Column(String(3), default="INR")
    
    # Status
    status = Column(String(20), server_default=text("'active'"), nullable=False)  # active, cancelled, expired, paused
    
    # Dates
    started_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Payment
    payment_method = Column(String(30), nullable=True)
    external_subscription_id = Column(String(100), nullable=True)  # Razorpay/Stripe subscription ID
    
    # Trial
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    shop = relationship("Shop", foreign_keys=[shop_id])
    invoices = relationship("SubscriptionInvoice", back_populates="subscription")


class SubscriptionInvoice(Base):
    """Invoices for subscription payments."""
    __tablename__ = "subscription_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("shop_subscriptions.id"), nullable=False, index=True)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    
    invoice_number = Column(String(50), unique=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), server_default=text("0"))
    total = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="INR")
    
    status = Column(String(20), server_default=text("'pending'"), nullable=False)  # pending, paid, failed, refunded
    
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    
    payment_id = Column(String(100), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("ShopSubscription", back_populates="invoices")
    shop = relationship("Shop", foreign_keys=[shop_id])


class FeatureUsage(Base):
    """Track feature usage for limits."""
    __tablename__ = "feature_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    products_count = Column(Integer, server_default=text("0"))
    orders_count = Column(Integer, server_default=text("0"))
    broadcasts_count = Column(Integer, server_default=text("0"))
    ai_requests_count = Column(Integer, server_default=text("0"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    shop = relationship("Shop", foreign_keys=[shop_id])
