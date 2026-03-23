from uuid import UUID
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.expenses.models import Expense


PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}


async def add_expense(db: AsyncSession, shop_id: UUID, data: dict) -> Expense:
    expense = Expense(
        shop_id=shop_id,
        amount=Decimal(str(data["amount"])),
        category=data["category"],
        description=data.get("description"),
    )
    db.add(expense)
    await db.flush()
    return expense


async def get_expenses(
    db: AsyncSession, shop_id: UUID, page: int = 1, per_page: int = 30,
    category: str = None, period: str = "30d",
) -> dict:
    days = PERIOD_DAYS.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    query = select(Expense).where(Expense.shop_id == shop_id, Expense.expense_date >= start)
    if category:
        query = query.where(Expense.category == category)

    result = await db.execute(
        query.order_by(desc(Expense.expense_date)).offset((page - 1) * per_page).limit(per_page)
    )
    expenses = result.scalars().all()

    total = float((await db.execute(
        select(func.sum(Expense.amount)).where(Expense.shop_id == shop_id, Expense.expense_date >= start)
    )).scalar() or 0)

    return {
        "expenses": [
            {
                "id": str(e.id), "amount": float(e.amount), "category": e.category,
                "description": e.description, "date": str(e.expense_date),
            }
            for e in expenses
        ],
        "total_expenses": total,
        "period": period,
    }


async def get_expense_by_category(db: AsyncSession, shop_id: UUID, period: str = "30d") -> list:
    days = PERIOD_DAYS.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Expense.category, func.sum(Expense.amount).label("total"))
        .where(Expense.shop_id == shop_id, Expense.expense_date >= start)
        .group_by(Expense.category)
        .order_by(desc("total"))
    )
    return [{"category": r[0], "total": float(r[1])} for r in result.all()]


async def get_profit_loss(db: AsyncSession, shop_id: UUID, period: str = "30d") -> dict:
    from app.billing.models import Bill
    from app.orders.models import Order

    days = PERIOD_DAYS.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    bill_rev = float((await db.execute(
        select(func.sum(Bill.total)).where(
            Bill.shop_id == shop_id, Bill.created_at >= start, Bill.payment_status == "paid"
        )
    )).scalar() or 0)

    order_rev = float((await db.execute(
        select(func.sum(Order.total)).where(
            Order.shop_id == shop_id, Order.created_at >= start,
            Order.status.in_(["completed", "delivered"])
        )
    )).scalar() or 0)

    total_rev = bill_rev + order_rev

    total_exp = float((await db.execute(
        select(func.sum(Expense.amount)).where(
            Expense.shop_id == shop_id, Expense.expense_date >= start
        )
    )).scalar() or 0)

    profit = total_rev - total_exp
    margin = round(profit / total_rev * 100, 1) if total_rev > 0 else 0

    breakdown = await get_expense_by_category(db, shop_id, period)

    return {
        "period": period,
        "total_revenue": total_rev,
        "bill_revenue": bill_rev,
        "order_revenue": order_rev,
        "total_expenses": total_exp,
        "profit": profit,
        "profit_margin": margin,
        "expense_breakdown": breakdown,
    }


async def delete_expense(db: AsyncSession, expense_id: UUID) -> None:
    expense = await db.get(Expense, expense_id)
    if not expense:
        raise NotFoundError("Expense not found")
    await db.delete(expense)
    await db.flush()
