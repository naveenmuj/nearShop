from decimal import Decimal
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class DeliveryCheckRequest(BaseModel):
    """Request to check delivery eligibility."""
    customer_lat: float = Field(..., ge=-90, le=90)
    customer_lng: float = Field(..., ge=-180, le=180)


class DeliveryCheckResponse(BaseModel):
    """Response with delivery eligibility info."""
    can_deliver: bool
    distance_km: float
    delivery_fee: float = 0
    free_above: Optional[float] = None
    min_order: Optional[float] = None
    reason: str


class PickupInfoResponse(BaseModel):
    """Pickup availability info."""
    can_pickup: bool
    is_open_now: Optional[bool] = None
    opening_hours: Optional[dict] = None
    address: Optional[str] = None
    reason: Optional[str] = None


class DeliveryZoneCreate(BaseModel):
    """Create a delivery zone for a shop."""
    zone_type: str = Field("radius", pattern="^(radius|polygon)$")
    center_lat: float = Field(..., ge=-90, le=90)
    center_lng: float = Field(..., ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0, le=50)
    polygon_coords: Optional[list[dict]] = None  # [{lat, lng}, ...]
    fee: float = Field(0, ge=0)
    free_above: Optional[float] = Field(None, ge=0)


class DeliveryZoneResponse(BaseModel):
    """Delivery zone response."""
    id: UUID
    shop_id: UUID
    zone_type: str
    center_lat: float
    center_lng: float
    radius_km: Optional[float] = None
    fee: float
    free_above: Optional[float] = None


class CartItemValidation(BaseModel):
    """Validation result for a cart item."""
    shop_id: UUID
    can_add: bool
    message: str
    delivery_fee: Optional[float] = None
    min_order_message: Optional[str] = None
    order_total: float = 0


class CartValidationRequest(BaseModel):
    """Request to validate entire cart."""
    customer_lat: float = Field(..., ge=-90, le=90)
    customer_lng: float = Field(..., ge=-180, le=180)
    items: list[dict] = Field(...)  # [{shop_id, product_id, quantity}, ...]


class CartValidationResponse(BaseModel):
    """Cart validation response."""
    can_checkout: bool
    items_validation: list[CartItemValidation]
    total_fees: float = 0
    warnings: list[str] = []
    errors: list[str] = []
