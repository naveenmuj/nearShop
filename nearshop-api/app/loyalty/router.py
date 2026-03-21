from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_customer
from app.loyalty.schemas import (
    CoinBalanceResponse,
    TransactionResponse,
    TransactionListResponse,
    BadgeResponse,
    LeaderboardEntry,
    EarnCoinsRequest,
    SpendCoinsRequest,
    CoinsResponse,
)
from app.loyalty.service import (
    get_balance,
    get_history,
    get_badges,
    get_leaderboard,
    earn_coins,
    spend_coins,
)

router = APIRouter(prefix="/api/v1/loyalty", tags=["loyalty"])


@router.get("/balance", response_model=CoinBalanceResponse)
async def get_balance_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    balance = await get_balance(db, current_user.id)
    transactions, _ = await get_history(db, current_user.id, page=1, per_page=5)
    return CoinBalanceResponse(
        balance=balance,
        recent_transactions=[
            TransactionResponse.model_validate(t) for t in transactions
        ],
    )


@router.get("/history", response_model=TransactionListResponse)
async def get_history_endpoint(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    items, total = await get_history(db, current_user.id, page, per_page)
    return TransactionListResponse(
        items=[TransactionResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/badges", response_model=list[BadgeResponse])
async def get_badges_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    badges = await get_badges(db, current_user.id)
    return [BadgeResponse.model_validate(b) for b in badges]


@router.post("/earn", response_model=CoinsResponse)
async def earn_coins_endpoint(
    body: EarnCoinsRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    entry = await earn_coins(
        db, current_user.id, body.amount, body.reason, body.reference_id
    )
    return CoinsResponse(balance=entry.balance_after, transaction_id=entry.id)


@router.post("/spend", response_model=CoinsResponse)
async def spend_coins_endpoint(
    body: SpendCoinsRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    entry = await spend_coins(
        db, current_user.id, body.amount, body.reason, body.reference_id
    )
    return CoinsResponse(balance=entry.balance_after, transaction_id=entry.id)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard_endpoint(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entries = await get_leaderboard(db, limit)
    return [LeaderboardEntry(**e) for e in entries]


@router.get("/streak")
async def get_streak_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    from app.loyalty.service import get_streak
    return await get_streak(db, current_user.id)

@router.post("/streak/checkin")
async def daily_checkin_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    from app.loyalty.service import update_streak, earn_coins
    streak_data = await update_streak(db, current_user.id)
    # Bonus coins for streaks: 5 coins/day, +5 bonus every 7-day streak
    bonus = 5 + (5 if streak_data["current_streak"] % 7 == 0 else 0)
    entry = await earn_coins(db, current_user.id, bonus, "daily_checkin")
    await db.commit()
    return {**streak_data, "coins_earned": bonus, "balance": entry.balance_after}
