"""
Enrich demo data for merchant operational-insights validation.

Run from the nearshop-api directory:
    python scripts/seed_operational_insights_demo.py

This script is idempotent enough for repeated validation runs:
- it creates a small reusable set of demo customers
- it only tops shops up to the target order count
- it stamps generated orders with the "OI-" prefix
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.auth.models import SearchLog, User
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop
import app.reviews.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.stories.models  # noqa: F401
import app.community.models  # noqa: F401
import app.loyalty.models  # noqa: F401
import app.delivery.models  # noqa: F401
import app.haggle.models  # noqa: F401
import app.reservations.models  # noqa: F401
import app.notifications.models  # noqa: F401
import app.udhaar.models  # noqa: F401


settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
NOW = datetime.now(timezone.utc)
TARGET_ORDER_COUNT = 30
TARGET_CUSTOMER_COUNT = 26
TARGET_SHOPS = 5
TARGET_QUERY_LOG_COUNT = 48


CUSTOMER_FIXTURES = [
    {
        "phone": f"+91970000{100 + idx:04d}",
        "name": f"Demo Customer {idx:02d}",
        "lat": 12.9345 + ((idx % 6) * 0.00045),
        "lng": 77.6232 + ((idx % 5) * 0.0005),
    }
    for idx in range(1, 31)
]

QUERY_MAP = {
    "electronics": ["wireless earbuds", "gaming headset", "usb c charger", "bluetooth speaker", "iphone cover"],
    "groceries": ["fresh fruits", "milk delivery", "atta 5kg", "vegetables near me", "rice offer"],
    "fashion": ["cotton kurti", "men sneakers", "ethnic wear", "denim jeans", "party dress"],
    "food-beverages": ["home cooked lunch", "tiffin service", "paneer combo", "daily meal plan", "veg thali"],
    "books-stationery": ["notebook pack", "exam guide", "geometry box", "bestseller books", "art supplies"],
}


async def create_or_get_customer(session: AsyncSession, phone: str, name: str, lat: float, lng: float) -> User:
    result = await session.execute(select(User).where(User.phone == phone))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    user = User(
        phone=phone,
        name=name,
        roles=["customer"],
        active_role="customer",
        latitude=lat,
        longitude=lng,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


def build_order_number(shop_id: str, idx: int) -> str:
    suffix = shop_id.replace("-", "")[:6].upper()
    return f"OI-{suffix}-{idx:04d}"


def build_items(product_rows: list[Product], offset: int) -> tuple[list[dict], Decimal]:
    chosen = product_rows[: min(2, len(product_rows))]
    items = []
    subtotal = Decimal("0")
    for pos, product in enumerate(chosen):
        quantity = 1 + ((offset + pos) % 2)
        price = Decimal(str(product.price or 0))
        line_total = price * quantity
        subtotal += line_total
        items.append(
            {
                "product_id": str(product.id),
                "name": product.name,
                "quantity": quantity,
                "price": float(price),
                "total": float(line_total),
            }
        )
    return items, subtotal


async def enrich_shop(session: AsyncSession, shop: Shop, customers: list[User]) -> dict:
    products_result = await session.execute(
        select(Product)
        .where(and_(Product.shop_id == shop.id, Product.is_available == True))
        .order_by(Product.created_at.asc())
    )
    products = list(products_result.scalars().all())
    if not products:
        return {"shop": shop.name, "skipped": "no available products"}

    for idx, product in enumerate(products[:5]):
        if product.stock_quantity is None:
            product.stock_quantity = 22 - (idx * 4)
        if product.low_stock_threshold is None or product.low_stock_threshold <= 0:
            product.low_stock_threshold = 5
        if idx == 0:
            product.stock_quantity = min(product.stock_quantity, 4)
            product.low_stock_threshold = max(product.low_stock_threshold, 5)
        elif idx == 1:
            product.stock_quantity = min(product.stock_quantity, 7)
            product.low_stock_threshold = max(product.low_stock_threshold, 6)
        else:
            product.stock_quantity = max(product.stock_quantity, 12)

    total_orders_result = await session.execute(
        select(func.count())
        .select_from(Order)
        .where(
            and_(
                Order.shop_id == shop.id,
                Order.created_at >= NOW - timedelta(days=30),
                Order.status.not_in(["cancelled", "rejected"]),
            )
        )
    )
    total_orders = int(total_orders_result.scalar() or 0)

    existing_demo_result = await session.execute(
        select(func.count())
        .select_from(Order)
        .where(and_(Order.shop_id == shop.id, Order.order_number.like("OI-%")))
    )
    demo_orders = int(existing_demo_result.scalar() or 0)

    existing_customer_result = await session.execute(
        select(Order.customer_id)
        .where(
            and_(
                Order.shop_id == shop.id,
                Order.status.not_in(["cancelled", "rejected"]),
            )
        )
        .distinct()
    )
    existing_customer_ids = {row[0] for row in existing_customer_result.all()}
    missing_customers = [customer for customer in customers if customer.id not in existing_customer_ids]

    created_orders = 0
    for idx, customer in enumerate(missing_customers[: max(TARGET_CUSTOMER_COUNT - len(existing_customer_ids), 0)]):
        created_at = NOW - timedelta(days=(idx % 24), hours=(idx % 4) * 3)
        items, subtotal = build_items(products, idx)
        order = Order(
            order_number=build_order_number(str(shop.id), demo_orders + created_orders + 1),
            customer_id=customer.id,
            shop_id=shop.id,
            items=items,
            subtotal=subtotal,
            delivery_fee=Decimal("0"),
            discount=Decimal("0"),
            total=subtotal,
            status="completed" if idx % 5 else "confirmed",
            delivery_type="delivery",
            delivery_address=f"{customer.name}, Demo Address, Koramangala, Bengaluru",
            payment_method="cod",
            payment_status="paid",
            created_at=created_at,
        )
        session.add(order)
        created_orders += 1

    total_after_customer_fill = total_orders + created_orders
    top_up_orders = max(TARGET_ORDER_COUNT - total_after_customer_fill, 0)
    for idx in range(top_up_orders):
        created_at = NOW - timedelta(days=(idx % 20), hours=(idx % 6) * 2 + 1)
        customer = customers[idx % min(len(customers), TARGET_CUSTOMER_COUNT)]
        items, subtotal = build_items(products, idx + created_orders)
        order = Order(
            order_number=build_order_number(str(shop.id), demo_orders + created_orders + idx + 1),
            customer_id=customer.id,
            shop_id=shop.id,
            items=items,
            subtotal=subtotal,
            delivery_fee=Decimal("0"),
            discount=Decimal("0"),
            total=subtotal,
            status="completed" if idx % 4 else "confirmed",
            delivery_type="delivery",
            delivery_address=f"{customer.name}, Demo Address, Koramangala, Bengaluru",
            payment_method="cod",
            payment_status="paid",
            created_at=created_at,
        )
        session.add(order)

    query_terms = QUERY_MAP.get(shop.category or "", ["local offers", "best deals", "nearby shop"])
    existing_query_count_result = await session.execute(
        select(func.count())
        .select_from(SearchLog)
        .where(
            and_(
                SearchLog.user_id.in_([customer.id for customer in customers]),
                SearchLog.query_text.in_(query_terms),
                SearchLog.created_at >= NOW - timedelta(days=30),
            )
        )
    )
    existing_query_count = int(existing_query_count_result.scalar() or 0)
    query_logs_to_create = max(TARGET_QUERY_LOG_COUNT - existing_query_count, 0)
    for idx in range(query_logs_to_create):
        query_text = query_terms[idx % len(query_terms)]
        customer = customers[idx % len(customers)]
        log = SearchLog(
            user_id=customer.id,
            query_text=query_text,
            query=query_text,
            search_type="text",
            latitude=(shop.latitude or customer.latitude or 12.935) + ((idx % 3) * 0.0004),
            longitude=(shop.longitude or customer.longitude or 77.624) + ((idx % 2) * 0.0004),
            results_count=6 + (idx % 4),
            created_at=NOW - timedelta(days=idx % 12, hours=idx % 6),
        )
        session.add(log)

    return {
        "shop": shop.name,
        "products_prepared": min(len(products), 5),
        "orders_before": total_orders,
        "orders_created": created_orders + top_up_orders,
        "queries_created": query_logs_to_create,
    }


async def main() -> None:
    async with async_session() as session:
        customers = []
        for fixture in CUSTOMER_FIXTURES:
            customers.append(await create_or_get_customer(session, **fixture))

        shops_result = await session.execute(
            select(Shop)
            .outerjoin(Order, Order.shop_id == Shop.id)
            .where(Shop.is_active == True)
            .group_by(Shop.id)
            .order_by(func.count(Order.id).desc(), Shop.created_at.asc())
            .limit(TARGET_SHOPS)
        )
        shops = list(shops_result.scalars().all())

        report = []
        for shop in shops:
            report.append(await enrich_shop(session, shop, customers))

        await session.commit()
        for row in report:
            print(row)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
