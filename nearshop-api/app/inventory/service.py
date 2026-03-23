from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.inventory.models import StockLog
from app.products.models import Product


async def restock_product(
    db: AsyncSession, product_id: UUID, quantity: int,
    purchase_price: float = None, supplier: str = None, notes: str = None,
) -> dict:
    product = await db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")

    if product.stock_quantity is None:
        product.stock_quantity = 0
    product.stock_quantity += quantity
    if purchase_price:
        product.purchase_price = purchase_price

    if not product.is_available and product.stock_quantity > 0:
        product.is_available = True

    log = StockLog(
        product_id=product_id, shop_id=product.shop_id,
        change_type="restock", quantity_change=quantity,
        quantity_after=product.stock_quantity,
        purchase_price=purchase_price, supplier_name=supplier, notes=notes,
    )
    db.add(log)
    await db.flush()

    return {"product_id": str(product_id), "name": product.name, "new_quantity": product.stock_quantity}


async def record_sale(db: AsyncSession, product_id: UUID, quantity: int = 1) -> None:
    product = await db.get(Product, product_id)
    if not product or product.stock_quantity is None:
        return

    product.stock_quantity = max(0, (product.stock_quantity or 0) - quantity)

    log = StockLog(
        product_id=product_id, shop_id=product.shop_id,
        change_type="sold", quantity_change=-quantity,
        quantity_after=product.stock_quantity,
    )
    db.add(log)

    if product.stock_quantity == 0:
        product.is_available = False

    await db.flush()


async def get_low_stock_products(db: AsyncSession, shop_id: UUID) -> list:
    result = await db.execute(
        select(Product).where(
            Product.shop_id == shop_id,
            Product.stock_quantity.isnot(None),
            Product.stock_quantity <= Product.low_stock_threshold,
        ).order_by(Product.stock_quantity.asc())
    )
    return [
        {
            "id": str(p.id), "name": p.name, "stock": p.stock_quantity,
            "threshold": p.low_stock_threshold, "price": float(p.price),
            "image": p.images[0] if p.images else None,
        }
        for p in result.scalars().all()
    ]


async def get_stock_value(db: AsyncSession, shop_id: UUID) -> dict:
    result = await db.execute(
        select(
            func.count().label("tracked"),
            func.coalesce(func.sum(Product.stock_quantity), 0).label("units"),
            func.coalesce(func.sum(Product.stock_quantity * Product.purchase_price), 0).label("cost"),
            func.coalesce(func.sum(Product.stock_quantity * Product.price), 0).label("retail"),
        ).where(Product.shop_id == shop_id, Product.stock_quantity.isnot(None), Product.stock_quantity > 0)
    )
    row = result.one()
    return {
        "tracked_products": row.tracked or 0,
        "total_units": int(row.units or 0),
        "cost_value": float(row.cost or 0),
        "retail_value": float(row.retail or 0),
        "potential_profit": float((row.retail or 0) - (row.cost or 0)),
    }


async def get_stock_logs(db: AsyncSession, product_id: UUID, limit: int = 20) -> list:
    result = await db.execute(
        select(StockLog).where(StockLog.product_id == product_id)
        .order_by(StockLog.created_at.desc()).limit(limit)
    )
    return [
        {
            "id": str(l.id), "type": l.change_type, "quantity": l.quantity_change,
            "after": l.quantity_after, "purchase_price": float(l.purchase_price) if l.purchase_price else None,
            "supplier": l.supplier_name, "notes": l.notes, "date": str(l.created_at),
        }
        for l in result.scalars().all()
    ]


async def get_margin_report(db: AsyncSession, shop_id: UUID) -> list:
    result = await db.execute(
        select(Product).where(
            Product.shop_id == shop_id, Product.purchase_price.isnot(None),
            Product.purchase_price > 0, Product.is_available == True,
        ).order_by((Product.price - Product.purchase_price).desc()).limit(30)
    )
    return [
        {
            "id": str(p.id), "name": p.name, "selling_price": float(p.price),
            "cost_price": float(p.purchase_price), "margin": float(p.price - p.purchase_price),
            "margin_pct": round(float((p.price - p.purchase_price) / p.price) * 100, 1) if p.price else 0,
            "stock": p.stock_quantity,
        }
        for p in result.scalars().all()
    ]
