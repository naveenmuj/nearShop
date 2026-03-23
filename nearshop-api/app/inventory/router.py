from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.inventory import service

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


async def _get_shop_id(user: User, db: AsyncSession) -> UUID:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


class RestockRequest(BaseModel):
    product_id: str
    quantity: int
    purchase_price: Optional[float] = None
    supplier_name: Optional[str] = None
    notes: Optional[str] = None


@router.post("/restock")
async def restock(
    req: RestockRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await service.restock_product(
        db, UUID(req.product_id), req.quantity,
        req.purchase_price, req.supplier_name, req.notes,
    )
    await db.commit()
    return result


@router.get("/low-stock")
async def low_stock(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_low_stock_products(db, shop_id)


@router.get("/value")
async def stock_value(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_stock_value(db, shop_id)


@router.get("/margins")
async def margins(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_margin_report(db, shop_id)


@router.get("/logs/{product_id}")
async def stock_logs(
    product_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_stock_logs(db, product_id, limit)
