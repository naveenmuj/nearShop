"""
SQLAlchemy Models for Missing Features
Phase 1: Addresses, Payment Methods, User Profiles, Notifications
"""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, ForeignKey, Time, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base
from app.auth.models import UserAddress
from app.notifications.models import Notification


# ============================================================================
# PHASE 1: CORE DATA MODELS
# ============================================================================

class SavedPaymentMethod(Base):
    """User's saved payment methods (cards, UPI, wallets)"""
    __tablename__ = "saved_payment_methods"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Payment Type: "razorpay_card", "upi", "wallet"
    payment_type = Column(String(50), nullable=False)
    
    # Card Data (encrypted/tokenized)
    card_last_4 = Column(String(4))
    card_brand = Column(String(50))  # "visa", "mastercard", "amex"
    card_expiry = Column(String(5))  # MM/YY
    card_token = Column(String(500))  # Razorpay token (never raw card data)
    
    # UPI Data
    upi_id = Column(String(255))
    
    # Wallet Data
    wallet_id = Column(String(255))
    wallet_balance = Column(Numeric(precision=10, scale=2))
    
    # Flags
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    display_name = Column(String(100))  # e.g., "My Visa Card"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", backref="payment_methods")


class UserProfile(Base):
    """Extended user profile with preferences and stats"""
    __tablename__ = "user_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
    # Profile Info
    display_name = Column(String(255))
    bio = Column(Text)
    avatar_url = Column(String(500))  # S3 URL
    avatar_key = Column(String(255))  # S3 key for deletion
    
    # Preferences
    preferred_language = Column(String(10), default="en")
    timezone = Column(String(50), default="Asia/Kolkata")
    
    # Stats (cached from orders)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Numeric(precision=12, scale=2), default=0)
    avg_rating = Column(Numeric(precision=3, scale=2))
    badges = Column(JSON)  # Array of badge IDs earned
    
    # Account Verification
    phone_verified_at = Column(DateTime)
    email_verified_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", backref="profile", uselist=False)


class SearchHistory(Base):
    """Track user search queries for analytics and suggestions"""
    __tablename__ = "search_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Query Info
    search_query = Column(String(500), nullable=False)
    search_type = Column(String(20), nullable=False)  # "product", "shop", "combined"
    
    # Filters Used
    filters = Column(JSON)  # {minPrice, maxPrice, category, rating, etc}
    result_count = Column(Integer)
    clicked_result_id = Column(UUID(as_uuid=True))  # If user clicked a result
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Anonymous Searches
    session_id = Column(String(255))  # For unlogged users
    device_id = Column(String(255))
    
    # Relationships
    user = relationship("User", backref="search_history")


# ============================================================================
# PHASE 2: RECOMMENDATION MODELS
# ============================================================================

class ProductRecommendation(Base):
    """AI-generated product recommendations for users"""
    __tablename__ = "product_recommendations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Recommendation Type
    reason = Column(String(50), nullable=False)  # "view_based", "purchase_based", "trending", "similar"
    
    # Scoring
    score = Column(Numeric(precision=5, scale=2), nullable=False)  # 0-100
    model_version = Column(String(20))  # For tracking ML model changes
    
    # Engagement Tracking
    shown_at = Column(DateTime)
    clicked_at = Column(DateTime)
    purchased_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)  # When recommendation becomes stale
    
    # Relationships
    user = relationship("User", backref="recommendations")
    product = relationship("Product")


class SimilarProduct(Base):
    """Product similarity relationships for cross-sell"""
    __tablename__ = "similar_products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    similar_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Similarity Reason
    similarity_reason = Column(String(50), nullable=False)  # "category", "price_range", "material", "brand"
    
    # Scoring
    similarity_score = Column(Numeric(precision=5, scale=2), nullable=False)  # 0-100
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated = Column(DateTime)
    
    # Relationships
    product = relationship("Product", foreign_keys=[product_id])
    similar_product = relationship("Product", foreign_keys=[similar_product_id])


# ============================================================================
# PHASE 3: NOTIFICATION MODELS
# ============================================================================

class NotificationPreference(Base):
    """User's notification delivery preferences"""
    __tablename__ = "notification_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
    # Push Notifications
    push_orders = Column(Boolean, default=True)
    push_sent = Column(Boolean, default=False)
    push_sent_at = Column(DateTime)
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime)
    sms_sent = Column(Boolean, default=False)
    sms_sent_at = Column(DateTime)
    
    # Engagement
    read_at = Column(DateTime)
    clicked_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", backref="notifications")
