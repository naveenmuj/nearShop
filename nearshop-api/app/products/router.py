from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business
from app.products.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)
from app.products.service import (
    create_product,
    update_product,
    delete_product,
    get_product,
    search_products,
    toggle_availability,
    get_shop_products,
)

router = APIRouter(prefix="/api/v1/products", tags=["products"])


def _product_to_response(p) -> ProductResponse:
    """Convert a Product ORM instance to a ProductResponse."""
    resp = ProductResponse.model_validate(p)
    try:
        resp.shop_name = p.shop.name if p.shop else None
    except Exception:
        resp.shop_name = None
    return resp


@router.get("/search", response_model=ProductListResponse)
async def search_products_endpoint(
    q: Optional[str] = Query(None),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: float = Query(10.0, gt=0, le=50),
    category: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    sort_by: Optional[str] = Query(None, pattern="^(price_asc|price_desc|newest|popular)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    products, total = await search_products(
        db, q, lat, lng, radius_km, category, min_price, max_price, sort_by, page, per_page
    )
    return ProductListResponse(
        items=[_product_to_response(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{product_id}/price-history")
async def get_price_history(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.products.models import PriceHistory
    result = await db.execute(
        select(PriceHistory)
        .where(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.changed_at.desc())
        .limit(30)
    )
    history = result.scalars().all()
    return [{"old_price": float(h.old_price), "new_price": float(h.new_price), "changed_at": h.changed_at} for h in history]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product_endpoint(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    product = await get_product(db, product_id)
    return _product_to_response(product)


@router.post("", response_model=ProductResponse)
async def create_product_endpoint(
    body: ProductCreate,
    shop_id: UUID = Query(..., description="The shop to add the product to"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    product = await create_product(db, shop_id, current_user.id, body)
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product_endpoint(
    product_id: UUID,
    body: ProductUpdate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    product = await update_product(db, product_id, current_user.id, body)
    return _product_to_response(product)


@router.delete("/{product_id}", response_model=ProductResponse)
async def delete_product_endpoint(
    product_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    product = await delete_product(db, product_id, current_user.id)
    return ProductResponse.model_validate(product)


@router.put("/{product_id}/availability", response_model=ProductResponse)
async def toggle_availability_endpoint(
    product_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    product = await toggle_availability(db, product_id, current_user.id)
    return _product_to_response(product)


@router.get("/{product_id}/similar", response_model=ProductListResponse)
async def get_similar_products_endpoint(
    product_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get similar products based on category and shop."""
    product = await get_product(db, product_id)
    products, total = await search_products(
        db,
        query=None,
        category=product.category,
        page=page,
        per_page=per_page,
    )
    items = [_product_to_response(p) for p in products if p.id != product_id]
    return ProductListResponse(
        items=items,
        total=max(total - 1, 0),
        page=page,
        per_page=per_page,
    )
