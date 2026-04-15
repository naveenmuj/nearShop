from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business, require_customer, get_current_user, get_current_user_optional
from app.deals.schemas import DealCreate, DealResponse, DealListResponse
from app.deals.schemas import PersonalizedDealListResponse, PersonalizedDealResponse
from app.deals.service import (
    create_deal,
    get_nearby_deals,
    claim_deal,
    end_deal,
    get_shop_deals,
)
from app.deals.models import Coupon, CouponUsage
from app.orders.models import Order
from app.ai.personalized_deals import get_personalized_deals

router = APIRouter(prefix="/api/v1/deals", tags=["deals"])


@router.post("", response_model=DealResponse)
async def create_deal_endpoint(
    body: DealCreate,
    shop_id: UUID = Query(..., description="Shop ID to create the deal for"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deal = await create_deal(db, shop_id, current_user.id, body)
    return DealResponse.model_validate(deal)


@router.get("/nearby", response_model=DealListResponse)
async def get_nearby_deals_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    deals, total = await get_nearby_deals(
        db, lat, lng, radius_km, category, page, per_page, current_user.id if current_user else None
    )
    return DealListResponse(
        items=[DealResponse.model_validate(d) for d in deals],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/personalized", response_model=PersonalizedDealListResponse)
async def get_personalized_deals_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    deals = await get_personalized_deals(db, current_user.id, lat, lng, radius_km, limit)
    return PersonalizedDealListResponse(
        items=[PersonalizedDealResponse.model_validate(item) for item in deals],
        total=len(deals),
        page=1,
        per_page=limit,
    )


@router.post("/{deal_id}/claim", response_model=DealResponse)
async def claim_deal_endpoint(
    deal_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    deal = await claim_deal(db, deal_id, current_user.id)
    return DealResponse.model_validate(deal)


@router.delete("/{deal_id}", response_model=DealResponse)
async def end_deal_endpoint(
    deal_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deal = await end_deal(db, deal_id, current_user.id)
    return DealResponse.model_validate(deal)


@router.get("/shop/{shop_id}", response_model=list[DealResponse])
async def get_shop_deals_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deals = await get_shop_deals(db, shop_id, current_user.id)
    return [DealResponse.model_validate(d) for d in deals]


# ═══════════════════════════════════════════════════════════════════════════════
# COUPON SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class CouponCreate(BaseModel):
    code: str
    discount_type: str = "percentage"  # 'percentage' or 'fixed'
    discount_value: float
    max_discount: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    applicable_categories: Optional[list[str]] = None
    first_order_only: bool = False
    description: Optional[str] = None


class CouponResponse(BaseModel):
    id: str
    code: str
    shop_id: Optional[str]
    discount_type: str
    discount_value: float
    max_discount: Optional[float]
    min_order_amount: Optional[float]
    max_uses: Optional[int]
    max_uses_per_user: int
    current_uses: int
    starts_at: Optional[datetime]
    expires_at: Optional[datetime]
    is_active: bool
    applicable_categories: Optional[list[str]]
    first_order_only: bool
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ApplyCouponRequest(BaseModel):
    code: str
    shop_id: Optional[str] = None
    order_amount: float


class ApplyCouponResponse(BaseModel):
    valid: bool
    discount_amount: float
    message: str
    coupon: Optional[CouponResponse] = None


# ═══════════════════════════════════════════════════════════════════════════════
# COUPON ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/coupons", response_model=CouponResponse)
async def create_coupon(
    body: CouponCreate,
    shop_id: Optional[UUID] = Query(None, description="Shop ID for shop-specific coupon"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Create a new coupon/promo code. Shop owners can create shop-specific coupons."""
    # Verify shop ownership if shop_id provided
    if shop_id:
        from app.shops.models import Shop
        shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
        shop = shop_result.scalar_one_or_none()
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized for this shop")
    
    # Check if code already exists
    existing = await db.execute(
        select(Coupon).where(func.upper(Coupon.code) == body.code.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    coupon = Coupon(
        code=body.code.upper(),
        shop_id=shop_id,
        discount_type=body.discount_type,
        discount_value=body.discount_value,
        max_discount=body.max_discount,
        min_order_amount=body.min_order_amount,
        max_uses=body.max_uses,
        max_uses_per_user=body.max_uses_per_user,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        applicable_categories=body.applicable_categories,
        first_order_only=body.first_order_only,
        description=body.description,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    
    return CouponResponse(
        id=str(coupon.id),
        code=coupon.code,
        shop_id=str(coupon.shop_id) if coupon.shop_id else None,
        discount_type=coupon.discount_type,
        discount_value=float(coupon.discount_value),
        max_discount=float(coupon.max_discount) if coupon.max_discount else None,
        min_order_amount=float(coupon.min_order_amount) if coupon.min_order_amount else None,
        max_uses=coupon.max_uses,
        max_uses_per_user=coupon.max_uses_per_user,
        current_uses=coupon.current_uses,
        starts_at=coupon.starts_at,
        expires_at=coupon.expires_at,
        is_active=coupon.is_active,
        applicable_categories=coupon.applicable_categories,
        first_order_only=coupon.first_order_only,
        description=coupon.description,
        created_at=coupon.created_at,
    )


@router.get("/coupons", response_model=list[CouponResponse])
async def list_coupons(
    shop_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """List coupons for a shop."""
    if not shop_id:
        from app.shops.models import Shop
        shop_result = await db.execute(
            select(Shop).where(Shop.owner_id == current_user.id).limit(1)
        )
        shop = shop_result.scalar_one_or_none()
        if shop:
            shop_id = shop.id
    
    query = select(Coupon).where(Coupon.shop_id == shop_id).order_by(Coupon.created_at.desc())
    result = await db.execute(query)
    coupons = result.scalars().all()
    
    return [
        CouponResponse(
            id=str(c.id),
            code=c.code,
            shop_id=str(c.shop_id) if c.shop_id else None,
            discount_type=c.discount_type,
            discount_value=float(c.discount_value),
            max_discount=float(c.max_discount) if c.max_discount else None,
            min_order_amount=float(c.min_order_amount) if c.min_order_amount else None,
            max_uses=c.max_uses,
            max_uses_per_user=c.max_uses_per_user,
            current_uses=c.current_uses,
            starts_at=c.starts_at,
            expires_at=c.expires_at,
            is_active=c.is_active,
            applicable_categories=c.applicable_categories,
            first_order_only=c.first_order_only,
            description=c.description,
            created_at=c.created_at,
        )
        for c in coupons
    ]


@router.post("/coupons/validate", response_model=ApplyCouponResponse)
async def validate_coupon(
    body: ApplyCouponRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate a coupon code and calculate discount."""
    now = datetime.now(timezone.utc)
    
    # Find the coupon
    result = await db.execute(
        select(Coupon).where(func.upper(Coupon.code) == body.code.upper())
    )
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="Invalid coupon code")
    
    # Check if active
    if not coupon.is_active:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon is no longer active")
    
    # Check validity period
    if coupon.starts_at and now < coupon.starts_at:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon is not yet valid")
    
    if coupon.expires_at and now > coupon.expires_at:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon has expired")
    
    # Check shop restriction
    if coupon.shop_id and body.shop_id:
        if str(coupon.shop_id) != body.shop_id:
            return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon not valid for this shop")
    
    # Check minimum order amount
    if coupon.min_order_amount and body.order_amount < float(coupon.min_order_amount):
        return ApplyCouponResponse(
            valid=False, 
            discount_amount=0, 
            message=f"Minimum order amount is ₹{coupon.min_order_amount}"
        )
    
    # Check max uses
    if coupon.max_uses and coupon.current_uses >= coupon.max_uses:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon usage limit reached")
    
    # Check user's usage
    user_usage_result = await db.execute(
        select(func.count()).select_from(CouponUsage).where(
            CouponUsage.coupon_id == coupon.id,
            CouponUsage.user_id == current_user.id
        )
    )
    user_usage_count = user_usage_result.scalar() or 0
    
    if user_usage_count >= coupon.max_uses_per_user:
        return ApplyCouponResponse(valid=False, discount_amount=0, message="You have already used this coupon")
    
    # Check first order only
    if coupon.first_order_only:
        orders_result = await db.execute(
            select(func.count()).select_from(Order).where(
                Order.customer_id == current_user.id,
                Order.status != "cancelled"
            )
        )
        order_count = orders_result.scalar() or 0
        if order_count > 0:
            return ApplyCouponResponse(valid=False, discount_amount=0, message="Coupon only valid for first order")
    
    # Calculate discount
    if coupon.discount_type == "percentage":
        discount = body.order_amount * (float(coupon.discount_value) / 100)
        if coupon.max_discount:
            discount = min(discount, float(coupon.max_discount))
    else:
        discount = float(coupon.discount_value)
    
    # Discount cannot exceed order amount
    discount = min(discount, body.order_amount)
    
    return ApplyCouponResponse(
        valid=True,
        discount_amount=round(discount, 2),
        message=f"Coupon applied! You save ₹{round(discount, 2)}",
        coupon=CouponResponse(
            id=str(coupon.id),
            code=coupon.code,
            shop_id=str(coupon.shop_id) if coupon.shop_id else None,
            discount_type=coupon.discount_type,
            discount_value=float(coupon.discount_value),
            max_discount=float(coupon.max_discount) if coupon.max_discount else None,
            min_order_amount=float(coupon.min_order_amount) if coupon.min_order_amount else None,
            max_uses=coupon.max_uses,
            max_uses_per_user=coupon.max_uses_per_user,
            current_uses=coupon.current_uses,
            starts_at=coupon.starts_at,
            expires_at=coupon.expires_at,
            is_active=coupon.is_active,
            applicable_categories=coupon.applicable_categories,
            first_order_only=coupon.first_order_only,
            description=coupon.description,
            created_at=coupon.created_at,
        )
    )


@router.post("/coupons/{coupon_id}/use")
async def use_coupon(
    coupon_id: UUID,
    order_id: Optional[UUID] = Query(None),
    discount_applied: float = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record coupon usage after order placement."""
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Record usage
    usage = CouponUsage(
        coupon_id=coupon_id,
        user_id=current_user.id,
        order_id=order_id,
        discount_applied=discount_applied,
    )
    db.add(usage)
    
    # Increment usage count
    coupon.current_uses += 1
    
    await db.commit()
    
    return {"message": "Coupon usage recorded", "usage_id": str(usage.id)}


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Delete/deactivate a coupon."""
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Verify ownership
    if coupon.shop_id:
        from app.shops.models import Shop
        shop_result = await db.execute(select(Shop).where(Shop.id == coupon.shop_id))
        shop = shop_result.scalar_one_or_none()
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    coupon.is_active = False
    await db.commit()
    
    return {"message": "Coupon deactivated"}
