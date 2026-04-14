"""Models for master catalog system."""

from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text, DateTime, ForeignKey,
    Numeric, text, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CatalogTemplate(Base):
    """Master catalog of products that shops can select from."""
    __tablename__ = "catalog_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    
    # Core identification
    sku = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(300), nullable=False)
    brand = Column(String(150), nullable=True, index=True)
    
    # Classification
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)
    
    # Content
    description = Column(Text, nullable=True)
    short_description = Column(String(300), nullable=True)
    
    # Images
    image_urls = Column(ARRAY(String), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    
    # Flexible attributes: {"color": ["red", "blue"], "size": ["S", "M", "L"], "warranty": "12 months"}
    attributes = Column(JSONB, nullable=True)
    variants = Column(JSONB, nullable=True)
    
    # Data sourcing
    data_source = Column(String(50), nullable=True)  # 'flipkart', 'amazon', 'jiomart', 'user_submitted'
    source_url = Column(String(500), nullable=True)
    source_id = Column(String(100), nullable=True)  # External ID from source
    confidence_score = Column(Float, nullable=True)  # 0-1
    
    # Popularity
    popularity_score = Column(Integer, server_default='0')
    num_shops_using = Column(Integer, server_default='0')
    avg_rating = Column(Float, nullable=True)
    num_reviews = Column(Integer, server_default='0')
    
    # Pricing baseline
    base_price_inr = Column(Numeric(10, 2), nullable=True)
    compare_price_inr = Column(Numeric(10, 2), nullable=True)
    typical_discount_pct = Column(Float, nullable=True)
    
    # Status
    is_active = Column(Boolean, server_default='true', index=True)
    is_verified = Column(Boolean, server_default='false')
    last_scraped_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    shop_selections = relationship("ShopCatalogSelection", back_populates="catalog", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_catalog_category_active', 'category', 'is_active'),
        Index('idx_catalog_source', 'data_source'),
        Index('idx_catalog_popularity', 'popularity_score'),
    )


class ShopCatalogSelection(Base):
    """Junction table: which shops have selected which catalog products."""
    __tablename__ = "shop_catalog_selections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    
    # References
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), 
                     nullable=False, index=True)
    catalog_id = Column(UUID(as_uuid=True), ForeignKey("catalog_templates.id", ondelete="CASCADE"), 
                        nullable=False, index=True)
    
    # Shop-specific pricing
    local_price = Column(Numeric(10, 2), nullable=False)
    compare_price = Column(Numeric(10, 2), nullable=True)
    local_description = Column(Text, nullable=True)
    
    # Shop-specific inventory
    stock_quantity = Column(Integer, nullable=True)
    is_active = Column(Boolean, server_default='true', index=True)
    
    # Timestamps
    selected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    catalog = relationship("CatalogTemplate", back_populates="shop_selections")
    shop = relationship("Shop")
    
    __table_args__ = (
        UniqueConstraint('shop_id', 'catalog_id', name='uq_shop_catalog'),
        Index('idx_shop_catalog_active', 'shop_id', 'is_active'),
    )
