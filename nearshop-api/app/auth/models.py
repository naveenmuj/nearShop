from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Float,
    Text,
    DateTime,
    Date,
    ForeignKey,
    text,
    ARRAY,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    phone = Column(String(15), unique=True, nullable=True, index=True)
    name = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(Text, nullable=True)
    firebase_uid = Column(String(128), unique=True, nullable=True, index=True)
    roles = Column(ARRAY(Text), server_default=text("'{customer}'"), nullable=False)
    active_role = Column(String(20), server_default=text("'customer'"), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    interests = Column(ARRAY(Text), nullable=True)
    referral_code = Column(String(10), unique=True, nullable=True)
    referred_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    # Added by migration a1b2c3d4e5f6 (Features 15 & 16)
    daily_spin_streak = Column(Integer, server_default=text("0"), nullable=True)
    last_spin_date = Column(Date, nullable=True)
    sound_enabled = Column(Boolean, server_default=text("false"), nullable=True)
    # FCM Push Notification fields
    fcm_token = Column(Text, nullable=True)
    fcm_device_type = Column(String(20), nullable=True)  # 'mobile', 'web'
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    shops = relationship("Shop", back_populates="owner")
    referrer = relationship("User", remote_side="User.id", foreign_keys=[referred_by])


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    phone = Column(String(15), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, server_default=text("0"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Follow(Base):
    __tablename__ = "follows"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "shop_id", name="uq_follow_user_shop"),
    )

    user = relationship("User", foreign_keys=[user_id])
    shop = relationship("Shop", foreign_keys=[shop_id])


class UserEvent(Base):
    __tablename__ = "user_events"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    event_type = Column(String(30), nullable=False)
    entity_type = Column(String(20), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", foreign_keys=[user_id])


class SearchLog(Base):
    __tablename__ = "search_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    query_text = Column(Text, nullable=True)
    query_image_url = Column(Text, nullable=True)
    search_type = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    results_count = Column(Integer, nullable=True)
    clicked_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    # Added by migration a1b2c3d4e5f6 (Feature 5) — short-form query field
    query = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", foreign_keys=[user_id])


class UserAddress(Base):
    """Saved addresses for users"""
    __tablename__ = "user_addresses"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    label = Column(String(50), nullable=False)  # 'home', 'work', 'other'
    full_name = Column(String(100), nullable=True)
    phone = Column(String(15), nullable=True)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=False)
    landmark = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_default = Column(Boolean, server_default=text("false"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
