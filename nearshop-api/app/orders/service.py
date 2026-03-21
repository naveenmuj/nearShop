import random
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.notifications.service import create_notification
from app.orders.models import Order
from app.orders.schemas import OrderCreate
from app.products.models import Product
from app.shops.models import Shop


VALID_TRANSITIONS = {
    "pending": "confirmed",
    "confirmed": "preparing",
    "preparing": "ready",
    "ready": "completed",
}

CANCELLABLE_STATUSES = {"pending", "confirmed"}


async def create_order(
    db: AsyncSession,
    customer_id: UUID,
    data: OrderCreate,
) -> Order:
    """Create a new order after validating products."""
    product_ids = [item.product_id for item in data.items]

    result = await db.execute(
        select(Product).where(
            and_(
                Product.id.in_(product_ids),
                Product.is_available == True,
            )
        )
    )
    available_products = {p.id: p for p in result.scalars().all()}

    for item in data.items:
        if item.product_id not in available_products:
            raise BadRequestError(
                f"Product {item.product_id} is not available"
            )

    subtotal = Decimal("0")
    items_json = []
    for item in data.items:
        product = available_products[item.product_id]
        line_total = Decimal(str(item.price)) * item.quantity
        subtotal += line_total
        items_json.append(
            {
                "product_id": str(item.product_id),
                "name": product.name,
                "quantity": item.quantity,
                "price": float(item.price),
                "total": float(line_total),
            }
        )

    order_number = (
        f"NS-{datetime.now().strftime('%y%m%d')}-{random.randint(10000, 99999)}"
    )

    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        shop_id=data.shop_id,
        items=items_json,
        subtotal=subtotal,
        total=subtotal,
        delivery_type=data.delivery_type,
        delivery_address=data.delivery_address,
        payment_method=data.payment_method,
        notes=data.notes,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    # Notify shop owner about new order
    shop_result = await db.execute(select(Shop).where(Shop.id == data.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        try:
            await create_notification(
                db,
                user_id=shop.owner_id,
                notification_type="new_order",
                reference_type="order",
                reference_id=order.id,
                order_number=order.order_number,
            )
        except Exception:
            pass

    return order


async def update_status(
    db: AsyncSession,
    order_id: UUID,
    owner_id: UUID,
    new_status: str,
) -> Order:
    """Update order status, verifying shop ownership and valid transitions."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundError("Order not found")

    # Verify shop ownership
    shop_result = await db.execute(select(Shop).where(Shop.id == order.shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop or shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    current_status = order.status

    # Allow cancellation from any state
    if new_status == "cancelled":
        order.status = "cancelled"
        await db.flush()
        await db.refresh(order)
        try:
            await create_notification(
                db,
                user_id=order.customer_id,
                notification_type="order_cancelled",
                reference_type="order",
                reference_id=order.id,
                order_number=order.order_number,
            )
        except Exception:
            pass
        return order

    # Validate sequential transitions
    expected_next = VALID_TRANSITIONS.get(current_status)
    if expected_next is None or expected_next != new_status:
        raise BadRequestError(
            f"Cannot transition from '{current_status}' to '{new_status}'"
        )

    order.status = new_status
    await db.flush()
    await db.refresh(order)

    # Notify customer on key status changes
    _STATUS_NOTIFICATION_MAP = {
        "confirmed": "order_confirmed",
        "ready": "order_ready",
        "completed": "order_delivered",
    }
    notif_type = _STATUS_NOTIFICATION_MAP.get(new_status)
    if notif_type:
        try:
            await create_notification(
                db,
                user_id=order.customer_id,
                notification_type=notif_type,
                reference_type="order",
                reference_id=order.id,
                order_number=order.order_number,
                shop_name=shop.name,
            )
        except Exception:
            pass

    return order


async def get_customer_orders(
    db: AsyncSession,
    customer_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Order], int]:
    """Get paginated orders for a customer."""
    count_result = await db.execute(
        select(func.count()).select_from(Order).where(
            Order.customer_id == customer_id
        )
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    orders = list(result.scalars().all())

    return orders, total


async def get_shop_orders(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
    status_filter: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Order], int]:
    """Get paginated orders for a shop, verifying ownership."""
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")

    base_query = select(Order).where(Order.shop_id == shop_id)
    count_query = select(func.count()).select_from(Order).where(
        Order.shop_id == shop_id
    )

    if status_filter:
        base_query = base_query.where(Order.status == status_filter)
        count_query = count_query.where(Order.status == status_filter)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        base_query.order_by(Order.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    orders = list(result.scalars().all())

    return orders, total


async def cancel_order(
    db: AsyncSession,
    order_id: UUID,
    user_id: UUID,
) -> Order:
    """Cancel an order if it is still in a cancellable state."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundError("Order not found")

    # Verify the user is either the customer or the shop owner
    if order.customer_id != user_id:
        shop_result = await db.execute(select(Shop).where(Shop.id == order.shop_id))
        shop = shop_result.scalar_one_or_none()
        if not shop or shop.owner_id != user_id:
            raise ForbiddenError("You are not authorized to cancel this order")

    if order.status not in CANCELLABLE_STATUSES:
        raise BadRequestError(
            f"Cannot cancel order with status '{order.status}'"
        )

    order.status = "cancelled"
    await db.flush()
    await db.refresh(order)
    return order
