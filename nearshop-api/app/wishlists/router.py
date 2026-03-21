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
    # Load product for response
    from app.products.models import Product
    from sqlalchemy import select

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    return WishlistItemResponse(
        id=entry.id,
        product_id=entry.product_id,
        product_name=product.name if product else "",
        product_price=product.price if product else entry.price_at_save,
        product_images=product.images if product else [],
        price_at_save=entry.price_at_save,
        price_dropped=False,
        created_at=entry.created_at,
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
