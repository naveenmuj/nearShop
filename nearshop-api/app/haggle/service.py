from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.haggle.models import HaggleSession, HaggleMessage
from app.haggle.schemas import StartHaggleRequest, HaggleOfferRequest
from app.notifications.service import create_notification
from app.products.models import Product
from app.shops.models import Shop


async def start_haggle(
    db: AsyncSession,
    customer_id: UUID,
    data: StartHaggleRequest,
) -> HaggleSession:
    """Start a new haggle session for a product."""
    # Fetch product with shop info
    result = await db.execute(
        select(Product).where(Product.id == data.product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    # Check max 3 active sessions per customer
    count_result = await db.execute(
        select(func.count()).select_from(HaggleSession).where(
            HaggleSession.customer_id == customer_id,
            HaggleSession.status == "active",
        )
    )
    active_count = count_result.scalar() or 0
    if active_count >= 3:
        raise BadRequestError(
            "Maximum of 3 active haggle sessions allowed"
        )

    # Check offer is at least 50% of product price
    min_offer = float(product.price) * 0.5
    if data.offer_amount < min_offer:
        raise BadRequestError(
            f"Offer must be at least 50% of the listed price ({min_offer:.2f})"
        )

    # Create session
    now = datetime.now(timezone.utc)
    session = HaggleSession(
        customer_id=customer_id,
        shop_id=product.shop_id,
        product_id=product.id,
        listed_price=product.price,
        expires_at=now + timedelta(hours=24),
    )
    db.add(session)
    await db.flush()

    # Create first message
    message = HaggleMessage(
        session_id=session.id,
        sender_role="customer",
        offer_amount=Decimal(str(data.offer_amount)),
        message=data.message,
    )
    db.add(message)
    await db.flush()
    await db.refresh(session)

    # Eagerly load messages
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session.id)
    )
    return result.scalar_one()


async def send_offer(
    db: AsyncSession,
    session_id: UUID,
    user_id: UUID,
    role: str,
    data: HaggleOfferRequest,
) -> HaggleSession:
    """Send an offer or counter-offer in a haggle session."""
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Haggle session not found")

    # Always fetch the shop (needed for ownership check and notifications)
    shop_result = await db.execute(
        select(Shop).where(Shop.id == session.shop_id)
    )
    shop = shop_result.scalar_one_or_none()

    # Verify participant
    if role == "customer":
        if session.customer_id != user_id:
            raise ForbiddenError("You are not a participant in this session")
        sender_role = "customer"
    else:
        # Business role — verify shop ownership
        if not shop or shop.owner_id != user_id:
            raise ForbiddenError("You are not a participant in this session")
        sender_role = "business"

    # Check session is active
    if session.status != "active":
        raise BadRequestError("This haggle session is no longer active")

    # Check expiry
    now = datetime.now(timezone.utc)
    if session.expires_at and session.expires_at.replace(tzinfo=timezone.utc) < now:
        session.status = "expired"
        await db.flush()
        raise BadRequestError("This haggle session has expired")

    # Check max 3 messages per role
    role_messages = [m for m in session.messages if m.sender_role == sender_role]
    if len(role_messages) >= 3:
        raise BadRequestError(
            f"Maximum of 3 messages per role reached"
        )

    # Create message
    message = HaggleMessage(
        session_id=session.id,
        sender_role=sender_role,
        offer_amount=Decimal(str(data.offer_amount)),
        message=data.message,
    )
    db.add(message)
    await db.flush()

    # Reload session with messages
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session.id)
    )
    updated_session = result.scalar_one()

    # Fetch product name for notification
    product_result = await db.execute(
        select(Product).where(Product.id == session.product_id)
    )
    product = product_result.scalar_one_or_none()
    product_name = product.name if product else "a product"

    if sender_role == "customer" and shop:
        try:
            await create_notification(
                db,
                user_id=shop.owner_id,
                notification_type="haggle_offer",
                reference_type="haggle_session",
                reference_id=session.id,
                customer_name="A customer",
                product_name=product_name,
            )
        except Exception:
            pass
    elif sender_role == "business":
        try:
            await create_notification(
                db,
                user_id=session.customer_id,
                notification_type="haggle_counter_offer",
                reference_type="haggle_session",
                reference_id=session.id,
                product_name=product_name,
            )
        except Exception:
            pass

    return updated_session


async def accept_haggle(
    db: AsyncSession,
    session_id: UUID,
    user_id: UUID,
) -> HaggleSession:
    """Accept a haggle session. Either party (customer or business) can accept."""
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Haggle session not found")

    if session.status != "active":
        raise BadRequestError("This haggle session is no longer active")

    # Determine caller role: customer or business owner
    shop_result = await db.execute(
        select(Shop).where(Shop.id == session.shop_id)
    )
    shop = shop_result.scalar_one_or_none()
    is_customer = session.customer_id == user_id
    is_business = shop and shop.owner_id == user_id

    if not is_customer and not is_business:
        raise ForbiddenError("You are not a participant in this session")

    # Customer accepts the last business counter-offer; business accepts last customer offer
    if is_customer:
        offers = [m for m in session.messages if m.sender_role == "business" and m.offer_amount is not None]
        if not offers:
            raise BadRequestError("No business counter-offer to accept")
    else:
        offers = [m for m in session.messages if m.sender_role == "customer" and m.offer_amount is not None]
        if not offers:
            raise BadRequestError("No customer offer to accept")

    session.status = "accepted"
    session.final_price = offers[-1].offer_amount
    await db.flush()
    await db.refresh(session)

    # Reload with messages
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session.id)
    )
    accepted_session = result.scalar_one()

    # Fetch product name for notification
    product_result = await db.execute(
        select(Product).where(Product.id == session.product_id)
    )
    product = product_result.scalar_one_or_none()
    product_name = product.name if product else "a product"

    # Notify the OTHER party
    if is_customer and shop:
        # Customer accepted — notify business owner
        try:
            await create_notification(
                db,
                user_id=shop.owner_id,
                notification_type="haggle_accepted",
                reference_type="haggle_session",
                reference_id=session.id,
                product_name=product_name,
            )
        except Exception:
            pass
    elif is_business:
        # Business accepted — notify customer
        try:
            await create_notification(
                db,
                user_id=session.customer_id,
                notification_type="haggle_accepted",
                reference_type="haggle_session",
                reference_id=session.id,
                product_name=product_name,
            )
        except Exception:
            pass

    return accepted_session


async def reject_haggle(
    db: AsyncSession,
    session_id: UUID,
    owner_id: UUID,
) -> HaggleSession:
    """Reject a haggle session (business owner only)."""
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Haggle session not found")

    # Verify shop ownership
    shop_result = await db.execute(
        select(Shop).where(Shop.id == session.shop_id)
    )
    shop = shop_result.scalar_one_or_none()
    if not shop or shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    if session.status != "active":
        raise BadRequestError("This haggle session is no longer active")

    session.status = "rejected"
    await db.flush()
    await db.refresh(session)

    # Reload with messages
    result = await db.execute(
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(HaggleSession.id == session.id)
    )
    rejected_session = result.scalar_one()

    # Fetch product name and notify customer
    product_result = await db.execute(
        select(Product).where(Product.id == session.product_id)
    )
    product = product_result.scalar_one_or_none()
    product_name = product.name if product else "a product"

    try:
        await create_notification(
            db,
            user_id=session.customer_id,
            notification_type="haggle_rejected",
            reference_type="haggle_session",
            reference_id=session.id,
            product_name=product_name,
        )
    except Exception:
        pass

    return rejected_session


async def get_customer_haggles(
    db: AsyncSession,
    customer_id: UUID,
) -> tuple[list[HaggleSession], int]:
    """Get all active haggle sessions for a customer."""
    query = (
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(
            HaggleSession.customer_id == customer_id,
            HaggleSession.status == "active",
        )
        .order_by(HaggleSession.created_at.desc())
    )
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    return sessions, len(sessions)


async def get_shop_haggles(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
) -> tuple[list[HaggleSession], int]:
    """Get all active haggle sessions for a shop (owner only)."""
    # Verify shop ownership
    shop_result = await db.execute(
        select(Shop).where(Shop.id == shop_id)
    )
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    query = (
        select(HaggleSession)
        .options(selectinload(HaggleSession.messages))
        .where(
            HaggleSession.shop_id == shop_id,
            HaggleSession.status == "active",
        )
        .order_by(HaggleSession.created_at.desc())
    )
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    return sessions, len(sessions)
