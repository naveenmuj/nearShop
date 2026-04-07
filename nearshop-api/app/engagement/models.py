from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRecentlyViewed(Base):
    __tablename__ = "user_recently_viewed"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    viewed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_recently_viewed_user_product"),
    )

    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])


class UserRecentSearch(Base):
    __tablename__ = "user_recent_searches"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query = Column(String(255), nullable=False)
    searched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "query", name="uq_recent_search_user_query"),
    )

    user = relationship("User", foreign_keys=[user_id])


class UserSavedSearchIntent(Base):
    __tablename__ = "user_saved_search_intents"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query = Column(String(255), nullable=False)
    label = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "query", name="uq_saved_intent_user_query"),
    )

    user = relationship("User", foreign_keys=[user_id])


class OrderTrackingEvent(Base):
    __tablename__ = "order_tracking_events"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    order = relationship("Order", foreign_keys=[order_id])


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    coins_reward = Column(Integer, server_default=text("0"), nullable=True)
    criteria_type = Column(String(50), nullable=True)
    criteria_value = Column(Integer, nullable=True)

    user_achievements = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    achievement_id = Column(
        UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=False, index=True
    )
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    user = relationship("User", foreign_keys=[user_id])
    achievement = relationship("Achievement", back_populates="user_achievements")


class DailySpin(Base):
    __tablename__ = "daily_spins"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prize_label = Column(String(100), nullable=False)
    coins_won = Column(Integer, server_default=text("0"), nullable=False)
    spun_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
