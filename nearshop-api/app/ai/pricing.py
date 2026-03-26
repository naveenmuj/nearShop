"""Competitive price suggestion with conservative local comparables."""
import statistics

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.products.models import Product
from app.shops.models import Shop


async def suggest_price(db: AsyncSession, product_id, shop_id) -> dict:
    """Suggest a price using nearby, category-consistent comparables only."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}

    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return {"error": "Shop not found"}

    current_price = float(product.price or 0)
    target_tags = {
        tag.strip().lower()
        for tag in (product.tags or [])
        if isinstance(tag, str) and tag.strip()
    }
    min_band = max(current_price * 0.35, 1)
    max_band = current_price * 3.0 if current_price > 0 else None

    stmt = (
        select(
            Product.price,
            Product.view_count,
            Product.wishlist_count,
            Product.name,
            Product.category,
            Product.subcategory,
            Product.tags,
        )
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.category == product.category)
        .where(Product.is_available == True)  # noqa: E712
        .where(Product.id != product_id)
        .where(within_radius(Shop.latitude, Shop.longitude, shop.latitude, shop.longitude, 5.0))
        .limit(100)
    )

    rows = (await db.execute(stmt)).fetchall()

    def comparable_score(row) -> float:
        score = 0.0
        row_price = float(row.price or 0)
        if product.subcategory and row.subcategory == product.subcategory:
            score += 4
        if target_tags and row.tags:
            overlap = target_tags.intersection(
                {tag.strip().lower() for tag in row.tags if isinstance(tag, str)}
            )
            score += min(len(overlap), 3) * 1.5
        if current_price > 0 and row_price > 0:
            ratio = max(row_price / current_price, current_price / row_price)
            if ratio <= 1.5:
                score += 3
            elif ratio <= 2.0:
                score += 2
            elif ratio <= 3.0:
                score += 1
        return score

    filtered_rows = []
    for row in rows:
        row_price = float(row.price or 0)
        if row_price <= 0:
            continue
        if row_price < min_band:
            continue
        if max_band is not None and row_price > max_band:
            continue
        score = comparable_score(row)
        if product.subcategory and row.subcategory != product.subcategory and score < 3:
            continue
        if not product.subcategory and score < 2:
            continue
        filtered_rows.append((score, row))

    filtered_rows.sort(key=lambda item: (-item[0], float(item[1].price)))
    prices = [float(row.price) for _, row in filtered_rows[:20]]

    if not prices:
        demand_signal = _demand_signal(product)
        return {
            "suggested_price": current_price,
            "current_price": current_price,
            "confidence": "low",
            "reason": "No comparable products found nearby",
            "comparables_count": 0,
            "demand_signal": demand_signal,
            "elasticity_note": _elasticity_note(demand_signal, current_price, current_price),
        }

    avg_price = statistics.mean(prices)
    median_price = statistics.median(prices)
    min_price = min(prices)
    max_price = max(prices)

    demand = _demand_signal(product)
    if demand == "high":
        suggested = min(median_price * 1.08, max_price)
    elif demand == "low" and current_price > median_price:
        suggested = median_price * 0.95
    else:
        suggested = median_price

    floor = current_price * 0.8 if current_price > 0 else suggested
    ceiling = current_price * 1.25 if current_price > 0 else suggested
    suggested = round(min(max(suggested, floor), ceiling), 2)

    return {
        "suggested_price": suggested,
        "current_price": current_price,
        "average_price": round(avg_price, 2),
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "median_price": round(median_price, 2),
        "comparables_count": len(prices),
        "confidence": "high" if len(prices) >= 8 else "medium" if len(prices) >= 3 else "low",
        "reason": f"Based on {len(prices)} nearby comparable {product.subcategory or product.category} products",
        "demand_signal": demand,
        "elasticity_note": _elasticity_note(demand, current_price, median_price),
    }


def _demand_signal(product: Product) -> str:
    views = product.view_count or 0
    wishlists = product.wishlist_count or 0
    inquiries = getattr(product, "inquiry_count", 0) or 0
    engagement = views + wishlists * 3 + inquiries * 5
    if engagement >= 30:
        return "high"
    if engagement >= 10:
        return "medium"
    return "low"


def _elasticity_note(demand: str, current: float, median: float) -> str:
    if demand == "high" and current < median * 1.05:
        return "High demand detected - you may be underpricing. Consider a small increase."
    if demand == "low" and current > median * 1.05:
        return "Low engagement - reducing price closer to the local market may boost sales."
    if demand == "high":
        return "Strong demand at current price - keep it up."
    if demand == "medium":
        return "Moderate demand - price looks competitive."
    return "Low engagement - consider promoting this product."
