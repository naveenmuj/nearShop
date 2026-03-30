"""
Direct Messaging Models - Shop-Customer Chat System
"""
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Integer,
    text,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Conversation(Base):
    """A conversation thread between a customer and a shop."""
    __tablename__ = "conversations"

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
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True, index=True
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )
    status = Column(
        String(20), server_default=text("'active'"), nullable=False
    )
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    customer_unread_count = Column(Integer, server_default=text("0"))
    shop_unread_count = Column(Integer, server_default=text("0"))
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    customer = relationship("User", foreign_keys=[customer_id])
    shop = relationship("Shop", foreign_keys=[shop_id])
    product = relationship("Product", foreign_keys=[product_id])
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")

    __table_args__ = (
        Index("ix_conversations_customer_shop", "customer_id", "shop_id"),
    )


class Message(Base):
    """Individual messages in a conversation."""
    __tablename__ = "messages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(10), nullable=False)
    content = Column(Text, nullable=True)
    message_type = Column(String(20), server_default=text("'text'"), nullable=False)
    attachments = Column(JSONB, nullable=True)
    metadata = Column(JSONB, nullable=True)
    is_read = Column(Boolean, server_default=text("false"), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class MessageTemplate(Base):
    """Quick reply templates for shops."""
    __tablename__ = "message_templates"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    use_count = Column(Integer, server_default=text("0"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    shop = relationship("Shop", foreign_keys=[shop_id])
