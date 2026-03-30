"""Returns & Refunds Models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ReturnRequest(Base):
    """Return/refund request for an order item."""
    __tablename__ = "return_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    
    # Item details (from order)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    item_name = Column(String(300), nullable=False)
    item_quantity = Column(Integer, nullable=False, default=1)
    item_price = Column(Numeric(10, 2), nullable=False)
    
    # Request details
    reason = Column(String(50), nullable=False)  # damaged, wrong_item, not_as_described, defective, size_issue, other
    description = Column(Text, nullable=True)
    images = Column(JSONB, nullable=True)  # Proof images
    
    # Status workflow: pending -> approved/rejected -> processing -> completed/cancelled
    status = Column(String(20), server_default=text("'pending'"), nullable=False)
    
    # Refund details
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_method = Column(String(30), nullable=True)  # original_payment, store_credit, bank_transfer
    refund_status = Column(String(20), nullable=True)  # pending, processing, completed, failed
    refund_transaction_id = Column(String(100), nullable=True)
    
    # Timeline
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    order = relationship("Order", foreign_keys=[order_id])
    customer = relationship("User", foreign_keys=[customer_id])
    shop = relationship("Shop", foreign_keys=[shop_id])
    product = relationship("Product", foreign_keys=[product_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
    timeline = relationship("ReturnTimeline", back_populates="return_request", order_by="ReturnTimeline.created_at")


class ReturnTimeline(Base):
    """Timeline events for return requests."""
    __tablename__ = "return_timeline"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    return_id = Column(UUID(as_uuid=True), ForeignKey("return_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(30), nullable=False)  # created, status_change, message, refund_initiated, refund_completed
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    message = Column(Text, nullable=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(20), nullable=True)  # customer, shop, system
    event_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    return_request = relationship("ReturnRequest", back_populates="timeline")
    actor = relationship("User", foreign_keys=[actor_id])


class ReturnPolicy(Base):
    """Shop-specific return policies."""
    __tablename__ = "return_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, unique=True)
    
    # Policy settings
    returns_enabled = Column(String(1), server_default=text("'Y'"), nullable=False)
    return_window_days = Column(Integer, server_default=text("7"))  # Days after delivery
    refund_processing_days = Column(Integer, server_default=text("5"))
    
    # Categories
    returnable_categories = Column(JSONB, nullable=True)  # Categories that can be returned
    non_returnable_categories = Column(JSONB, nullable=True)  # Categories that cannot be returned
    
    # Conditions
    require_images = Column(String(1), server_default=text("'Y'"))
    require_original_packaging = Column(String(1), server_default=text("'N'"))
    partial_refund_percentage = Column(Integer, server_default=text("100"))  # For opened items
    
    # Policy text
    policy_text = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    shop = relationship("Shop", foreign_keys=[shop_id])
