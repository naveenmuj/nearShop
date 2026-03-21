from sqlalchemy import (
    Column,
    String,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    order_number = Column(String(20), unique=True, nullable=False)
    customer_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    items = Column(JSONB, nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=True)
    delivery_fee = Column(Numeric(10, 2), server_default=text("0"))
    discount = Column(Numeric(10, 2), server_default=text("0"))
    total = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), server_default=text("'pending'"))
    delivery_type = Column(String(20), nullable=True)
    delivery_address = Column(Text, nullable=True)
    payment_method = Column(String(20), nullable=True)
    payment_status = Column(String(20), server_default=text("'pending'"))
    payment_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    shop = relationship("Shop", back_populates="orders")
