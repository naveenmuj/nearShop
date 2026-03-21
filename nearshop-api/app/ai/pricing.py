import statistics

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.products.models import Product
from app.shops.models import Shop


async def suggest_price(db: AsyncSession, product_id, shop_id) -> dict:
    """Suggest pricing based on similar products in the area."""
    # Get the target product
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}

    # Find the shop to get its location
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return {"error": "Shop not found"}

    # Query similar products within 5km by same category
    stmt = (
        select(Product.price)
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.category == product.category)
        .where(Product.is_available == True)  # noqa: E712
        .where(Product.id != product_id)
        .where(within_radius(Shop.latitude, Shop.longitude, shop.latitude, shop.longitude, 5.0))
        .limit(50)
    )

    result = await db.execute(stmt)
    prices = [float(row.price) for row in result]

    if not prices:
        return {
            "suggested_price": float(product.price),
            "confidence": "low",
            "reason": "No comparable products found nearby",
            "comparables_count": 0,
        }

    avg_price = statistics.mean(prices)
    median_price = statistics.median(prices)
    min_price = min(prices)
    max_price = max(prices)

    return {
        "suggested_price": round(median_price, 2),
        "average_price": round(avg_price, 2),
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "median_price": round(median_price, 2),
        "comparables_count": len(prices),
        "confidence": "high" if len(prices) >= 10 else "medium" if len(prices) >= 3 else "low",
        "reason": f"Based on {len(prices)} similar {product.category} products within 5km",
    }
