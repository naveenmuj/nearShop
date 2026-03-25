from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.permissions import get_current_user
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
    db: AsyncSession = Depends(get_db),
):
    """Search across products and shops simultaneously."""
    from app.search.service import search_unified
    result = await search_unified(db, q, lat, lng)
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
