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
from app.analytics.events import track_event


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
        # Use client-provided price or fall back to product's current price
        item_price = item.price if item.price is not None else float(product.price or 0)
        line_total = Decimal(str(item_price)) * item.quantity
        subtotal += line_total
        items_json.append(
            {
                "product_id": str(item.product_id),
                "name": product.name,
                "quantity": item.quantity,
                "price": item_price,
                "total": float(line_total),
                "ranking_context": item.ranking_context,
            }
        )

    # Calculate delivery fee based on shop settings
    delivery_fee = Decimal("0")
    if data.delivery_type == "delivery":
        shop_result_fee = await db.execute(select(Shop).where(Shop.id == data.shop_id))
        shop_for_fee = shop_result_fee.scalar_one_or_none()
        if shop_for_fee:
            # Check if shop supports delivery
            shop_delivery_opts = shop_for_fee.delivery_options or ["pickup"]
            if "delivery" not in shop_delivery_opts:
                raise BadRequestError("This shop does not offer delivery")

            # Check minimum order
            if shop_for_fee.min_order and subtotal < shop_for_fee.min_order:
                raise BadRequestError(
                    f"Minimum order amount is ₹{shop_for_fee.min_order}. "
                    f"Your cart is ₹{subtotal}."
                )

            # Calculate fee: free if above threshold, else shop's delivery fee
            fee_amount = Decimal(str(shop_for_fee.delivery_fee or 0))
            free_above = shop_for_fee.free_delivery_above
            if free_above and subtotal >= free_above:
                delivery_fee = Decimal("0")  # Free delivery
            else:
                delivery_fee = fee_amount

    total = subtotal + delivery_fee

    order_number = (
        f"NS-{datetime.now().strftime('%y%m%d')}-{random.randint(10000, 99999)}"
    )

    order = Order(
        order_number=order_number,
        customer_id=customer_id,
        shop_id=data.shop_id,
        items=items_json,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=total,
        delivery_type=data.delivery_type,
        delivery_address=data.delivery_address,
        payment_method=data.payment_method,
        notes=data.notes,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)

    for item in data.items:
        product = available_products[item.product_id]
        ranking_context = item.ranking_context or {}
        purchase_meta = {
            **ranking_context,
            "shop_id": str(data.shop_id),
            "order_id": str(order.id),
            "quantity": item.quantity,
            "price": float(item.price if item.price is not None else product.price or 0),
            "category": product.category,
            "subcategory": product.subcategory,
            "tags": product.tags or [],
        }
        await track_event(
            db,
            user_id=customer_id,
            event_type="purchase",
            entity_type="product",
            entity_id=item.product_id,
            metadata=purchase_meta,
        )

    # Decrement stock for tracked products
    try:
        from app.inventory.service import record_sale
        for item in data.items:
            await record_sale(db, item.product_id, item.quantity)
    except Exception:
        pass  # Don't fail order if stock tracking has issues

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

    # Enrich orders with customer names and phones
    if orders:
        from app.auth.models import User
        customer_ids = list({o.customer_id for o in orders})
        users_result = await db.execute(
            select(User).where(User.id.in_(customer_ids))
        )
        users_map = {u.id: u for u in users_result.scalars().all()}
        for order in orders:
            user = users_map.get(order.customer_id)
            if user:
                order.customer_name = getattr(user, 'name', None) or ''
                order.customer_phone = getattr(user, 'phone', None) or ''

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
