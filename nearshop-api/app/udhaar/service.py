from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.auth.models import User
from app.orders.models import Order
from app.shops.models import Shop
from app.udhaar.models import UdhaarAccount, UdhaarTransaction


async def extend_credit(
    db: AsyncSession,
    shop_id: UUID,
    customer_phone: str,
    amount: float,
    description: str | None,
) -> UdhaarAccount:
    """Extend credit to a customer from a shop."""
    # 1. Find customer by phone number
    customer_result = await db.execute(
        select(User).where(User.phone == customer_phone)
    )
    customer = customer_result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer with this phone number not found")

    # 2. Validate customer has at least 3 completed orders from this shop
    order_count_result = await db.execute(
        select(func.count()).select_from(Order).where(
            and_(
                Order.customer_id == customer.id,
                Order.shop_id == shop_id,
                Order.status == "delivered",
            )
        )
    )
    order_count = order_count_result.scalar() or 0
    if order_count < 3:
        raise BadRequestError(
            "Customer must have at least 3 completed orders from this shop to get credit"
        )

    # 3. Get or create UdhaarAccount for this shop+customer pair
    account_result = await db.execute(
        select(UdhaarAccount).where(
            and_(
                UdhaarAccount.shop_id == shop_id,
                UdhaarAccount.customer_id == customer.id,
            )
        )
    )
    account = account_result.scalar_one_or_none()
    if not account:
        account = UdhaarAccount(
            shop_id=shop_id,
            customer_id=customer.id,
        )
        db.add(account)
        await db.flush()
        await db.refresh(account)

    # 4. Validate current_balance + amount <= credit_limit
    new_balance = float(account.current_balance) + amount
    if new_balance > float(account.credit_limit):
        raise BadRequestError(
            f"Credit would exceed limit. Available: {float(account.credit_limit) - float(account.current_balance):.2f}"
        )

    # 5. Create UdhaarTransaction(type='credit')
    transaction = UdhaarTransaction(
        account_id=account.id,
        amount=amount,
        transaction_type="credit",
        description=description,
    )
    db.add(transaction)

    # 6. Update account.current_balance
    account.current_balance = new_balance
    await db.flush()
    await db.refresh(account)

    # 7. Create notification for customer
    try:
        shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
        shop = shop_result.scalar_one_or_none()
        shop_name = shop.name if shop else "the shop"

        from app.notifications.service import create_notification
        from app.notifications.templates import TEMPLATES

        # Add template if not present
        if "udhaar_credit_extended" not in TEMPLATES:
            TEMPLATES["udhaar_credit_extended"] = {
                "title": "Credit Extended",
                "body": "Credit of Rs.{amount} added by {shop_name}",
            }
        await create_notification(
            db,
            customer.id,
            "udhaar_credit_extended",
            reference_type="udhaar_account",
            reference_id=account.id,
            amount=str(amount),
            shop_name=shop_name,
        )
    except Exception:
        pass  # Never break main flow for notifications

    return account


async def record_payment(
    db: AsyncSession,
    account_id: UUID,
    amount: float,
    user_id: UUID,
) -> UdhaarAccount:
    """Record a payment against a udhaar account."""
    # 1. Fetch account
    account_result = await db.execute(
        select(UdhaarAccount).where(UdhaarAccount.id == account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Udhaar account not found")

    # Verify user is either the customer or the shop owner
    shop_result = await db.execute(select(Shop).where(Shop.id == account.shop_id))
    shop = shop_result.scalar_one_or_none()
    is_customer = account.customer_id == user_id
    is_owner = shop and shop.owner_id == user_id
    if not is_customer and not is_owner:
        raise ForbiddenError("You are not authorized to record payments for this account")

    # 2. Validate amount <= current_balance
    if amount > float(account.current_balance):
        raise BadRequestError(
            f"Payment amount exceeds outstanding balance of {float(account.current_balance):.2f}"
        )

    # 3. Create UdhaarTransaction(type='payment')
    transaction = UdhaarTransaction(
        account_id=account.id,
        amount=amount,
        transaction_type="payment",
        description=None,
    )
    db.add(transaction)

    # 4. Update account.current_balance
    account.current_balance = float(account.current_balance) - amount
    await db.flush()
    await db.refresh(account)

    # 5. Create notification for shop owner
    try:
        if shop:
            from app.notifications.service import create_notification
            from app.notifications.templates import TEMPLATES

            if "udhaar_payment_received" not in TEMPLATES:
                TEMPLATES["udhaar_payment_received"] = {
                    "title": "Payment Received",
                    "body": "Payment of Rs.{amount} received",
                }
            await create_notification(
                db,
                shop.owner_id,
                "udhaar_payment_received",
                reference_type="udhaar_account",
                reference_id=account.id,
                amount=str(amount),
            )
    except Exception:
        pass  # Never break main flow for notifications

    return account


async def get_shop_ledger(
    db: AsyncSession,
    shop_id: UUID,
) -> dict:
    """Get all udhaar accounts for a shop with customer info and totals."""
    result = await db.execute(
        select(UdhaarAccount, User, Shop)
        .join(User, UdhaarAccount.customer_id == User.id)
        .join(Shop, UdhaarAccount.shop_id == Shop.id)
        .where(UdhaarAccount.shop_id == shop_id)
        .order_by(UdhaarAccount.created_at.desc())
    )
    rows = result.all()

    accounts = []
    total_outstanding = 0.0
    for account, customer, shop in rows:
        accounts.append({
            "id": account.id,
            "shop_id": account.shop_id,
            "shop_name": shop.name,
            "customer_id": account.customer_id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "credit_limit": float(account.credit_limit),
            "current_balance": float(account.current_balance),
            "is_active": account.is_active,
            "created_at": account.created_at,
        })
        total_outstanding += float(account.current_balance)

    return {"accounts": accounts, "total_outstanding": total_outstanding}


async def get_customer_credits(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict]:
    """Get all udhaar accounts for a customer with shop info."""
    result = await db.execute(
        select(UdhaarAccount, Shop, User)
        .join(Shop, UdhaarAccount.shop_id == Shop.id)
        .join(User, UdhaarAccount.customer_id == User.id)
        .where(UdhaarAccount.customer_id == user_id)
        .order_by(UdhaarAccount.created_at.desc())
    )
    rows = result.all()

    accounts = []
    for account, shop, customer in rows:
        accounts.append({
            "id": account.id,
            "shop_id": account.shop_id,
            "shop_name": shop.name,
            "customer_id": account.customer_id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "credit_limit": float(account.credit_limit),
            "current_balance": float(account.current_balance),
            "is_active": account.is_active,
            "created_at": account.created_at,
        })

    return accounts


async def get_account_transactions(
    db: AsyncSession,
    account_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[UdhaarTransaction], int]:
    """Get paginated transactions for a udhaar account, newest first."""
    count_result = await db.execute(
        select(func.count()).select_from(UdhaarTransaction).where(
            UdhaarTransaction.account_id == account_id
        )
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        select(UdhaarTransaction)
        .where(UdhaarTransaction.account_id == account_id)
        .order_by(UdhaarTransaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    transactions = list(result.scalars().all())

    return transactions, total
