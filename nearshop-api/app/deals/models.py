from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    discount_pct = Column(Integer, nullable=True)
    discount_amount = Column(Numeric(10, 2), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    max_claims = Column(Integer, nullable=True)
    current_claims = Column(Integer, server_default=text("0"), nullable=False)
    views = Column(Integer, server_default=text("0"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    shop = relationship("Shop", back_populates="deals")
    product = relationship("Product")


class Coupon(Base):
    """Coupon/Promo Code model for discounts at checkout"""
    __tablename__ = "coupons"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    code = Column(String(50), unique=True, nullable=False, index=True)
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True
    )  # NULL means platform-wide coupon
    
    # Discount details
    discount_type = Column(String(20), nullable=False)  # 'percentage' or 'fixed'
    discount_value = Column(Numeric(10, 2), nullable=False)
    max_discount = Column(Numeric(10, 2), nullable=True)  # Max discount for percentage type
    min_order_amount = Column(Numeric(10, 2), nullable=True)
    
    # Usage limits
    max_uses = Column(Integer, nullable=True)  # NULL means unlimited
    max_uses_per_user = Column(Integer, server_default=text("1"), nullable=False)
    current_uses = Column(Integer, server_default=text("0"), nullable=False)
    
    # Validity
    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    
    # Restrictions
    applicable_categories = Column(ARRAY(String), nullable=True)  # NULL means all categories
    first_order_only = Column(Boolean, server_default=text("false"), nullable=False)
    
    # Metadata
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    shop = relationship("Shop")
    usages = relationship("CouponUsage", back_populates="coupon")


class CouponUsage(Base):
    """Track coupon usage per user"""
    __tablename__ = "coupon_usages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    coupon_id = Column(
        UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )
    discount_applied = Column(Numeric(10, 2), nullable=False)
    used_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    coupon = relationship("Coupon", back_populates="usages")
    user = relationship("User")
    order = relationship("Order")
