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
    ARRAY,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    shop_id = Column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    compare_price = Column(Numeric(10, 2), nullable=True)
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)
    attributes = Column(JSONB, nullable=True)
    tags = Column(ARRAY(Text), nullable=True)
    images = Column(ARRAY(Text), nullable=False)
    is_available = Column(Boolean, server_default=text("true"), nullable=False)
    is_featured = Column(Boolean, server_default=text("false"), nullable=False)
    view_count = Column(Integer, server_default=text("0"), nullable=False)
    wishlist_count = Column(Integer, server_default=text("0"), nullable=False)
    inquiry_count = Column(Integer, server_default=text("0"), nullable=False)
    ai_generated = Column(Boolean, server_default=text("false"), nullable=False)
    barcode = Column(String(50), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    shop = relationship("Shop", back_populates="products")
    price_history = relationship("PriceHistory", backref="product", lazy="noload")


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), unique=True, nullable=False
    )
    image_embedding = Column(JSONB, nullable=True)
    text_embedding = Column(JSONB, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    product = relationship("Product", foreign_keys=[product_id])


class Category(Base):
    __tablename__ = "categories"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    parent_id = Column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    icon = Column(String(50), nullable=True)
    display_order = Column(Integer, nullable=True)
    is_active = Column(Boolean, server_default=text("true"), nullable=False)

    # Relationships
    parent = relationship("Category", remote_side="Category.id", foreign_keys=[parent_id])


class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuid_generate_v4()"),
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    price_at_save = Column(Numeric(10, 2), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    old_price = Column(Numeric(10, 2), nullable=False)
    new_price = Column(Numeric(10, 2), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
