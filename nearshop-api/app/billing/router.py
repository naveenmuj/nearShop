from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.billing import service

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


async def _get_shop_id(user: User, db: AsyncSession) -> UUID:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found. Create a shop first.")
    return shop.id


class BillItemInput(BaseModel):
    product_id: Optional[str] = None
    name: Optional[str] = None
    price: float
    quantity: int = 1


class CreateBillRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[BillItemInput]
    gst_percentage: float = 0
    discount_amount: float = 0
    delivery_fee: float = 0
    payment_method: str = "cash"
    payment_status: str = "paid"
    notes: Optional[str] = None


@router.post("")
async def create_bill(
    req: CreateBillRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    bill = await service.create_bill(db, shop_id, req.model_dump())
    await db.commit()
    return await service.get_bill_detail(db, bill.id)


@router.get("")
async def list_bills(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.get_shop_bills(db, shop_id, page, per_page, status)


@router.get("/stats")
async def bill_stats(
    period: str = Query("30d"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.get_bill_stats(db, shop_id, period)


@router.get("/{bill_id}")
async def get_bill(
    bill_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_bill_detail(db, bill_id)


@router.put("/{bill_id}/status")
async def update_status(
    bill_id: UUID,
    status: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bill = await service.update_bill_status(db, bill_id, status)
    await db.commit()
    return {"message": "Status updated", "status": bill.payment_status}
