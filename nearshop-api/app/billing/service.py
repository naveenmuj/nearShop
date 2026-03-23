from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Bill
from app.shops.models import Shop
from app.products.models import Product
from app.core.exceptions import NotFoundError


async def generate_bill_number(db: AsyncSession, shop_id: UUID) -> str:
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    prefix = f"BILL-{today}-"
    result = await db.execute(
        select(func.count()).select_from(Bill)
        .where(Bill.shop_id == shop_id, Bill.bill_number.like(f"{prefix}%"))
    )
    count = (result.scalar() or 0) + 1
    return f"{prefix}{count:04d}"


async def create_bill(db: AsyncSession, shop_id: UUID, data: dict) -> Bill:
    shop = await db.get(Shop, shop_id)
    if not shop:
        raise NotFoundError("Shop not found")

    items = []
    subtotal = Decimal("0")
    for item in data.get("items", []):
        product = None
        pid = item.get("product_id")
        if pid:
            try:
                product = await db.get(Product, UUID(pid))
            except Exception:
                pass

        name = item.get("name") or (product.name if product else "Item")
        price = Decimal(str(item.get("price", 0)))
        qty = int(item.get("quantity", 1))
        item_total = price * qty
        subtotal += item_total

        items.append({
            "product_id": str(pid or ""),
            "name": name,
            "price": float(price),
            "quantity": qty,
            "total": float(item_total),
        })

    gst_pct = Decimal(str(data.get("gst_percentage", 0)))
    gst_amount = subtotal * gst_pct / 100
    discount = Decimal(str(data.get("discount_amount", 0)))
    delivery = Decimal(str(data.get("delivery_fee", 0)))
    total = subtotal + gst_amount - discount + delivery

    bill = Bill(
        bill_number=await generate_bill_number(db, shop_id),
        shop_id=shop_id,
        customer_name=data.get("customer_name"),
        customer_phone=data.get("customer_phone"),
        items=items,
        subtotal=subtotal,
        gst_amount=gst_amount,
        gst_percentage=gst_pct,
        discount_amount=discount,
        delivery_fee=delivery,
        total=total,
        payment_method=data.get("payment_method", "cash"),
        payment_status=data.get("payment_status", "paid"),
        notes=data.get("notes"),
    )
    db.add(bill)
    await db.flush()
    return bill


async def get_shop_bills(
    db: AsyncSession, shop_id: UUID, page: int = 1, per_page: int = 20, status: str = None,
) -> dict:
    query = select(Bill).where(Bill.shop_id == shop_id)
    count_q = select(func.count()).select_from(Bill).where(Bill.shop_id == shop_id)

    if status:
        query = query.where(Bill.payment_status == status)
        count_q = count_q.where(Bill.payment_status == status)

    total_count = (await db.execute(count_q)).scalar() or 0

    total_revenue = (await db.execute(
        select(func.sum(Bill.total)).where(Bill.shop_id == shop_id, Bill.payment_status == "paid")
    )).scalar() or 0
    unpaid_total = (await db.execute(
        select(func.sum(Bill.total)).where(Bill.shop_id == shop_id, Bill.payment_status == "unpaid")
    )).scalar() or 0

    result = await db.execute(
        query.order_by(desc(Bill.created_at)).offset((page - 1) * per_page).limit(per_page)
    )
    bills = result.scalars().all()

    return {
        "bills": [_to_dict(b) for b in bills],
        "total_count": total_count,
        "total_revenue": float(total_revenue),
        "unpaid_total": float(unpaid_total),
        "page": page,
        "per_page": per_page,
    }


async def get_bill_detail(db: AsyncSession, bill_id: UUID) -> dict:
    bill = await db.get(Bill, bill_id)
    if not bill:
        raise NotFoundError("Bill not found")
    shop = await db.get(Shop, bill.shop_id)
    return {
        **_to_dict(bill),
        "shop": {
            "name": shop.name if shop else "",
            "address": shop.address if shop else "",
            "phone": shop.phone if shop else "",
            "whatsapp": shop.whatsapp if shop else "",
        },
    }


async def update_bill_status(db: AsyncSession, bill_id: UUID, status: str) -> Bill:
    bill = await db.get(Bill, bill_id)
    if not bill:
        raise NotFoundError("Bill not found")
    bill.payment_status = status
    await db.flush()
    return bill


async def get_bill_stats(db: AsyncSession, shop_id: UUID, period: str = "30d") -> dict:
    from datetime import timedelta
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    total_bills = (await db.execute(
        select(func.count()).select_from(Bill).where(Bill.shop_id == shop_id, Bill.created_at >= start)
    )).scalar() or 0
    total_revenue = float((await db.execute(
        select(func.sum(Bill.total)).where(Bill.shop_id == shop_id, Bill.created_at >= start, Bill.payment_status == "paid")
    )).scalar() or 0)
    avg_bill = float((await db.execute(
        select(func.avg(Bill.total)).where(Bill.shop_id == shop_id, Bill.created_at >= start)
    )).scalar() or 0)
    total_gst = float((await db.execute(
        select(func.sum(Bill.gst_amount)).where(Bill.shop_id == shop_id, Bill.created_at >= start)
    )).scalar() or 0)

    return {
        "total_bills": total_bills,
        "total_revenue": total_revenue,
        "avg_bill_value": round(avg_bill, 2),
        "total_gst_collected": total_gst,
    }


def _to_dict(bill: Bill) -> dict:
    return {
        "id": str(bill.id),
        "bill_number": bill.bill_number,
        "customer_name": bill.customer_name,
        "customer_phone": bill.customer_phone,
        "items": bill.items,
        "subtotal": float(bill.subtotal),
        "gst_amount": float(bill.gst_amount or 0),
        "gst_percentage": float(bill.gst_percentage or 0),
        "discount_amount": float(bill.discount_amount or 0),
        "delivery_fee": float(bill.delivery_fee or 0),
        "total": float(bill.total),
        "payment_method": bill.payment_method,
        "payment_status": bill.payment_status,
        "notes": bill.notes,
        "created_at": str(bill.created_at),
    }
