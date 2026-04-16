"""
Pydantic Schemas for Missing Features
Request/Response validation and serialization
"""

from datetime import datetime, time
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, EmailStr, validator, Field
import uuid


# ============================================================================
# PHASE 1: ADDRESS SCHEMAS
# ============================================================================

class AddressBase(BaseModel):
    label: Optional[str] = Field(None, max_length=50)  # "Home", "Office"
    street: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., min_length=1, max_length=20)
    country: str = "India"
    phone: str = Field(..., min_length=10, max_length=20)
    alternate_phone: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    
    @validator('phone', 'alternate_phone')
    def validate_phone(cls, v):
        if v and not v.replace('+', '').replace('-', '').isdigit():
            raise ValueError('Invalid phone number format')
        return v


class AddressCreate(AddressBase):
    is_default: bool = False
    is_billing: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None


class AddressResponse(AddressBase):
    id: uuid.UUID
    is_default: bool
    is_billing: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AddressListResponse(BaseModel):
    addresses: List[AddressResponse]
    total: int
    default_address_id: Optional[uuid.UUID] = None


# ============================================================================
# PHASE 1: PAYMENT METHOD SCHEMAS
# ============================================================================

class PaymentMethodBase(BaseModel):
    payment_type: str = Field(..., pattern="^(razorpay_card|upi|wallet)$")
    display_name: Optional[str] = None
    is_active: bool = True


class CardPaymentCreate(PaymentMethodBase):
    payment_type: str = "razorpay_card"
    card_token: str  # Razorpay token
    card_last_4: str = Field(..., min_length=4, max_length=4)
    card_brand: str  # "visa", "mastercard", "amex"
    card_expiry: str  # MM/YY


class UPIPaymentCreate(PaymentMethodBase):
    payment_type: str = "upi"
    upi_id: str = Field(..., pattern=r'^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$')


class WalletPaymentCreate(PaymentMethodBase):
    payment_type: str = "wallet"
    wallet_id: str
    wallet_balance: Decimal


class PaymentMethodResponse(PaymentMethodBase):
    id: uuid.UUID
    payment_type: str
    card_last_4: Optional[str] = None
    card_brand: Optional[str] = None
    upi_id: Optional[str] = None
    wallet_id: Optional[str] = None
    is_default: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentMethodListResponse(BaseModel):
    methods: List[PaymentMethodResponse]
    total: int
    default_method_id: Optional[uuid.UUID] = None


# ============================================================================
# PHASE 1: USER PROFILE SCHEMAS
# ============================================================================

class UserProfileBase(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    preferred_language: str = "en"
    timezone: str = "Asia/Kolkata"


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileResponse(UserProfileBase):
    id: uuid.UUID
    user_id: uuid.UUID
    avatar_url: Optional[str] = None
    total_orders: int
    total_spent: Decimal
    avg_rating: Optional[Decimal] = None
    badges: Optional[List[str]] = None
    phone_verified_at: Optional[datetime] = None
    email_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PublicProfileResponse(BaseModel):
    """Public-facing profile (limited info)"""
    id: uuid.UUID
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    total_orders: int
    avg_rating: Optional[Decimal] = None
    badges: Optional[List[str]] = None


# ============================================================================
# PHASE 2: SEARCH HISTORY SCHEMAS
# ============================================================================

class SearchHistoryCreate(BaseModel):
    search_query: str = Field(..., min_length=1, max_length=500)
    search_type: str = Field(..., pattern="^(product|shop|combined)$")
    filters: Optional[Dict[str, Any]] = None
    result_count: Optional[int] = None
    clicked_result_id: Optional[uuid.UUID] = None


class SearchHistoryResponse(SearchHistoryCreate):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class SearchSuggestion(BaseModel):
    """Suggestion based on search history"""
    query: str
    type: str
    last_searched: datetime


# ============================================================================
# PHASE 2: RECOMMENDATION SCHEMAS
# ============================================================================

class ProductRecommendationResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_image: Optional[str] = None
    price: Decimal
    rating: Optional[Decimal] = None
    reason: str
    score: Decimal
    
    class Config:
        from_attributes = True


class RecommendationsResponse(BaseModel):
    recommendations: List[ProductRecommendationResponse]
    total: int
    reason: str  # Why showing these (e.g., "For You", "Trending")


class SimilarProductResponse(BaseModel):
    id: uuid.UUID
    product_name: str
    product_image: Optional[str] = None
    price: Decimal
    rating: Optional[Decimal] = None
    similarity_reason: str
    similarity_score: Decimal


class SimilarProductsResponse(BaseModel):
    product_id: uuid.UUID
    similar_products: List[SimilarProductResponse]
    total: int


# ============================================================================
# PHASE 3: NOTIFICATION SCHEMAS
# ============================================================================

class NotificationPreferenceUpdate(BaseModel):
    # Push
    push_orders: Optional[bool] = None
    push_deals: Optional[bool] = None
    push_messages: Optional[bool] = None
    push_news: Optional[bool] = None
    
    # Email
    email_orders: Optional[bool] = None
    email_deals: Optional[bool] = None
    email_weekly_digest: Optional[bool] = None
    email_news: Optional[bool] = None
    
    # SMS
    sms_orders: Optional[bool] = None
    sms_deals: Optional[bool] = None
    
    # Quiet Hours
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None


class NotificationPreferenceResponse(NotificationPreferenceUpdate):
    id: uuid.UUID
    user_id: uuid.UUID
    updated_at: datetime
    
    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    type: str  # "order_status", "price_drop", "message", "deal"
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


class NotificationResponse(NotificationCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    read_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class BulkNotificationRequest(BaseModel):
    """For admin to send notifications to multiple users"""
    user_ids: List[uuid.UUID]
    type: str
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    channels: List[str] = ["push", "email", "sms"]  # Which channels to use


# ============================================================================
# AVATAR UPLOAD SCHEMAS
# ============================================================================

class AvatarUploadResponse(BaseModel):
    avatar_url: str
    avatar_key: str
    updated_at: datetime


# ============================================================================
# ERROR RESPONSE SCHEMAS
# ============================================================================

class ErrorResponse(BaseModel):
    detail: str
    error_code: str
    timestamp: datetime


class ValidationErrorResponse(BaseModel):
    detail: str
    errors: List[Dict[str, Any]]
