from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.permissions import require_business
from app.core.database import get_db
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.delivery.models import DeliveryZone
from app.delivery.schemas import (
    DeliveryZoneCreate,
    DeliveryZoneResponse,
)
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/delivery", tags=["delivery"])


@router.get("/zones/{shop_id}", response_model=list[DeliveryZoneResponse])
async def list_delivery_zones(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """List delivery zones for a business-owned shop."""
    shop = (
        await db.execute(select(Shop).where(Shop.id == shop_id).limit(1))
    ).scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if str(shop.owner_id) != str(current_user.id):
        raise ForbiddenError("You can only manage your own shop zones")

    zones = (
        await db.execute(
            select(DeliveryZone)
            .where(DeliveryZone.shop_id == shop_id)
            .order_by(DeliveryZone.created_at.desc())
        )
    ).scalars().all()

    return [
        DeliveryZoneResponse(
            id=z.id,
            shop_id=z.shop_id,
            zone_type=z.zone_type,
            center_lat=z.center_lat,
            center_lng=z.center_lng,
            radius_km=z.radius_km,
            fee=float(z.fee or 0),
            free_above=float(z.free_above) if z.free_above is not None else None,
        )
        for z in zones
    ]


@router.post("/zones/{shop_id}", response_model=DeliveryZoneResponse)
async def create_delivery_zone(
    shop_id: UUID,
    body: DeliveryZoneCreate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Create a delivery zone for a business-owned shop."""
    shop = (
        await db.execute(select(Shop).where(Shop.id == shop_id).limit(1))
    ).scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if str(shop.owner_id) != str(current_user.id):
        raise ForbiddenError("You can only manage your own shop zones")

    if body.zone_type == "radius" and not body.radius_km:
        raise BadRequestError("radius_km is required for radius zones")

    zone = DeliveryZone(
        shop_id=shop_id,
        zone_type=body.zone_type,
        center_lat=body.center_lat,
        center_lng=body.center_lng,
        radius_km=body.radius_km,
        polygon_coords=body.polygon_coords,
        fee=body.fee,
        free_above=body.free_above,
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)

    return DeliveryZoneResponse(
        id=zone.id,
        shop_id=zone.shop_id,
        zone_type=zone.zone_type,
        center_lat=zone.center_lat,
        center_lng=zone.center_lng,
        radius_km=zone.radius_km,
        fee=float(zone.fee or 0),
        free_above=float(zone.free_above) if zone.free_above is not None else None,
    )


@router.delete("/zones/{shop_id}/{zone_id}")
async def delete_delivery_zone(
    shop_id: UUID,
    zone_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Delete one delivery zone from a business-owned shop."""
    shop = (
        await db.execute(select(Shop).where(Shop.id == shop_id).limit(1))
    ).scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if str(shop.owner_id) != str(current_user.id):
        raise ForbiddenError("You can only manage your own shop zones")

    existing = (
        await db.execute(
            select(DeliveryZone).where(
                DeliveryZone.id == zone_id,
                DeliveryZone.shop_id == shop_id,
            )
        )
    ).scalar_one_or_none()
    if not existing:
        raise NotFoundError("Delivery zone not found")

    await db.execute(
        delete(DeliveryZone).where(
            DeliveryZone.id == zone_id,
            DeliveryZone.shop_id == shop_id,
        )
    )
    await db.commit()

    return {"status": "deleted", "zone_id": str(zone_id)}
