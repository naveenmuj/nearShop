import io
from typing import Optional
from uuid import UUID

import qrcode
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_
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


@router.get("/mine", response_model=list[ShopResponse])
async def get_my_shops(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all shops owned by the authenticated user."""
    result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id).order_by(Shop.created_at))
    shops = list(result.scalars().all())
    return [ShopResponse.model_validate(s) for s in shops]


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
