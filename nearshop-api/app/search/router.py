from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.permissions import get_current_user, get_current_user_optional
from app.search.schemas import UnifiedSearchResponse, SearchSuggestionsResponse, SearchSuggestion
from app.delivery.schemas import (
    DeliveryCheckRequest,
    DeliveryCheckResponse,
    PickupInfoResponse,
    CartValidationRequest,
    CartValidationResponse,
    CartItemValidation,
)

# Ensure all models with relationships are loaded before any query runs
import app.auth.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.stories.models  # noqa: F401
import app.delivery.models  # noqa: F401

router = APIRouter(prefix="/api/v1", tags=["search", "delivery"])


@router.get("/search/unified")
async def unified_search(
    q: str = Query(..., min_length=1, max_length=100),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    profile_id: Optional[str] = Query(None),
    include_debug: bool = Query(False),
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Search across products and shops simultaneously."""
    from app.search.service import search_unified
    result = await search_unified(
        db,
        q,
        lat,
        lng,
        user_id=current_user.id if current_user else None,
        profile_id=profile_id,
        include_debug=include_debug,
    )
    return result


@router.get("/search/suggestions", response_model=SearchSuggestionsResponse)
async def search_suggestions(
    q: str = Query(..., min_length=2, max_length=100),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """Get smart search suggestions (products + shops)."""
    try:
        from app.search.service import get_search_suggestions
        suggestions = await get_search_suggestions(db, q, lat, lng)
        return SearchSuggestionsResponse(suggestions=suggestions)
    except Exception as e:
        print(f"Error in search_suggestions: {e}")
        return SearchSuggestionsResponse(suggestions=[])


@router.post("/delivery/check/{shop_id}", response_model=DeliveryCheckResponse)
async def check_delivery(
    shop_id: UUID,
    body: DeliveryCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check if a shop can deliver to customer location."""
    from app.delivery.service import check_delivery_eligibility
    info = await check_delivery_eligibility(db, shop_id, body.customer_lat, body.customer_lng)
    return DeliveryCheckResponse(**info.to_dict())


@router.post("/delivery/pickup/{shop_id}", response_model=PickupInfoResponse)
async def get_pickup(
    shop_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get pickup information for a shop."""
    from app.delivery.service import get_pickup_info
    info = await get_pickup_info(db, shop_id)
    return PickupInfoResponse(**info)


@router.get("/delivery/nearby-shops")
async def nearby_deliverable_shops(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get shops that deliver to customer location."""
    try:
        from app.search.service import get_nearby_deliverable_shops
        shops = await get_nearby_deliverable_shops(db, lat, lng, radius_km, limit)
        return {"shops": shops}
    except Exception as e:
        print(f"Error in nearby_deliverable_shops: {e}")
        return {"shops": []}


@router.post("/cart/validate", response_model=CartValidationResponse)
async def validate_cart(
    body: CartValidationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate entire cart for delivery eligibility and minimum orders."""
    from sqlalchemy import select
    from app.shops.models import Shop

    items_validation = []
    total_fees = 0
    warnings = []
    errors = []
    can_checkout = True

    # Group items by shop
    shops_items = {}
    for item in body.items:
        shop_id = item.get("shop_id")
        if shop_id not in shops_items:
            shops_items[shop_id] = []
        shops_items[shop_id].append(item)

    # Validate each shop's items
    for shop_id_str, items in shops_items.items():
        try:
            shop_id = UUID(shop_id_str)
        except (ValueError, TypeError):
            errors.append(f"Invalid shop ID: {shop_id_str}")
            can_checkout = False
            continue

        # Check delivery
        from app.delivery.service import check_delivery_eligibility

        delivery_info = await check_delivery_eligibility(
            db, shop_id, body.customer_lat, body.customer_lng
        )

        # Calculate order total for this shop
        order_total = 0
        for item in items:
            # In real scenario, would fetch product price from DB
            order_total += item.get("quantity", 1) * item.get("price", 0)

        if delivery_info.can_deliver:
            fee = delivery_info.delivery_fee
            if delivery_info.free_above and order_total >= float(delivery_info.free_above):
                fee = 0

            total_fees += fee

            items_validation.append(
                CartItemValidation(
                    shop_id=shop_id,
                    can_add=True,
                    message="Ready to checkout",
                    delivery_fee=float(fee),
                    order_total=order_total,
                )
            )

            # Check min order
            if delivery_info.min_order and order_total < float(delivery_info.min_order):
                min_order_msg = f"Minimum order: ₹{delivery_info.min_order}"
                items_validation[-1].min_order_message = min_order_msg
                warnings.append(f"{min_order_msg} at this shop")
                can_checkout = False
        else:
            items_validation.append(
                CartItemValidation(
                    shop_id=shop_id,
                    can_add=False,
                    message=delivery_info.reason,
                    order_total=order_total,
                )
            )
            errors.append(f"Cannot deliver from this shop: {delivery_info.reason}")
            can_checkout = False

    return CartValidationResponse(
        can_checkout=can_checkout,
        items_validation=items_validation,
        total_fees=total_fees,
        warnings=warnings,
        errors=errors,
    )


def _check_is_open_now(opening_hours: dict | None) -> bool:
    """Check if a shop is currently open."""
    if not opening_hours:
        return False
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    day_name = now.strftime("%A").lower()
    today_hours = opening_hours.get(day_name)
    if not today_hours:
        return False
    try:
        open_time = datetime.strptime(today_hours.get("open", ""), "%H:%M").time()
        close_time = datetime.strptime(today_hours.get("close", ""), "%H:%M").time()
        return open_time <= now.time() <= close_time
    except (ValueError, AttributeError):
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# SEARCH PERSONALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import List

from app.auth.models import User
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop


class SearchHistoryEntry(BaseModel):
    query: str
    timestamp: str


class PersonalizedRecommendation(BaseModel):
    type: str  # "product", "shop", "category"
    id: str
    name: str
    reason: str  # "Previously purchased", "Similar to your orders", etc.
    image: str | None = None
    price: float | None = None


@router.post("/search/log")
async def log_search(
    q: Optional[str] = Query(None, min_length=1, max_length=100),
    body: Optional[dict] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a user search query from either query params or JSON body."""
    if not current_user:
        return {"status": "skipped", "reason": "anonymous user"}

    query_value = q
    if not query_value and isinstance(body, dict):
        query_value = body.get("query") or body.get("q")
    query_value = (query_value or "").strip()
    if not query_value:
        return {"status": "skipped", "reason": "empty query"}

    from app.auth.models import SearchLog

    new_log = SearchLog(
        user_id=current_user.id,
        query=query_value.lower(),
        query_text=query_value.lower(),
        search_type="text",
    )
    db.add(new_log)
    await db.commit()

    return {"status": "logged", "query": query_value}


@router.get("/search/history")
async def get_search_history(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's recent search history from SearchLog table."""
    if not current_user:
        return {"history": []}

    from app.auth.models import SearchLog

    result = await db.execute(
        select(SearchLog.query, SearchLog.created_at)
        .where(SearchLog.user_id == current_user.id, SearchLog.query.isnot(None))
        .order_by(desc(SearchLog.created_at))
        .limit(limit * 3)
    )

    seen = set()
    unique_history = []
    for row in result.fetchall():
        query_text = row[0]
        if query_text and query_text not in seen:
            seen.add(query_text)
            unique_history.append({
                "query": query_text,
                "timestamp": row[1].isoformat() if row[1] else None,
            })
            if len(unique_history) >= limit:
                break

    return {"history": unique_history}


@router.delete("/search/history")
async def clear_search_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear user's search history."""
    if not current_user:
        return {"status": "skipped"}

    from app.auth.models import SearchLog

    await db.execute(
        select(SearchLog).where(SearchLog.user_id == current_user.id)
    )
    from sqlalchemy import delete as sa_delete
    await db.execute(
        sa_delete(SearchLog).where(SearchLog.user_id == current_user.id)
    )
    await db.commit()

    return {"status": "cleared"}


@router.get("/recommendations/for-you")
async def get_personalized_recommendations(
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get personalized product and shop recommendations based on:
    - Order history
    - Search history
    - Browsing patterns
    """
    recommendations = []
    
    if not current_user:
        # Return popular items for anonymous users
        popular_products = await db.execute(
            select(Product.id, Product.name, Product.price, Product.images, Product.category)
            .where(Product.is_available == True)
            .order_by(Product.view_count.desc())
            .limit(limit)
        )
        
        for prod in popular_products.fetchall():
            recommendations.append({
                "type": "product",
                "id": str(prod[0]),
                "name": prod[1],
                "price": float(prod[2]),
                "image": prod[3][0] if prod[3] else None,
                "category": prod[4],
                "reason": "Popular in your area",
            })
        
        return {"recommendations": recommendations, "personalized": False}
    
    # Get user's order history for recommendations
    orders_result = await db.execute(
        select(Order)
        .where(Order.customer_id == current_user.id)
        .order_by(Order.created_at.desc())
        .limit(20)
    )
    orders = orders_result.scalars().all()
    
    # Extract frequently ordered products
    product_counts = {}
    shop_counts = {}
    categories_ordered = set()
    
    for order in orders:
        shop_counts[str(order.shop_id)] = shop_counts.get(str(order.shop_id), 0) + 1
        
        items = order.items or []
        if isinstance(items, str):
            import json
            items = json.loads(items)
        
        for item in items:
            product_id = item.get("product_id")
            if product_id:
                product_counts[product_id] = product_counts.get(product_id, 0) + item.get("quantity", 1)
            category = item.get("category")
            if category:
                categories_ordered.add(category)
    
    # Recommend frequently ordered products (reorder suggestions)
    if product_counts:
        top_product_ids = sorted(product_counts, key=product_counts.get, reverse=True)[:5]
        
        for prod_id in top_product_ids:
            try:
                prod_result = await db.execute(
                    select(Product.id, Product.name, Product.price, Product.images, Product.category)
                    .where(Product.id == prod_id, Product.is_available == True)
                )
                prod = prod_result.first()
                if prod:
                    recommendations.append({
                        "type": "product",
                        "id": str(prod[0]),
                        "name": prod[1],
                        "price": float(prod[2]),
                        "image": prod[3][0] if prod[3] else None,
                        "category": prod[4],
                        "reason": "Buy again",
                    })
            except Exception:
                pass
    
    # Recommend favorite shops
    if shop_counts:
        top_shop_ids = sorted(shop_counts, key=shop_counts.get, reverse=True)[:3]
        
        for shop_id in top_shop_ids:
            try:
                from uuid import UUID as UUIDType
                shop_result = await db.execute(
                    select(Shop.id, Shop.name, Shop.category, Shop.logo_url)
                    .where(Shop.id == UUIDType(shop_id), Shop.is_active == True)
                )
                shop = shop_result.first()
                if shop:
                    recommendations.append({
                        "type": "shop",
                        "id": str(shop[0]),
                        "name": shop[1],
                        "category": shop[2],
                        "image": shop[3],
                        "reason": f"Ordered {shop_counts[shop_id]} times",
                    })
            except Exception:
                pass
    
    # Recommend products from categories user orders from
    if categories_ordered and len(recommendations) < limit:
        for category in list(categories_ordered)[:3]:
            cat_products = await db.execute(
                select(Product.id, Product.name, Product.price, Product.images, Product.category)
                .where(
                    Product.is_available == True,
                    Product.category.ilike(f"%{category}%"),
                )
                .order_by(Product.view_count.desc())
                .limit(3)
            )
            
            existing_ids = {r["id"] for r in recommendations}
            for prod in cat_products.fetchall():
                if str(prod[0]) not in existing_ids and len(recommendations) < limit:
                    recommendations.append({
                        "type": "product",
                        "id": str(prod[0]),
                        "name": prod[1],
                        "price": float(prod[2]),
                        "image": prod[3][0] if prod[3] else None,
                        "category": prod[4],
                        "reason": f"Because you like {category}",
                    })
    
    # Fill remaining with popular products
    if len(recommendations) < limit:
        existing_ids = {r["id"] for r in recommendations}
        popular_products = await db.execute(
            select(Product.id, Product.name, Product.price, Product.images, Product.category)
            .where(Product.is_available == True)
            .order_by(Product.view_count.desc())
            .limit(limit - len(recommendations) + 5)
        )
        
        for prod in popular_products.fetchall():
            if str(prod[0]) not in existing_ids and len(recommendations) < limit:
                recommendations.append({
                    "type": "product",
                    "id": str(prod[0]),
                    "name": prod[1],
                    "price": float(prod[2]),
                    "image": prod[3][0] if prod[3] else None,
                    "category": prod[4],
                    "reason": "Popular near you",
                })
    
    return {"recommendations": recommendations[:limit], "personalized": True}
