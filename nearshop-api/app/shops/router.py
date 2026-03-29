import io
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

import qrcode
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.shops.models import Shop
from app.shops.schemas import (
    ShopCreate,
    ShopUpdate,
    ShopResponse,
    ShopListResponse,
)
from app.shops.service import (
    create_shop,
    update_shop,
    get_shop,
    get_nearby_shops,
    search_shops,
    follow_shop,
    unfollow_shop,
)
from app.products.schemas import ProductResponse, ProductListResponse
from app.products.service import get_shop_products

router = APIRouter(prefix="/api/v1/shops", tags=["shops"])


@router.post("", response_model=ShopResponse)
async def create_shop_endpoint(
    body: ShopCreate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop = await create_shop(db, current_user.id, body)
    return ShopResponse.model_validate(shop)


@router.put("/{shop_id}", response_model=ShopResponse)
async def update_shop_endpoint(
    shop_id: UUID,
    body: ShopUpdate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop = await update_shop(db, shop_id, current_user.id, body)
    return ShopResponse.model_validate(shop)


@router.get("/nearby", response_model=ShopListResponse)
async def get_nearby_shops_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    category: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = {}
    if category:
        filters["category"] = category
    if min_rating is not None:
        filters["min_rating"] = min_rating

    shops, total = await get_nearby_shops(
        db, lat, lng, radius_km, filters, page, per_page
    )
    return ShopListResponse(
        items=[ShopResponse.model_validate(s) for s in shops],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/search", response_model=ShopListResponse)
async def search_shops_endpoint(
    q: str = Query(..., min_length=1),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    shops = await search_shops(db, q, lat, lng)
    items = [ShopResponse.model_validate(s) for s in shops]
    return ShopListResponse(items=items, total=len(items), page=1, per_page=len(items))


@router.get("/public/{slug}")
async def get_public_shop(slug: str, db: AsyncSession = Depends(get_db)):
    """Public shop page data — no auth required."""
    from app.products.models import Product
    from app.reviews.models import Review

    result = await db.execute(select(Shop).where(Shop.slug == slug))
    shop = result.scalar_one_or_none()
    if not shop:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Shop not found")

    products = (await db.execute(
        select(Product).where(Product.shop_id == shop.id, Product.is_available == True)
        .order_by(Product.view_count.desc()).limit(50)
    )).scalars().all()

    reviews = (await db.execute(
        select(Review).where(Review.shop_id == shop.id)
        .order_by(Review.created_at.desc()).limit(10)
    )).scalars().all()

    deals_list = []
    try:
        from app.deals.models import Deal
        now = datetime.now(timezone.utc)
        deals = (await db.execute(
            select(Deal).where(Deal.shop_id == shop.id, Deal.is_active == True, Deal.expires_at > now)
        )).scalars().all()
        deals_list = [{"title": d.title, "discount_pct": getattr(d, 'discount_pct', 0), "expires_at": str(d.expires_at)} for d in deals]
    except Exception:
        pass

    return {
        "shop": {
            "id": str(shop.id), "name": shop.name, "slug": shop.slug,
            "description": shop.description, "category": shop.category,
            "address": shop.address, "phone": shop.phone, "whatsapp": shop.whatsapp,
            "cover_image": shop.cover_image, "logo_url": getattr(shop, 'logo_url', None),
            "avg_rating": float(shop.avg_rating or 0), "total_reviews": shop.total_reviews or 0,
            "opening_hours": shop.opening_hours, "is_verified": shop.is_verified,
            "delivery_options": shop.delivery_options,
        },
        "products": [{
            "id": str(p.id), "name": p.name, "price": float(p.price),
            "compare_price": float(p.compare_price) if p.compare_price else None,
            "category": p.category, "image": p.images[0] if p.images else None,
        } for p in products],
        "reviews": [{
            "rating": r.rating, "comment": r.comment, "date": str(r.created_at),
        } for r in reviews],
        "deals": deals_list,
    }


@router.get("/mine", response_model=list[ShopResponse])
async def get_my_shops(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all shops owned by the authenticated user."""
    result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id).order_by(Shop.created_at))
    shops = list(result.scalars().all())
    return [ShopResponse.model_validate(s) for s in shops]


@router.post("/{shop_id}/toggle-status")
async def toggle_shop_status(
    shop_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle shop open/closed status."""
    from datetime import datetime, timezone
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop or shop.owner_id != current_user.id:
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Not authorized")
    shop.is_active = not shop.is_active
    await db.flush()
    await db.commit()
    return {"is_active": shop.is_active, "message": f"Shop {'opened' if shop.is_active else 'closed'}"}


@router.get("/{shop_id}/daily-summary")
async def daily_summary(
    shop_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get today's performance summary."""
    from datetime import date, datetime, timezone
    from app.orders.models import Order

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    orders_today = (await db.execute(
        select(func.count()).select_from(Order).where(Order.shop_id == shop_id, Order.created_at >= today_start)
    )).scalar() or 0
    revenue_today = float((await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.shop_id == shop_id, Order.created_at >= today_start, Order.status != "cancelled"
        )
    )).scalar() or 0)
    new_customers = (await db.execute(
        select(func.count(func.distinct(Order.customer_id))).where(
            Order.shop_id == shop_id, Order.created_at >= today_start
        )
    )).scalar() or 0

    return {
        "date": str(date.today()),
        "orders": orders_today,
        "revenue": revenue_today,
        "new_customers": new_customers,
    }


@router.get("/{shop_id}/eod-report")
async def eod_report(
    shop_id: UUID,
    report_date: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End-of-day report with WhatsApp-ready text."""
    from datetime import date as dt_date, datetime, timezone, timedelta
    from app.orders.models import Order

    if report_date:
        rd = datetime.strptime(report_date, "%Y-%m-%d").date()
    else:
        rd = dt_date.today()

    day_start = datetime.combine(rd, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    orders = (await db.execute(
        select(func.count()).select_from(Order).where(Order.shop_id == shop_id, Order.created_at >= day_start, Order.created_at < day_end)
    )).scalar() or 0
    revenue = float((await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.shop_id == shop_id, Order.created_at >= day_start, Order.created_at < day_end, Order.status != "cancelled"
        )
    )).scalar() or 0)
    cancelled = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.shop_id == shop_id, Order.created_at >= day_start, Order.created_at < day_end, Order.status == "cancelled"
        )
    )).scalar() or 0
    customers = (await db.execute(
        select(func.count(func.distinct(Order.customer_id))).where(
            Order.shop_id == shop_id, Order.created_at >= day_start, Order.created_at < day_end
        )
    )).scalar() or 0

    # Bills + Expenses (optional tables)
    bill_rev = 0
    bills_count = 0
    expenses_total = 0
    try:
        from app.billing.models import Bill
        bills_count = (await db.execute(
            select(func.count()).select_from(Bill).where(Bill.shop_id == shop_id, Bill.created_at >= day_start, Bill.created_at < day_end)
        )).scalar() or 0
        bill_rev = float((await db.execute(
            select(func.coalesce(func.sum(Bill.total), 0)).where(Bill.shop_id == shop_id, Bill.created_at >= day_start, Bill.created_at < day_end)
        )).scalar() or 0)
    except Exception:
        pass
    try:
        from app.expenses.models import Expense
        expenses_total = float((await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.shop_id == shop_id, Expense.expense_date >= day_start, Expense.expense_date < day_end
            )
        )).scalar() or 0)
    except Exception:
        pass

    total_rev = revenue + bill_rev
    profit = total_rev - expenses_total

    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    shop_name = shop.name if shop else "Shop"

    wa_text = (
        f"*{shop_name} -- Daily Report*\n"
        f"{rd.strftime('%B %d, %Y')}\n\n"
        f"Orders: {orders} ({cancelled} cancelled)\n"
        f"Revenue: Rs.{int(total_rev):,}\n"
        f"Bills: {bills_count} (Rs.{int(bill_rev):,})\n"
        f"Expenses: Rs.{int(expenses_total):,}\n"
        f"Profit: Rs.{int(profit):,}\n"
        f"Customers: {customers}\n\n"
        f"_Generated by NearShop_"
    )

    return {
        "date": str(rd),
        "orders": orders, "cancelled": cancelled,
        "order_revenue": revenue,
        "bills": bills_count, "bill_revenue": bill_rev,
        "total_revenue": total_rev,
        "expenses": expenses_total,
        "profit": profit,
        "unique_customers": customers,
        "whatsapp_text": wa_text,
    }


@router.get("/{shop_id}", response_model=ShopResponse)
async def get_shop_endpoint(
    shop_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    shop = await get_shop(db, shop_id)
    return ShopResponse.model_validate(shop)


@router.get("/{shop_id}/products", response_model=ProductListResponse)
async def get_shop_products_endpoint(
    shop_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    products, total = await get_shop_products(db, shop_id, page, per_page)
    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/{shop_id}/follow")
async def follow_shop_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    await follow_shop(db, current_user.id, shop_id)
    return {"detail": "Shop followed successfully"}


@router.delete("/{shop_id}/follow")
async def unfollow_shop_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    await unfollow_shop(db, current_user.id, shop_id)
    return {"detail": "Shop unfollowed successfully"}


@router.get("/{shop_id}/followers")
async def get_shop_followers(
    shop_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Get the list of followers for a shop (only visible to shop owner)."""
    from app.shops.models import Follow
    from app.auth.models import User as UserModel
    from datetime import datetime, timedelta
    
    # Verify this shop belongs to the current user
    shop_result = await db.execute(
        select(Shop).where(and_(Shop.id == shop_id, Shop.owner_id == current_user.id))
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view followers")
    
    # Get followers with user details
    offset = (page - 1) * per_page
    
    # Count total
    count_result = await db.execute(
        select(func.count(Follow.id)).where(Follow.shop_id == shop_id)
    )
    total = count_result.scalar() or 0
    
    # Get followers
    followers_result = await db.execute(
        select(Follow, UserModel)
        .join(UserModel, Follow.user_id == UserModel.id)
        .where(Follow.shop_id == shop_id)
        .order_by(Follow.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    
    # Calculate "new" badge threshold (e.g., last 7 days)
    new_threshold = datetime.utcnow() - timedelta(days=7)
    
    followers = []
    for follow, user in followers_result.fetchall():
        followers.append({
            "id": str(user.id),
            "name": user.name or "Customer",
            "phone": user.phone,
            "avatar_url": user.avatar_url,
            "followed_at": follow.created_at,
            "is_new": follow.created_at >= new_threshold if follow.created_at else False,
        })
    
    return {
        "items": followers,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{shop_id}/qr-code")
async def get_shop_qr_code(
    shop_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate a QR code PNG for the shop URL."""
    # Verify shop exists
    shop = await get_shop(db, shop_id)
    shop_url = f"https://nearshop.in/app/shop/{shop_id}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(shop_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.get("/{shop_id}/share-card")
async def get_shop_share_card(
    shop_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a share card JSON with shop details and top products."""
    from app.products.models import Product

    shop = await get_shop(db, shop_id)

    # Top 4 products by view_count where is_available=True
    products_result = await db.execute(
        select(Product)
        .where(
            and_(
                Product.shop_id == shop_id,
                Product.is_available == True,
            )
        )
        .order_by(Product.view_count.desc())
        .limit(4)
    )
    top_products = list(products_result.scalars().all())

    return {
        "shop_name": shop.name,
        "category": shop.category,
        "rating": float(shop.avg_rating),
        "total_reviews": shop.total_reviews,
        "address": shop.address,
        "score": float(shop.score),
        "qr_url": f"https://nearshop.in/api/v1/shops/{shop_id}/qr-code",
        "top_products": [
            {
                "name": p.name,
                "price": float(p.price),
                "image": p.images[0] if p.images else None,
            }
            for p in top_products
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SHOP VERIFICATION SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel


class VerificationRequest(BaseModel):
    document_type: str  # "gst", "pan", "aadhaar", "fssai", "trade_license"
    document_number: str
    document_image_url: Optional[str] = None
    additional_info: Optional[dict] = None


class VerificationStatusResponse(BaseModel):
    shop_id: str
    is_verified: bool
    verification_status: str  # "none", "pending", "approved", "rejected"
    submitted_documents: list
    rejection_reason: Optional[str] = None


@router.post("/{shop_id}/verification/request")
async def request_verification(
    shop_id: UUID,
    req: VerificationRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit shop verification request with documents.
    Supports: GST, PAN, Aadhaar, FSSAI, Trade License.
    """
    result = await db.execute(
        select(Shop).where(and_(Shop.id == shop_id, Shop.owner_id == current_user.id))
    )
    shop = result.scalar_one_or_none()
    
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shop not found or not authorized")
    
    if shop.is_verified:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Shop is already verified")
    
    # Store verification data in shop metadata
    metadata = shop.metadata_ or {}
    verification = metadata.get("verification", {})
    
    # Add document to verification request
    documents = verification.get("documents", [])
    documents.append({
        "type": req.document_type,
        "number": req.document_number,
        "image_url": req.document_image_url,
        "additional_info": req.additional_info,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    })
    
    verification["documents"] = documents
    verification["status"] = "pending"
    verification["requested_at"] = datetime.now(timezone.utc).isoformat()
    
    metadata["verification"] = verification
    shop.metadata_ = metadata
    
    await db.commit()
    
    return {
        "status": "success",
        "message": "Verification request submitted successfully",
        "verification_status": "pending",
        "documents_submitted": len(documents),
    }


@router.get("/{shop_id}/verification/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Get current verification status of shop."""
    result = await db.execute(
        select(Shop).where(and_(Shop.id == shop_id, Shop.owner_id == current_user.id))
    )
    shop = result.scalar_one_or_none()
    
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shop not found or not authorized")
    
    metadata = shop.metadata_ or {}
    verification = metadata.get("verification", {})
    
    return VerificationStatusResponse(
        shop_id=str(shop.id),
        is_verified=shop.is_verified,
        verification_status=verification.get("status", "none"),
        submitted_documents=[
            {"type": d["type"], "submitted_at": d.get("submitted_at")}
            for d in verification.get("documents", [])
        ],
        rejection_reason=verification.get("rejection_reason"),
    )


@router.post("/{shop_id}/verification/approve")
async def approve_verification(
    shop_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Approve shop verification (Admin only).
    In production, restrict this to admin users.
    """
    # For now, allow any authenticated user (should be admin in production)
    # TODO: Add admin role check
    
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Update verification status
    metadata = shop.metadata_ or {}
    verification = metadata.get("verification", {})
    verification["status"] = "approved"
    verification["approved_at"] = datetime.now(timezone.utc).isoformat()
    metadata["verification"] = verification
    
    shop.metadata_ = metadata
    shop.is_verified = True
    
    await db.commit()
    
    return {
        "status": "success",
        "message": "Shop verification approved",
        "shop_id": str(shop.id),
        "is_verified": True,
    }


@router.post("/{shop_id}/verification/reject")
async def reject_verification(
    shop_id: UUID,
    reason: str = Query(..., description="Reason for rejection"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reject shop verification (Admin only).
    In production, restrict this to admin users.
    """
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Update verification status
    metadata = shop.metadata_ or {}
    verification = metadata.get("verification", {})
    verification["status"] = "rejected"
    verification["rejection_reason"] = reason
    verification["rejected_at"] = datetime.now(timezone.utc).isoformat()
    metadata["verification"] = verification
    
    shop.metadata_ = metadata
    shop.is_verified = False
    
    await db.commit()
    
    return {
        "status": "success",
        "message": "Shop verification rejected",
        "shop_id": str(shop.id),
        "rejection_reason": reason,
    }
