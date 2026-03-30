"""Gift Cards Schemas"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class PurchaseGiftCard(BaseModel):
    shop_id: Optional[UUID] = None  # null for platform-wide
    value: Decimal
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_name: Optional[str] = None
    personal_message: Optional[str] = None
    template_id: Optional[str] = None


class RedeemGiftCard(BaseModel):
    code: str
    amount: Optional[Decimal] = None  # null = full balance


class GiftCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    code: str
    card_type: str
    shop_id: Optional[UUID]
    initial_value: Decimal
    current_balance: Decimal
    currency: str
    recipient_name: Optional[str]
    status: str
    purchased_at: Optional[datetime]
    expires_at: Optional[datetime]
    template_id: Optional[str]
    shop_name: Optional[str] = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    gift_card_id: UUID
    transaction_type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    order_id: Optional[UUID]
    notes: Optional[str]
    created_at: datetime


class GiftCardDetail(GiftCardResponse):
    transactions: List[TransactionResponse] = []


class BalanceCheckResponse(BaseModel):
    code: str
    current_balance: Decimal
    status: str
    shop_name: Optional[str]
    expires_at: Optional[datetime]


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    category: Optional[str]
    image_url: Optional[str]
