from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import haversine_distance_km_value
from app.shops.models import Shop
from app.delivery.models import DeliveryZone


class DeliveryInfo:
    """Encapsulates delivery information for a shop to a customer location."""

    def __init__(
        self,
        can_deliver: bool,
        distance_km: float,
        delivery_fee: Decimal = Decimal("0"),
        free_above: Optional[Decimal] = None,
        min_order: Optional[Decimal] = None,
        reason: str = "",
        zone_id: Optional[UUID] = None,
    ):
        self.can_deliver = can_deliver
        self.distance_km = round(distance_km, 2)
        self.delivery_fee = Decimal(str(delivery_fee))
        self.free_above = free_above
        self.min_order = min_order
        self.reason = reason
        self.zone_id = zone_id

    def to_dict(self):
        return {
            "can_deliver": self.can_deliver,
            "distance_km": self.distance_km,
            "delivery_fee": float(self.delivery_fee),
            "free_above": float(self.free_above) if self.free_above else None,
            "min_order": float(self.min_order) if self.min_order else None,
            "reason": self.reason,
        }


async def check_delivery_eligibility(
    db: AsyncSession,
    shop_id: UUID,
    customer_lat: float,
    customer_lng: float,
) -> DeliveryInfo:
    """
    Check if a shop can deliver to customer location.

    Returns: DeliveryInfo with eligibility and details.
    """
    # Get shop
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()

    if not shop:
        return DeliveryInfo(
            can_deliver=False,
            distance_km=0,
            reason="Shop not found"
        )

    # Check if delivery is enabled
    if not shop.delivery_options or "delivery" not in shop.delivery_options:
        return DeliveryInfo(
            can_deliver=False,
            distance_km=0,
            reason="Delivery not available (pickup only)"
        )

    if shop.latitude is None or shop.longitude is None:
        return DeliveryInfo(
            can_deliver=False,
            distance_km=0,
            reason="Delivery unavailable (shop location not configured)",
        )

    # Calculate distance
    distance_km = haversine_distance_km_value(
        customer_lat, customer_lng, shop.latitude, shop.longitude
    )

    # Check radius
    if shop.delivery_radius and distance_km > shop.delivery_radius:
        return DeliveryInfo(
            can_deliver=False,
            distance_km=distance_km,
            reason=f"Too far (shop delivers up to {shop.delivery_radius}km)"
        )

    # Eligible!
    return DeliveryInfo(
        can_deliver=True,
        distance_km=distance_km,
        delivery_fee=shop.delivery_fee or Decimal("0"),
        free_above=shop.free_delivery_above,
        min_order=shop.min_order,
        reason="Delivers to you"
    )


async def get_pickup_info(
    db: AsyncSession,
    shop_id: UUID,
) -> dict:
    """Get pickup information for a shop."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()

    if not shop:
        return {"can_pickup": False, "reason": "Shop not found"}

    if not shop.delivery_options or "pickup" not in shop.delivery_options:
        return {"can_pickup": False, "reason": "Pickup not available"}

    is_open = _check_is_open_now(shop.opening_hours)

    return {
        "can_pickup": True,
        "is_open_now": is_open,
        "opening_hours": shop.opening_hours,
        "address": shop.address,
    }


def _check_is_open_now(opening_hours: dict | None) -> bool:
    """Check if a shop is currently open based on opening_hours."""
    if not opening_hours:
        return False
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


async def get_nearby_deliverable_shops(
    db: AsyncSession,
    customer_lat: float,
    customer_lng: float,
    radius_km: float = 5.0,
    limit: int = 10,
) -> list[Tuple[Shop, float]]:
    """
    Get shops that can deliver to customer location, sorted by distance.

    Returns: List of (shop, distance_km) tuples.
    """
    from sqlalchemy import select, and_, or_
    from app.core.geo import within_radius

    query = select(Shop).where(
        and_(
            Shop.is_active == True,
            within_radius(Shop.latitude, Shop.longitude, customer_lat, customer_lng, radius_km)
        )
    )

    result = await db.execute(query)
    shops = list(result.scalars().all())

    # Filter and calculate distances
    eligible = []
    for shop in shops:
        # Check if shop has delivery option (using array contains)
        if shop.delivery_options and 'delivery' in shop.delivery_options:
            if shop.latitude is None or shop.longitude is None:
                continue
            dist = haversine_distance_km_value(
                customer_lat, customer_lng, shop.latitude, shop.longitude
            )
            # Check delivery radius
            if shop.delivery_radius is None or dist <= shop.delivery_radius:
                eligible.append((shop, dist))

    # Sort by distance
    eligible.sort(key=lambda x: x[1])
    return eligible[:limit]
