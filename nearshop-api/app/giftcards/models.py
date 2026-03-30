"""Gift Cards Models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Integer, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GiftCard(Base):
    """Gift card issued by a shop or platform."""
    __tablename__ = "gift_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    code = Column(String(20), unique=True, nullable=False, index=True)
    
    # Type: shop-specific or platform-wide
    card_type = Column(String(20), nullable=False, default="shop")  # shop, platform
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True)
    
    # Value
    initial_value = Column(Numeric(10, 2), nullable=False)
    current_balance = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="INR")
    
    # Purchaser and recipient
    purchased_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    recipient_phone = Column(String(20), nullable=True)
    recipient_name = Column(String(100), nullable=True)
    personal_message = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), server_default=text("'active'"), nullable=False)  # active, redeemed, expired, cancelled
    is_digital = Column(Boolean, server_default=text("true"))
    
    # Validity
    purchased_at = Column(DateTime(timezone=True), nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Design
    template_id = Column(String(50), nullable=True)
    custom_design = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    shop = relationship("Shop", foreign_keys=[shop_id])
    purchaser = relationship("User", foreign_keys=[purchased_by])
    transactions = relationship("GiftCardTransaction", back_populates="gift_card")


class GiftCardTransaction(Base):
    """Transaction history for gift card."""
    __tablename__ = "gift_card_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    gift_card_id = Column(UUID(as_uuid=True), ForeignKey("gift_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    
    transaction_type = Column(String(20), nullable=False)  # purchase, redeem, refund, expire
    amount = Column(Numeric(10, 2), nullable=False)
    balance_before = Column(Numeric(10, 2), nullable=False)
    balance_after = Column(Numeric(10, 2), nullable=False)
    
    # Related entities
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    gift_card = relationship("GiftCard", back_populates="transactions")
    order = relationship("Order", foreign_keys=[order_id])
    user = relationship("User", foreign_keys=[user_id])


class GiftCardTemplate(Base):
    """Predefined gift card designs."""
    __tablename__ = "gift_card_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True)  # null = platform template
    
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)  # birthday, wedding, thank_you, holiday
    image_url = Column(Text, nullable=True)
    design_config = Column(JSONB, nullable=True)
    
    is_active = Column(Boolean, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    shop = relationship("Shop", foreign_keys=[shop_id])
