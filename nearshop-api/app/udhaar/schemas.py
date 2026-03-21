from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ExtendCreditRequest(BaseModel):
    customer_phone: str
    amount: float
    description: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    amount: float


class UdhaarAccountResponse(BaseModel):
    id: UUID
    shop_id: UUID
    shop_name: str
    customer_id: UUID
    customer_name: Optional[str]
    customer_phone: str
    credit_limit: float
    current_balance: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UdhaarTransactionResponse(BaseModel):
    id: UUID
    amount: float
    transaction_type: str
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UdhaarLedgerResponse(BaseModel):
    accounts: list[UdhaarAccountResponse]
    total_outstanding: float
