from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.haggle.schemas import (
    StartHaggleRequest,
    HaggleOfferRequest,
    HaggleSessionResponse,
    HaggleListResponse,
)
from app.haggle.service import (
    start_haggle,
    send_offer,
    accept_haggle,
    reject_haggle,
    get_customer_haggles,
    get_shop_haggles,
)

router = APIRouter(prefix="/api/v1/haggle", tags=["haggle"])


@router.post("/start", response_model=HaggleSessionResponse)
async def start_haggle_endpoint(
    body: StartHaggleRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    session = await start_haggle(db, current_user.id, body)
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/offer", response_model=HaggleSessionResponse)
async def send_offer_endpoint(
    session_id: UUID,
    body: HaggleOfferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await send_offer(
        db, session_id, current_user.id, current_user.active_role, body
    )
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/accept", response_model=HaggleSessionResponse)
async def accept_haggle_endpoint(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await accept_haggle(db, session_id, current_user.id)
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/reject", response_model=HaggleSessionResponse)
async def reject_haggle_endpoint(
    session_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    session = await reject_haggle(db, session_id, current_user.id)
    return HaggleSessionResponse.model_validate(session)


@router.get("/my", response_model=HaggleListResponse)
async def get_my_haggles_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_customer_haggles(db, current_user.id)
    return HaggleListResponse(
        items=[HaggleSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


@router.get("/shop/{shop_id}", response_model=HaggleListResponse)
async def get_shop_haggles_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_shop_haggles(db, shop_id, current_user.id)
    return HaggleListResponse(
        items=[HaggleSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )
