from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user_optional, require_business
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
    from sqlalchemy import select, and_, or_
    from app.products.models import Product
    from app.shops.models import Shop

    prefix = f"{q}%"
    broad = f"%{q}%"

    product_rows = await db.execute(
        select(Product.id, Product.name, Product.category)
        .where(and_(Product.is_available == True, Product.name.ilike(broad)))
        .order_by(Product.view_count.desc())
        .limit(6)
    )
    products = [
        {"id": str(r.id), "name": r.name, "type": "product", "category": r.category}
        for r in product_rows.fetchall()
    ]

    shop_rows = await db.execute(
        select(Shop.id, Shop.name, Shop.category)
        .where(and_(
            Shop.is_active == True,
            or_(Shop.name.ilike(broad), Shop.category.ilike(broad)),
        ))
        .order_by(Shop.score.desc())
        .limit(4)
    )
    shops = [
        {"id": str(r.id), "name": r.name, "type": "shop", "category": r.category}
        for r in shop_rows.fetchall()
    ]

    return {"suggestions": products[:6] + shops[:4]}


@router.get("/search", response_model=ProductListResponse)
async def search_products_endpoint(
    q: Optional[str] = Query(None),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: Optional[float] = Query(None, gt=0, le=50),
    category: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    sort_by: Optional[str] = Query(None, pattern="^(price_asc|price_desc|newest|popular)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    products, total = await search_products(
        db, q, lat, lng, radius_km, category, min_price, max_price, sort_by, page, per_page,
        current_user.id if current_user else None,
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


@router.post("/bulk")
async def bulk_create_products(
    products_data: list[ProductCreate],
    shop_id: UUID = Query(...),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple products at once. Accepts a JSON array of products."""
    created = []
    errors = []
    for i, body in enumerate(products_data):
        try:
            product = await create_product(db, shop_id, current_user.id, body)
            created.append({"index": i, "id": str(product.id), "name": product.name})
        except Exception as e:
            errors.append({"index": i, "name": body.name, "error": str(e)})
    return {
        "created_count": len(created),
        "error_count": len(errors),
        "created": created,
        "errors": errors,
    }


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


@router.get("/{product_id}/analytics")
async def get_product_analytics(
    product_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics for a product owned by the current user."""
    from sqlalchemy import select, func, and_
    from datetime import datetime, timedelta
    from app.orders.models import Order
    from app.products.models import Product, Wishlist

    # Get product and verify ownership
    product = await get_product(db, product_id)
    if not product:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify the shop belongs to this user
    from app.shops.models import Shop
    shop_result = await db.execute(
        select(Shop).where(and_(Shop.id == product.shop_id, Shop.owner_id == current_user.id))
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view this product's analytics")

    # Calculate analytics
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    
    # Get orders containing this product
    orders_result = await db.execute(
        select(Order).where(
            and_(
                Order.shop_id == product.shop_id,
                Order.status.in_(['confirmed', 'completed', 'delivered'])
            )
        )
    )
    orders = orders_result.scalars().all()
    
    # Calculate order stats for this product
    total_orders = 0
    total_quantity_sold = 0
    total_revenue = 0
    orders_last_30 = 0
    revenue_last_30 = 0
    
    product_id_str = str(product_id)
    
    for order in orders:
        items = order.items or []
        for item in items:
            item_product_id = str(item.get('product_id', item.get('id', '')))
            if item_product_id == product_id_str:
                quantity = item.get('quantity', 1)
                price = float(item.get('price', product.price))
                
                total_orders += 1
                total_quantity_sold += quantity
                total_revenue += price * quantity
                
                if order.created_at and order.created_at >= thirty_days_ago:
                    orders_last_30 += 1
                    revenue_last_30 += price * quantity
    
    # Get wishlist count for this product
    wishlist_result = await db.execute(
        select(func.count(Wishlist.id)).where(Wishlist.product_id == product_id)
    )
    wishlist_count = wishlist_result.scalar() or 0
    
    # Calculate conversion rate
    total_views = product.view_count or 0
    conversion_rate = (total_orders / total_views * 100) if total_views > 0 else 0
    
    # Estimate cart count (approximation - could track separately)
    cart_count = max(0, int(wishlist_count * 0.3))  # Rough estimate
    
    # Get reviews/ratings if available
    avg_rating = 0
    review_count = 0
    try:
        from app.reviews.models import Review
        reviews_result = await db.execute(
            select(func.avg(Review.rating), func.count(Review.id))
            .where(Review.product_id == product_id)
        )
        row = reviews_result.fetchone()
        if row:
            avg_rating = float(row[0]) if row[0] else 0
            review_count = row[1] or 0
    except Exception:
        pass  # Reviews table may not exist or have different schema
    
    return {
        "product_id": str(product_id),
        "total_views": total_views,
        "unique_views": int(total_views * 0.7),  # Approximation
        "total_orders": total_orders,
        "total_quantity_sold": total_quantity_sold,
        "total_revenue": round(total_revenue, 2),
        "wishlist_count": wishlist_count,
        "cart_count": cart_count,
        "conversion_rate": round(conversion_rate, 2),
        "avg_rating": round(avg_rating, 1),
        "review_count": review_count,
        "last_30_days": {
            "views": int(total_views * 0.4),  # Approximation for recent views
            "orders": orders_last_30,
            "revenue": round(revenue_last_30, 2),
        },
    }



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
