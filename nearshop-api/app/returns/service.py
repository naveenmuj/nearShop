"""Returns Service"""
from uuid import UUID
from typing import Optional, List, Tuple
from datetime import datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.returns.models import ReturnRequest, ReturnTimeline, ReturnPolicy
from app.returns.schemas import ReturnRequestCreate, ReturnRequestUpdate
from app.orders.models import Order
from app.shops.models import Shop


async def create_return_request(
    db: AsyncSession, customer_id: UUID, data: ReturnRequestCreate,
) -> ReturnRequest:
    # Verify order belongs to customer
    order_result = await db.execute(
        select(Order).where(and_(Order.id == data.order_id, Order.customer_id == customer_id))
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check for existing return on same order/product
    existing = await db.execute(
        select(ReturnRequest).where(and_(
            ReturnRequest.order_id == data.order_id,
            ReturnRequest.product_id == data.product_id,
            ReturnRequest.status.notin_(["rejected", "cancelled"]),
        ))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Return already exists for this item")
    
    return_request = ReturnRequest(
        order_id=data.order_id, customer_id=customer_id, shop_id=order.shop_id,
        product_id=data.product_id, item_name=data.item_name, item_quantity=data.item_quantity,
        item_price=data.item_price, reason=data.reason, description=data.description, images=data.images,
    )
    db.add(return_request)
    await db.flush()
    
    # Add timeline event
    timeline = ReturnTimeline(
        return_id=return_request.id, event_type="created", new_status="pending",
        message=f"Return request submitted: {data.reason}", actor_id=customer_id, actor_role="customer",
    )
    db.add(timeline)
    
    await db.commit()
    await db.refresh(return_request)
    return return_request


async def update_return_status(
    db: AsyncSession, return_id: UUID, user_id: UUID, role: str, data: ReturnRequestUpdate,
) -> ReturnRequest:
    result = await db.execute(select(ReturnRequest).where(ReturnRequest.id == return_id))
    return_request = result.scalar_one_or_none()
    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found")
    
    old_status = return_request.status
    
    if data.status:
        return_request.status = data.status
        if data.status == "approved":
            return_request.approved_at = datetime.utcnow()
        elif data.status == "rejected":
            return_request.rejected_at = datetime.utcnow()
        elif data.status == "completed":
            return_request.completed_at = datetime.utcnow()
    
    if data.resolution_notes:
        return_request.resolution_notes = data.resolution_notes
        return_request.resolved_by = user_id
    
    if data.refund_amount:
        return_request.refund_amount = data.refund_amount
    
    if data.refund_method:
        return_request.refund_method = data.refund_method
    
    # Add timeline
    if data.status and data.status != old_status:
        timeline = ReturnTimeline(
            return_id=return_id, event_type="status_change", old_status=old_status, new_status=data.status,
            message=data.resolution_notes, actor_id=user_id, actor_role=role,
        )
        db.add(timeline)
    
    await db.commit()
    await db.refresh(return_request)
    return return_request


async def get_customer_returns(
    db: AsyncSession, customer_id: UUID, status: Optional[str] = None, limit: int = 20, offset: int = 0,
) -> Tuple[List[ReturnRequest], int]:
    query = select(ReturnRequest).where(ReturnRequest.customer_id == customer_id)
    if status:
        query = query.where(ReturnRequest.status == status)
    
    count_query = select(func.count()).select_from(ReturnRequest).where(ReturnRequest.customer_id == customer_id)
    if status:
        count_query = count_query.where(ReturnRequest.status == status)
    total = (await db.execute(count_query)).scalar() or 0
    
    query = query.options(selectinload(ReturnRequest.order), selectinload(ReturnRequest.shop))
    query = query.order_by(desc(ReturnRequest.requested_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_shop_returns(
    db: AsyncSession, shop_id: UUID, status: Optional[str] = None, limit: int = 20, offset: int = 0,
) -> Tuple[List[ReturnRequest], int]:
    query = select(ReturnRequest).where(ReturnRequest.shop_id == shop_id)
    if status:
        query = query.where(ReturnRequest.status == status)
    
    count_query = select(func.count()).select_from(ReturnRequest).where(ReturnRequest.shop_id == shop_id)
    if status:
        count_query = count_query.where(ReturnRequest.status == status)
    total = (await db.execute(count_query)).scalar() or 0
    
    query = query.options(selectinload(ReturnRequest.order), selectinload(ReturnRequest.customer))
    query = query.order_by(desc(ReturnRequest.requested_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_return_detail(db: AsyncSession, return_id: UUID) -> Optional[ReturnRequest]:
    result = await db.execute(
        select(ReturnRequest).where(ReturnRequest.id == return_id)
        .options(selectinload(ReturnRequest.timeline), selectinload(ReturnRequest.order), selectinload(ReturnRequest.shop))
    )
    return result.scalar_one_or_none()


async def get_or_create_policy(db: AsyncSession, shop_id: UUID) -> ReturnPolicy:
    result = await db.execute(select(ReturnPolicy).where(ReturnPolicy.shop_id == shop_id))
    policy = result.scalar_one_or_none()
    if policy:
        return policy
    
    policy = ReturnPolicy(shop_id=shop_id)
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


async def update_policy(
    db: AsyncSession, shop_id: UUID, data: dict,
) -> ReturnPolicy:
    policy = await get_or_create_policy(db, shop_id)
    for key, value in data.items():
        if hasattr(policy, key) and value is not None:
            setattr(policy, key, value)
    await db.commit()
    await db.refresh(policy)
    return policy
