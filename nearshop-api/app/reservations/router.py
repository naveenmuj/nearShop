from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business, require_customer
from app.reservations.schemas import (
    ReserveRequest,
    ReservationResponse,
    ReservationListResponse,
)
from app.reservations.service import (
    create_reservation,
    cancel_reservation,
    fulfill_reservation,
    no_show,
    get_my_reservations,
    get_shop_reservations,
)

router = APIRouter(prefix="/api/v1/reservations", tags=["reservations"])


@router.post("", response_model=ReservationResponse)
async def create_reservation_endpoint(
    body: ReserveRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    reservation = await create_reservation(db, current_user.id, body)
    return ReservationResponse.model_validate(reservation)


@router.delete("/{reservation_id}", response_model=ReservationResponse)
async def cancel_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    reservation = await cancel_reservation(db, reservation_id, current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/fulfill", response_model=ReservationResponse)
async def fulfill_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    reservation = await fulfill_reservation(db, reservation_id, current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/no-show", response_model=ReservationResponse)
async def no_show_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    reservation = await no_show(db, reservation_id, current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.get("/my", response_model=ReservationListResponse)
async def get_my_reservations_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    reservations = await get_my_reservations(db, current_user.id)
    return ReservationListResponse(
        items=[ReservationResponse.model_validate(r) for r in reservations],
        total=len(reservations),
    )


@router.get("/shop/{shop_id}", response_model=ReservationListResponse)
async def get_shop_reservations_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    reservations = await get_shop_reservations(db, shop_id, current_user.id)
    return ReservationListResponse(
        items=[ReservationResponse.model_validate(r) for r in reservations],
        total=len(reservations),
    )
