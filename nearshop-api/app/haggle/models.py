from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    Numeric,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class HaggleSession(Base):
    __tablename__ = "haggle_sessions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    customer_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    status = Column(
        String(20), server_default=text("'active'"), nullable=False
    )
    listed_price = Column(Numeric(10, 2), nullable=True)
    final_price = Column(Numeric(10, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    shop = relationship("Shop", foreign_keys=[shop_id])
    product = relationship("Product", foreign_keys=[product_id])
    messages = relationship(
        "HaggleMessage",
        back_populates="session",
        order_by="HaggleMessage.created_at",
    )


class HaggleMessage(Base):
    __tablename__ = "haggle_messages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("haggle_sessions.id"),
        nullable=False,
        index=True,
    )
    sender_role = Column(String(10), nullable=False)
    offer_amount = Column(Numeric(10, 2), nullable=True)
    message = Column(Text, nullable=True)
    ai_suggestion = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session = relationship("HaggleSession", back_populates="messages")
