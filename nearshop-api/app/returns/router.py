"""Returns Router"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.returns.schemas import (
    ReturnRequestCreate, ReturnRequestUpdate, ReturnRequestResponse,
    ReturnRequestDetail, ReturnListResponse, PolicyCreate, PolicyResponse,
    TimelineEvent, RETURN_REASONS,
)
from app.returns.service import (
    create_return_request, update_return_status, get_customer_returns,
    get_shop_returns, get_return_detail, get_or_create_policy, update_policy,
)
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/returns", tags=["returns"])


@router.get("/reasons")
async def get_return_reasons():
    return {"reasons": RETURN_REASONS}


@router.post("", response_model=ReturnRequestResponse)
async def create_return(
    body: ReturnRequestCreate,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    return_request = await create_return_request(db, current_user.id, body)
    return ReturnRequestResponse.model_validate(return_request)


@router.get("/my", response_model=ReturnListResponse)
async def get_my_returns(
    status: Optional[str] = None, limit: int = 20, offset: int = 0,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    returns, total = await get_customer_returns(db, current_user.id, status, limit, offset)
    return ReturnListResponse(
        items=[ReturnRequestResponse.model_validate(r) for r in returns],
        total=total,
    )


@router.get("/shop", response_model=ReturnListResponse)
async def get_shop_returns_endpoint(
    status: Optional[str] = None, limit: int = 20, offset: int = 0,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    returns, total = await get_shop_returns(db, shop_id, status, limit, offset)
    return ReturnListResponse(
        items=[ReturnRequestResponse.model_validate(r) for r in returns],
        total=total,
    )


@router.get("/{return_id}", response_model=ReturnRequestDetail)
async def get_return(
    return_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return_request = await get_return_detail(db, return_id)
    if not return_request:
        raise HTTPException(status_code=404, detail="Return not found")
    
    # Verify access
    if current_user.active_role == "customer" and return_request.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ReturnRequestDetail(
        **{k: v for k, v in return_request.__dict__.items() if not k.startswith('_')},
        timeline=[TimelineEvent.model_validate(t) for t in return_request.timeline],
    )


@router.patch("/{return_id}", response_model=ReturnRequestResponse)
async def update_return(
    return_id: UUID, body: ReturnRequestUpdate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    return_request = await update_return_status(db, return_id, current_user.id, "shop", body)
    return ReturnRequestResponse.model_validate(return_request)


@router.post("/{return_id}/approve")
async def approve_return(
    return_id: UUID,
    refund_amount: Optional[float] = None,
    refund_method: str = "store_credit",
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    from decimal import Decimal
    return_request = await get_return_detail(db, return_id)
    if not return_request:
        raise HTTPException(status_code=404, detail="Return not found")
    
    amount = Decimal(refund_amount) if refund_amount else return_request.item_price * return_request.item_quantity
    
    updated = await update_return_status(db, return_id, current_user.id, "shop", ReturnRequestUpdate(
        status="approved", refund_amount=amount, refund_method=refund_method,
        resolution_notes="Return approved",
    ))
    return {"message": "Return approved", "refund_amount": float(updated.refund_amount)}


@router.post("/{return_id}/reject")
async def reject_return(
    return_id: UUID, reason: str,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    await update_return_status(db, return_id, current_user.id, "shop", ReturnRequestUpdate(
        status="rejected", resolution_notes=reason,
    ))
    return {"message": "Return rejected"}


# Policy endpoints
@router.get("/policy/mine", response_model=PolicyResponse)
async def get_my_policy(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    policy = await get_or_create_policy(db, shop_id)
    return PolicyResponse.model_validate(policy)


@router.put("/policy/mine", response_model=PolicyResponse)
async def update_my_policy(
    body: PolicyCreate,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop.id).where(Shop.owner_id == current_user.id))
    shop_id = shop_result.scalar_one_or_none()
    if not shop_id:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    policy = await update_policy(db, shop_id, body.model_dump(exclude_unset=True))
    return PolicyResponse.model_validate(policy)


@router.get("/shop/{shop_id}/policy", response_model=PolicyResponse)
async def get_shop_policy(shop_id: UUID, db: AsyncSession = Depends(get_db)):
    policy = await get_or_create_policy(db, shop_id)
    return PolicyResponse.model_validate(policy)
