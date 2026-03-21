from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.auth.models import User
from app.loyalty.models import ShopCoinsLedger, Badge, UserStreak


async def get_balance(db: AsyncSession, user_id: UUID) -> int:
    """Get the current coin balance for a user."""
    result = await db.execute(
        select(ShopCoinsLedger.balance_after)
        .where(ShopCoinsLedger.user_id == user_id)
        .order_by(ShopCoinsLedger.created_at.desc())
        .limit(1)
    )
    balance = result.scalar_one_or_none()
    return balance if balance is not None else 0


async def earn_coins(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str,
    reference_id: Optional[UUID] = None,
) -> ShopCoinsLedger:
    """Award coins to a user."""
    current_balance = await get_balance(db, user_id)
    new_balance = current_balance + amount

    entry = ShopCoinsLedger(
        user_id=user_id,
        amount=amount,
        balance_after=new_balance,
        reason=reason,
        reference_id=reference_id,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def spend_coins(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str,
    reference_id: Optional[UUID] = None,
) -> ShopCoinsLedger:
    """Spend coins from a user's balance."""
    if amount < 50:
        raise BadRequestError("Minimum spend is 50 coins")

    current_balance = await get_balance(db, user_id)
    if current_balance < amount:
        raise BadRequestError(
            f"Insufficient balance. Current: {current_balance}, required: {amount}"
        )

    new_balance = current_balance - amount

    entry = ShopCoinsLedger(
        user_id=user_id,
        amount=-amount,
        balance_after=new_balance,
        reason=reason,
        reference_id=reference_id,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def get_history(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[ShopCoinsLedger], int]:
    """Get paginated transaction history for a user."""
    # Count
    count_result = await db.execute(
        select(func.count())
        .select_from(ShopCoinsLedger)
        .where(ShopCoinsLedger.user_id == user_id)
    )
    total = count_result.scalar() or 0

    # Fetch
    offset = (page - 1) * per_page
    result = await db.execute(
        select(ShopCoinsLedger)
        .where(ShopCoinsLedger.user_id == user_id)
        .order_by(ShopCoinsLedger.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    items = list(result.scalars().all())

    return items, total


async def get_badges(db: AsyncSession, user_id: UUID) -> list[Badge]:
    """Get all badges for a user."""
    result = await db.execute(
        select(Badge)
        .where(Badge.user_id == user_id)
        .order_by(Badge.earned_at.desc())
    )
    return list(result.scalars().all())


async def get_leaderboard(
    db: AsyncSession,
    limit: int = 10,
) -> list[dict]:
    """Get the top earners leaderboard."""
    result = await db.execute(
        select(
            ShopCoinsLedger.user_id,
            func.sum(ShopCoinsLedger.amount)
            .filter(ShopCoinsLedger.amount > 0)
            .label("total_earned"),
            User.name.label("user_name"),
        )
        .join(User, ShopCoinsLedger.user_id == User.id)
        .where(ShopCoinsLedger.amount > 0)
        .group_by(ShopCoinsLedger.user_id, User.name)
        .order_by(
            func.sum(ShopCoinsLedger.amount)
            .filter(ShopCoinsLedger.amount > 0)
            .desc()
        )
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "user_id": row.user_id,
            "user_name": row.user_name,
            "total_earned": row.total_earned or 0,
        }
        for row in rows
    ]


async def update_streak(db: AsyncSession, user_id: UUID) -> dict:
    """Update daily login/activity streak for user."""
    from datetime import date, timedelta
    from sqlalchemy import select

    result = await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    streak = result.scalar_one_or_none()

    today = datetime.now(timezone.utc).date()

    if not streak:
        streak = UserStreak(user_id=user_id, current_streak=1, longest_streak=1, last_activity_date=datetime.now(timezone.utc))
        db.add(streak)
    else:
        last_date = streak.last_activity_date.date() if streak.last_activity_date else None
        if last_date == today:
            pass  # Already updated today
        elif last_date == today - timedelta(days=1):
            streak.current_streak += 1
            streak.longest_streak = max(streak.longest_streak, streak.current_streak)
            streak.last_activity_date = datetime.now(timezone.utc)
        else:
            streak.current_streak = 1
            streak.last_activity_date = datetime.now(timezone.utc)

    await db.flush()
    return {"current_streak": streak.current_streak, "longest_streak": streak.longest_streak}


async def get_streak(db: AsyncSession, user_id: UUID) -> dict:
    from sqlalchemy import select
    result = await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    streak = result.scalar_one_or_none()
    if not streak:
        return {"current_streak": 0, "longest_streak": 0}
    return {"current_streak": streak.current_streak, "longest_streak": streak.longest_streak}
