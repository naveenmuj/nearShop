from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.shops.models import Shop
from app.udhaar.models import UdhaarAccount
from app.udhaar.schemas import (
    ExtendCreditRequest,
    RecordPaymentRequest,
    UdhaarAccountResponse,
    UdhaarTransactionResponse,
    UdhaarLedgerResponse,
)
from app.udhaar.service import (
    extend_credit,
    record_payment,
    get_shop_ledger,
    get_customer_credits,
    get_account_transactions,
)

router = APIRouter(prefix="/api/v1/udhaar", tags=["udhaar"])


@router.post("/extend-credit", response_model=UdhaarAccountResponse)
async def extend_credit_endpoint(
    body: ExtendCreditRequest,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Extend credit to a customer. Requires business role. Gets shop_id from current user's shop."""
    # Get the first shop owned by this user
    shop_result = await db.execute(
        select(Shop).where(Shop.owner_id == current_user.id).limit(1)
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("You don't have a shop registered")

    account = await extend_credit(
        db,
        shop_id=shop.id,
        customer_phone=body.customer_phone,
        amount=body.amount,
        description=body.description,
    )
    await db.commit()
    # Load related data for response
    await db.refresh(account)
    customer_result = await db.execute(
        select(User).where(User.id == account.customer_id)  # type: ignore[arg-type]
    )
    customer = customer_result.scalar_one_or_none()
    return UdhaarAccountResponse(
        id=account.id,
        shop_id=account.shop_id,
        shop_name=shop.name,
        customer_id=account.customer_id,
        customer_name=customer.name if customer else None,
        customer_phone=customer.phone if customer else body.customer_phone,
        credit_limit=float(account.credit_limit),
        current_balance=float(account.current_balance),
        is_active=account.is_active,
        created_at=account.created_at,
    )


@router.post("/{account_id}/payment", response_model=UdhaarAccountResponse)
async def record_payment_endpoint(
    account_id: UUID,
    body: RecordPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a payment. Requires auth (either role)."""
    account = await record_payment(db, account_id=account_id, amount=body.amount, user_id=current_user.id)

    # Load related data for response
    shop_result = await db.execute(select(Shop).where(Shop.id == account.shop_id))
    shop = shop_result.scalar_one_or_none()
    customer_result = await db.execute(select(User).where(User.id == account.customer_id))
    customer = customer_result.scalar_one_or_none()
    return UdhaarAccountResponse(
        id=account.id,
        shop_id=account.shop_id,
        shop_name=shop.name if shop else "",
        customer_id=account.customer_id,
        customer_name=customer.name if customer else None,
        customer_phone=customer.phone if customer else "",
        credit_limit=float(account.credit_limit),
        current_balance=float(account.current_balance),
        is_active=account.is_active,
        created_at=account.created_at,
    )


@router.get("/shop-ledger", response_model=UdhaarLedgerResponse)
async def get_shop_ledger_endpoint(
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Get all udhaar accounts for the owner's shop. Requires business role."""
    shop_result = await db.execute(
        select(Shop).where(Shop.owner_id == current_user.id)
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("You don't have a shop registered")

    ledger = await get_shop_ledger(db, shop_id=shop.id)
    return UdhaarLedgerResponse(
        accounts=[UdhaarAccountResponse(**acc) for acc in ledger["accounts"]],
        total_outstanding=ledger["total_outstanding"],
    )


@router.get("/my-credits", response_model=list[UdhaarAccountResponse])
async def get_my_credits_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Get all udhaar accounts where current user is the customer. Requires customer role."""
    accounts = await get_customer_credits(db, user_id=current_user.id)
    return [UdhaarAccountResponse(**acc) for acc in accounts]


@router.get("/{account_id}/transactions", response_model=dict)
async def get_account_transactions_endpoint(
    account_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated transactions for a udhaar account. Requires auth; user must be party to account."""
    # Verify account exists and user is a party
    account_result = await db.execute(
        select(UdhaarAccount).where(UdhaarAccount.id == account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Udhaar account not found")

    # Check if customer
    is_customer = account.customer_id == current_user.id
    # Check if shop owner
    shop_result = await db.execute(select(Shop).where(Shop.id == account.shop_id))
    shop = shop_result.scalar_one_or_none()
    is_owner = shop and shop.owner_id == current_user.id

    if not is_customer and not is_owner:
        raise ForbiddenError("You are not authorized to view these transactions")

    transactions, total = await get_account_transactions(
        db, account_id=account_id, page=page, per_page=per_page
    )
    return {
        "items": [UdhaarTransactionResponse.model_validate(t) for t in transactions],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
