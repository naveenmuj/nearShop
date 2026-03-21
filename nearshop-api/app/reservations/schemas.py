from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReserveRequest(BaseModel):
    product_id: UUID


class ReservationResponse(BaseModel):
    id: UUID
    product_id: UUID
    shop_id: UUID
    status: str
    expires_at: datetime
    fulfilled_at: Optional[datetime] = None
    created_at: datetime
    product_name: Optional[str] = None
    shop_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReservationListResponse(BaseModel):
    items: list[ReservationResponse]
    total: int
