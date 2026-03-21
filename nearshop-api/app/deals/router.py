from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business, require_customer
from app.deals.schemas import DealCreate, DealResponse, DealListResponse
from app.deals.service import (
    create_deal,
    get_nearby_deals,
    claim_deal,
    end_deal,
    get_shop_deals,
)

router = APIRouter(prefix="/api/v1/deals", tags=["deals"])


@router.post("", response_model=DealResponse)
async def create_deal_endpoint(
    body: DealCreate,
    shop_id: UUID = Query(..., description="Shop ID to create the deal for"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deal = await create_deal(db, shop_id, current_user.id, body)
    return DealResponse.model_validate(deal)


@router.get("/nearby", response_model=DealListResponse)
async def get_nearby_deals_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    deals, total = await get_nearby_deals(
        db, lat, lng, radius_km, category, page, per_page
    )
    return DealListResponse(
        items=[DealResponse.model_validate(d) for d in deals],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/{deal_id}/claim", response_model=DealResponse)
async def claim_deal_endpoint(
    deal_id: UUID,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    deal = await claim_deal(db, deal_id, current_user.id)
    return DealResponse.model_validate(deal)


@router.delete("/{deal_id}", response_model=DealResponse)
async def end_deal_endpoint(
    deal_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deal = await end_deal(db, deal_id, current_user.id)
    return DealResponse.model_validate(deal)


@router.get("/shop/{shop_id}", response_model=list[DealResponse])
async def get_shop_deals_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    deals = await get_shop_deals(db, shop_id, current_user.id)
    return [DealResponse.model_validate(d) for d in deals]
