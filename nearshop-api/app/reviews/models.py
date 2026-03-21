from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    text,
    ARRAY,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )
    rating = Column(
        Integer,
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating"),
        nullable=False,
    )
    comment = Column(Text, nullable=True)
    images = Column(ARRAY(Text), nullable=True)
    is_trusted = Column(Boolean, server_default=text("false"), nullable=False)
    shop_reply = Column(Text, nullable=True)
    shop_replied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "shop_id", "order_id", name="uq_review_user_shop_order"
        ),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    shop = relationship("Shop", back_populates="reviews")
