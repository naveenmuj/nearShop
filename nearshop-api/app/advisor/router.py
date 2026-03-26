import logging
from typing import Optional

from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.products.models import Product
from app.orders.models import Order
from app.advisor import service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/advisor", tags=["advisor"])


async def _get_shop_id(user: User, db: AsyncSession):
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


async def _get_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop


@router.get("/suggestions")
async def get_suggestions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    suggestions = await service.get_smart_suggestions(db, shop_id)
    return {"suggestions": suggestions}


class AIChatRequest(BaseModel):
    question: str
    context: Optional[str] = None


@router.post("/chat")
async def ai_advisor_chat(
    body: AIChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-powered business advisor chat using shop data and OpenAI."""
    shop = await _get_shop(user, db)

    # Gather shop statistics for context
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d7 = now - timedelta(days=7)

    # Product stats
    products_result = await db.execute(
        select(func.count(), func.sum(Product.view_count))
        .where(Product.shop_id == shop.id, Product.is_available == True)
    )
    prod_row = products_result.one()
    total_products = prod_row[0] or 0
    total_views = prod_row[1] or 0

    # Order stats (30 days)
    orders_result = await db.execute(
        select(func.count(), func.coalesce(func.sum(Order.total), 0))
        .where(
            Order.shop_id == shop.id,
            Order.created_at >= d30,
            Order.status.not_in(["cancelled", "rejected"]),
        )
    )
    ord_row = orders_result.one()
    orders_30d = ord_row[0] or 0
    revenue_30d = float(ord_row[1] or 0)

    # Orders (7 days)
    orders_7d_result = await db.execute(
        select(func.count()).where(Order.shop_id == shop.id, Order.created_at >= d7)
    )
    orders_7d = orders_7d_result.scalar() or 0

    # Top products
    top_products = (await db.execute(
        select(Product.name, Product.price, Product.view_count, Product.inquiry_count)
        .where(Product.shop_id == shop.id, Product.is_available == True)
        .order_by(Product.view_count.desc())
        .limit(5)
    )).all()

    shop_context = f"""
Shop: {shop.name}
Category: {shop.category or 'General'}
Description: {shop.description or 'Not set'}
Location: {shop.address or 'Not set'}
Total Products: {total_products}
Total Views: {total_views}
Orders (7d): {orders_7d}
Orders (30d): {orders_30d}
Revenue (30d): ₹{revenue_30d:,.0f}
Avg Rating: {float(shop.avg_rating or 0):.1f}
Reviews: {shop.total_reviews or 0}
Top Products: {', '.join(f'{p[0]} (₹{p[1]}, {p[2]} views)' for p in top_products[:5])}
"""

    try:
        from app.ai.tracker import tracked_chat

        response = await tracked_chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert business advisor for local shop owners on NearShop, "
                        "a hyperlocal e-commerce platform in India. "
                        "Provide actionable, specific advice based on the shop's data. "
                        "Keep responses concise (3-5 bullet points max). "
                        "Use ₹ for prices. Focus on practical tips to increase sales, "
                        "attract customers, and grow the business. "
                        "Be encouraging and supportive."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Here is my shop data:\n{shop_context}\n\nMy question: {body.question}",
                },
            ],
            model="gpt-4o-mini",
            max_tokens=500,
            temperature=0.7,
            feature="advisor_chat",
            endpoint="/advisor/chat",
            user_id=user.id,
            shop_id=shop.id,
            request_metadata={"question_length": len(body.question)},
        )

        answer = response.choices[0].message.content
        return {"answer": answer, "shop_name": shop.name}

    except Exception as e:
        logger.warning(f"AI advisor chat failed: {e}")
        # Fallback: return basic data-driven advice
        tips = []
        if total_products == 0:
            tips.append("📸 Add products to your catalog using Snap & List for quick AI-powered listing.")
        if orders_7d == 0:
            tips.append("📢 Share your shop on WhatsApp to attract nearby customers.")
        if total_views > 0 and orders_30d == 0:
            tips.append("💰 You have views but no orders. Try creating deals with 10-20% discounts.")
        if float(shop.avg_rating or 0) < 4.0 and (shop.total_reviews or 0) > 0:
            tips.append("⭐ Focus on customer service to improve your rating.")
        if not tips:
            tips.append("🌟 Your shop is doing well! Keep adding fresh products and creating deals.")
        return {"answer": "\n".join(tips), "shop_name": shop.name, "fallback": True}


@router.get("/insights")
async def get_ai_insights(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get comprehensive AI-generated insights about the shop."""
    shop = await _get_shop(user, db)
    suggestions = await service.get_smart_suggestions(db, shop.id)

    # Generate a summary insight
    high_count = sum(1 for s in suggestions if s.get("priority") == "high")
    medium_count = sum(1 for s in suggestions if s.get("priority") == "medium")

    summary = "Your shop is performing well!" if high_count == 0 else f"You have {high_count} high-priority item{'s' if high_count > 1 else ''} to address."

    return {
        "summary": summary,
        "suggestions": suggestions,
        "high_priority_count": high_count,
        "total_suggestions": len(suggestions),
    }
