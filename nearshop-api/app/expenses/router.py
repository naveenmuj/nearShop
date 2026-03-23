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
from app.expenses import service

router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])


async def _get_shop_id(user: User, db: AsyncSession) -> UUID:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


class AddExpenseRequest(BaseModel):
    amount: float
    category: str
    description: Optional[str] = None


@router.post("")
async def add_expense(
    req: AddExpenseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    expense = await service.add_expense(db, shop_id, req.model_dump())
    await db.commit()
    return {"id": str(expense.id), "amount": float(expense.amount), "category": expense.category}


@router.get("")
async def list_expenses(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    category: Optional[str] = None,
    period: str = Query("30d"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.get_expenses(db, shop_id, page, per_page, category, period)


@router.get("/by-category")
async def expenses_by_category(
    period: str = Query("30d"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.get_expense_by_category(db, shop_id, period)


@router.get("/profit-loss")
async def profit_loss(
    period: str = Query("30d"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.get_profit_loss(db, shop_id, period)


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_expense(db, expense_id)
    await db.commit()
    return {"message": "Deleted"}
