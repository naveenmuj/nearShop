from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_customer
from app.wishlists.schemas import WishlistItemResponse, WishlistListResponse
from app.wishlists.service import add_to_wishlist, remove_from_wishlist, get_wishlist, check_price_drops

router = APIRouter(prefix="/api/v1/wishlists", tags=["wishlists"])


@router.get("/price-drops")
async def get_price_drops_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get wishlist items where the price dropped >= 5% or >= Rs.50 since saving."""
    drops = await check_price_drops(db, user_id=current_user.id)
    return {"items": drops, "total": len(drops)}


@router.post("/{product_id}", response_model=WishlistItemResponse)
async def add_to_wishlist_endpoint(
    product_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    entry = await add_to_wishlist(db, current_user.id, product_id)
    # Load product and shop for response
    from app.products.models import Product
    from app.shops.models import Shop
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    return WishlistItemResponse(
        id=entry.id,
        product_id=entry.product_id,
        product_name=product.name if product else "",
        product_price=product.price if product else entry.price_at_save,
        original_price=product.compare_price if product else None,
        product_images=product.images if product else [],
        shop_name=product.shop.name if product and product.shop else "Unknown Shop",
        shop_id=str(product.shop.id) if product and product.shop else None,
        price_at_save=entry.price_at_save,
        price_dropped=False,
        created_at=entry.created_at,
        is_available=product.is_available if product else True,
        stock_quantity=product.stock_quantity if product else None,
        low_stock_threshold=product.low_stock_threshold if product else 5,
    )


@router.delete("/{product_id}")
async def remove_from_wishlist_endpoint(
    product_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    await remove_from_wishlist(db, current_user.id, product_id)
    return {"detail": "Product removed from wishlist"}


@router.get("", response_model=WishlistListResponse)
async def get_wishlist_endpoint(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    items, total = await get_wishlist(db, current_user.id, page, per_page)
    return WishlistListResponse(
        items=[WishlistItemResponse(**item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
    )
