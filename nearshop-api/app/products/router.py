from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
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


@router.get("/suggestions")
async def search_suggestions_endpoint(
    q: str = Query(..., min_length=1, max_length=60),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """Fast autocomplete suggestions: prefix-match product & shop names."""
    from sqlalchemy import select, and_
    from app.products.models import Product
    from app.shops.models import Shop

    prefix = f"{q}%"
    broad = f"%{q}%"

    product_rows = await db.execute(
        select(Product.id, Product.name, Product.category)
        .where(and_(Product.is_available == True, Product.name.ilike(prefix)))
        .order_by(Product.view_count.desc())
        .limit(5)
    )
    products = [{"id": str(r.id), "name": r.name, "type": "product", "category": r.category} for r in product_rows.fetchall()]

    # Broaden if prefix returned few results
    if len(products) < 3:
        extra = await db.execute(
            select(Product.id, Product.name, Product.category)
            .where(and_(Product.is_available == True, Product.name.ilike(broad)))
            .order_by(Product.view_count.desc())
            .limit(6 - len(products))
        )
        seen_ids = {p["id"] for p in products}
        for r in extra.fetchall():
            if str(r.id) not in seen_ids:
                products.append({"id": str(r.id), "name": r.name, "type": "product", "category": r.category})

    shop_rows = await db.execute(
        select(Shop.id, Shop.name, Shop.category)
        .where(and_(Shop.is_active == True, or_(Shop.name.ilike(prefix), Shop.category.ilike(broad))))
        .order_by(Shop.score.desc())
        .limit(4)
    )
    shops = [{"id": str(r.id), "name": r.name, "type": "shop", "category": r.category} for r in shop_rows.fetchall()]

    return {"suggestions": products[:6] + shops[:4]}


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
