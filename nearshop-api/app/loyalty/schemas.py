from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TransactionResponse(BaseModel):
    id: UUID
    amount: int
    balance_after: int
    reason: Optional[str] = None
    reference_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CoinBalanceResponse(BaseModel):
    balance: int
    recent_transactions: list[TransactionResponse]


class BadgeResponse(BaseModel):
    badge_type: str
    badge_level: int
    earned_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntry(BaseModel):
    user_id: UUID
    user_name: str | None
    total_earned: int


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int


class EarnCoinsRequest(BaseModel):
    amount: int
    reason: str
    reference_id: Optional[UUID] = None


class SpendCoinsRequest(BaseModel):
    amount: int
    reason: str
    reference_id: Optional[UUID] = None


class CoinsResponse(BaseModel):
    balance: int
    transaction_id: UUID
