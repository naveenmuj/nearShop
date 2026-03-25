from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Float,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
    text,
    ARRAY,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    owner_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    subcategories = Column(ARRAY(Text), nullable=True)
    phone = Column(String(15), nullable=True)
    whatsapp = Column(String(15), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    opening_hours = Column(JSONB, nullable=True)
    cover_image = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    gallery = Column(ARRAY(Text), nullable=True)
    is_verified = Column(Boolean, server_default=text("false"), nullable=False)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)
    is_premium = Column(Boolean, server_default=text("false"), nullable=False)
    avg_rating = Column(Numeric(2, 1), server_default=text("0"), nullable=False)
    total_reviews = Column(Integer, server_default=text("0"), nullable=False)
    total_products = Column(Integer, server_default=text("0"), nullable=False)
    score = Column(Numeric(8, 4), default=0.0, server_default="0.0", nullable=False)
    delivery_options = Column(
        ARRAY(Text), server_default=text("'{pickup}'"), nullable=False
    )
    delivery_radius = Column(Integer, nullable=True)
    delivery_fee = Column(Numeric(10, 2), server_default=text("0"), nullable=False)
    free_delivery_above = Column(Numeric(10, 2), nullable=True)
    min_order = Column(Numeric(10, 2), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    owner = relationship("User", back_populates="shops")
    products = relationship("Product", back_populates="shop", lazy="selectin")
    reviews = relationship("Review", back_populates="shop", lazy="selectin")
    deals = relationship("Deal", back_populates="shop", lazy="selectin")
    stories = relationship("Story", back_populates="shop", lazy="selectin")
    orders = relationship("Order", back_populates="shop", lazy="selectin")
    delivery_zones = relationship("DeliveryZone", back_populates="shop", lazy="selectin")
