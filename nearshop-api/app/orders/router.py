from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.orders.schemas import (
    OrderCreate,
    OrderStatusUpdate,
    OrderResponse,
    OrderListResponse,
)
from app.orders import service

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


@router.post("", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer),
):
    order = await service.create_order(db, current_user.id, data)
    return order


@router.get("/my", response_model=OrderListResponse)
async def get_my_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_customer),
):
    orders, total = await service.get_customer_orders(
        db, current_user.id, page, per_page
    )
    return OrderListResponse(
        items=orders, total=total, page=page, per_page=per_page
    )


@router.get("/shop/{shop_id}", response_model=OrderListResponse)
async def get_shop_orders(
    shop_id: UUID,
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_business),
):
    orders, total = await service.get_shop_orders(
        db, shop_id, current_user.id, status, page, per_page
    )
    return OrderListResponse(
        items=orders, total=total, page=page, per_page=per_page
    )


@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_business),
):
    order = await service.update_status(
        db, order_id, current_user.id, data.status
    )
    return order


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await service.cancel_order(db, order_id, current_user.id)
    return order
