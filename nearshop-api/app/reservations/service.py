from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.products.models import Product
from app.reservations.models import Reservation
from app.reservations.schemas import ReserveRequest
from app.shops.models import Shop


async def create_reservation(
    db: AsyncSession,
    customer_id: UUID,
    data: ReserveRequest,
) -> Reservation:
    """Create a reservation for a product."""
    # Fetch product and its shop
    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == data.product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    if not product.is_available:
        raise BadRequestError("Product is not available")

    # Check max 2 active reservations per customer
    now = datetime.now(timezone.utc)
    active_count_result = await db.execute(
        select(func.count()).select_from(Reservation).where(
            and_(
                Reservation.customer_id == customer_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        )
    )
    active_count = active_count_result.scalar() or 0
    if active_count >= 2:
        raise BadRequestError("Maximum of 2 active reservations reached")

    reservation = Reservation(
        customer_id=customer_id,
        product_id=data.product_id,
        shop_id=product.shop_id,
        expires_at=now + timedelta(hours=2),
    )
    db.add(reservation)
    await db.flush()
    await db.refresh(reservation)

    # Attach names for response
    reservation.product_name = product.name  # type: ignore[attr-defined]
    reservation.shop_name = product.shop.name  # type: ignore[attr-defined]

    # Notify customer about their reservation
    try:
        from app.notifications.service import create_notification
        await create_notification(
            db,
            customer_id,
            "reservation_confirmed",
            reference_type="reservation",
            reference_id=reservation.id,
            product_name=product.name,
            shop_name=product.shop.name,
        )
    except Exception:
        pass  # Never break main flow for notifications

    return reservation


async def cancel_reservation(
    db: AsyncSession,
    reservation_id: UUID,
    customer_id: UUID,
) -> Reservation:
    """Cancel a reservation after verifying customer ownership."""
    result = await db.execute(
        select(Reservation).where(Reservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("Reservation not found")
    if reservation.customer_id != customer_id:
        raise ForbiddenError("You do not own this reservation")
    if reservation.status != "active":
        raise BadRequestError("Reservation is not active")

    reservation.status = "cancelled"
    await db.flush()
    await db.refresh(reservation)
    return reservation


async def fulfill_reservation(
    db: AsyncSession,
    reservation_id: UUID,
    owner_id: UUID,
) -> Reservation:
    """Mark a reservation as fulfilled after verifying shop ownership."""
    result = await db.execute(
        select(Reservation)
        .options(joinedload(Reservation.shop))
        .where(Reservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("Reservation not found")
    if reservation.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")
    if reservation.status != "active":
        raise BadRequestError("Reservation is not active")

    now = datetime.now(timezone.utc)
    reservation.status = "fulfilled"
    reservation.fulfilled_at = now
    await db.flush()
    await db.refresh(reservation)

    # Notify customer about fulfillment
    try:
        from app.notifications.service import create_notification
        from app.notifications.templates import TEMPLATES
        if "reservation_fulfilled" not in TEMPLATES:
            TEMPLATES["reservation_fulfilled"] = {
                "title": "Reservation Fulfilled",
                "body": "Your reservation at {shop_name} has been fulfilled",
            }
        await create_notification(
            db,
            reservation.customer_id,
            "reservation_fulfilled",
            reference_type="reservation",
            reference_id=reservation.id,
            shop_name=reservation.shop.name,
        )
    except Exception:
        pass  # Never break main flow for notifications

    return reservation


async def no_show(
    db: AsyncSession,
    reservation_id: UUID,
    owner_id: UUID,
) -> Reservation:
    """Mark a reservation as no-show after verifying shop ownership."""
    result = await db.execute(
        select(Reservation)
        .options(joinedload(Reservation.shop))
        .where(Reservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("Reservation not found")
    if reservation.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")
    if reservation.status != "active":
        raise BadRequestError("Reservation is not active")

    reservation.status = "no_show"
    await db.flush()
    await db.refresh(reservation)
    return reservation


async def get_my_reservations(
    db: AsyncSession,
    customer_id: UUID,
) -> list[Reservation]:
    """Get active reservations for a customer."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.customer_id == customer_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        ).order_by(Reservation.created_at.desc())
    )
    return list(result.scalars().all())


async def get_shop_reservations(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
) -> list[Reservation]:
    """Get active reservations for a shop after verifying ownership."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    now = datetime.now(timezone.utc)
    reservations_result = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.shop_id == shop_id,
                Reservation.status == "active",
                Reservation.expires_at > now,
            )
        ).order_by(Reservation.created_at.desc())
    )
    return list(reservations_result.scalars().all())
