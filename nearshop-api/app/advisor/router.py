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
from app.ai.error_handling import classify_openai_error

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

    # Gather comprehensive shop statistics for context
    from datetime import datetime, timedelta, timezone
    from app.shops.models import Follow
    from app.deals.models import Deal
    
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d7 = now - timedelta(days=7)

    # Product stats
    products_result = await db.execute(
        select(func.count(), func.sum(Product.view_count), func.sum(Product.wishlist_count))
        .where(Product.shop_id == shop.id, Product.is_available == True)
    )
    prod_row = products_result.one()
    total_products = prod_row[0] or 0
    total_views = prod_row[1] or 0
    total_wishlists = prod_row[2] or 0

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
    
    # Follower count
    followers_result = await db.execute(
        select(func.count()).select_from(Follow).where(Follow.shop_id == shop.id)
    )
    follower_count = followers_result.scalar() or 0
    
    # Active deals count
    try:
        deals_result = await db.execute(
            select(func.count()).select_from(Deal).where(
                Deal.shop_id == shop.id,
                Deal.is_active == True,
                Deal.end_date >= now,
            )
        )
        active_deals = deals_result.scalar() or 0
    except:
        active_deals = 0

    # Top products by views
    top_products = (await db.execute(
        select(Product.name, Product.price, Product.view_count, Product.wishlist_count, Product.category)
        .where(Product.shop_id == shop.id, Product.is_available == True)
        .order_by(Product.view_count.desc())
        .limit(5)
    )).all()
    
    # Low performing products
    low_performing = (await db.execute(
        select(Product.name, Product.view_count)
        .where(Product.shop_id == shop.id, Product.is_available == True, Product.view_count < 5)
        .limit(3)
    )).all()
    
    # Categories in catalog
    categories_result = await db.execute(
        select(Product.category, func.count())
        .where(Product.shop_id == shop.id, Product.is_available == True, Product.category != None)
        .group_by(Product.category)
    )
    categories = [(c[0], c[1]) for c in categories_result.all() if c[0]]

    # Build comprehensive shop context
    shop_context = f"""
=== SHOP PROFILE ===
Shop Name: {shop.name}
Category: {shop.category or 'General Store'}
Description: {shop.description or 'Not set'}
Location: {shop.address or 'Not set'}
Rating: {float(shop.avg_rating or 0):.1f}/5 ({shop.total_reviews or 0} reviews)
Followers: {follower_count}

=== CATALOG STATS ===
Total Products: {total_products}
Product Categories: {', '.join(f'{c[0]} ({c[1]})' for c in categories) if categories else 'None categorized'}
Total Views: {total_views}
Wishlisted: {total_wishlists}

=== SALES PERFORMANCE ===
Orders (Last 7 days): {orders_7d}
Orders (Last 30 days): {orders_30d}
Revenue (Last 30 days): ₹{revenue_30d:,.0f}
Active Deals: {active_deals}

=== TOP PRODUCTS ===
{chr(10).join(f'• {p[0][:30]} - ₹{p[1]}, {p[2]} views, {p[3]} wishlists, {p[4] or "Uncategorized"}' for p in top_products[:5]) if top_products else 'No products yet'}

=== NEEDS ATTENTION ===
{chr(10).join(f'• {p[0][:30]} - only {p[1]} views' for p in low_performing) if low_performing else 'All products performing well'}
"""

    try:
        from app.ai.tracker import tracked_chat

        system_prompt = """You are an expert business advisor for local shop owners on NearShop, India's hyperlocal e-commerce platform.

Your role:
- Provide actionable, data-driven advice based on the shop's actual metrics
- Give specific, measurable recommendations (e.g., "reduce price by 10%", "add 5 more products")
- Be encouraging but honest about areas that need improvement
- Focus on practical tips that can be implemented today
- Use ₹ for prices and Indian business context

NearShop Platform Features the shop can use:
- Snap & List: AI-powered product listing from photos
- Deals & Offers: Create time-limited discounts to attract customers
- Stories: Share updates visible to followers for 24 hours
- Haggle: Allow customers to make price offers
- Shop QR Code: For offline promotion
- Push Notifications: Broadcast offers to followers
- Analytics Dashboard: Track views, orders, and revenue

Guidelines:
- Keep responses concise (3-5 bullet points for quick questions, up to 10 for detailed analysis)
- Always reference specific data from the shop's metrics
- Suggest next actions clearly
- If metrics are low, be constructive not discouraging"""

        response = await tracked_chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is my shop data:\n{shop_context}\n\nMy question: {body.question}"},
            ],
            model="gpt-4o-mini",
            max_tokens=800,
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
        ai_error = classify_openai_error(e)
        logger.error("AI advisor chat failed [%s]: %s", ai_error["code"], e, exc_info=True)
        # Fallback: return context-aware data-driven advice
        tips = [f"Live AI is unavailable right now ({ai_error['message']}). Based on your current shop data:"]
        
        # Prioritize based on question context
        question_lower = body.question.lower()
        
        if any(word in question_lower for word in ['grow', 'sales', 'increase', 'more']):
            if orders_7d == 0:
                tips.append("📢 Share your shop link on WhatsApp and social media to reach nearby customers.")
            if total_products < 5:
                tips.append("📸 Add more products (aim for 10+) to give customers more choice.")
            if float(shop.avg_rating or 0) < 4.0 and (shop.total_reviews or 0) > 0:
                tips.append("⭐ Focus on excellent service to improve your {:.1f} star rating.".format(shop.avg_rating))
            if follower_count < 10:
                tips.append(f"👥 You have {follower_count} followers. Share your shop to grow your audience.")
        elif any(word in question_lower for word in ['product', 'catalog', 'inventory']):
            if total_products == 0:
                tips.append("📸 Start by adding products using Snap & List for quick AI-powered listing.")
            else:
                tips.append("✨ You have {} products. Keep them updated with fresh photos and competitive prices.".format(total_products))
        elif any(word in question_lower for word in ['order', 'customer']):
            if orders_7d > 0:
                tips.append(f"🎉 Great! You have {orders_7d} orders this week. Keep up the momentum!")
            else:
                tips.append("💰 Create special deals with 10-20% discounts to attract first-time buyers.")
        elif any(word in question_lower for word in ['rating', 'review', 'feedback']):
            if (shop.total_reviews or 0) == 0:
                tips.append("⭐ Ask satisfied customers to leave reviews to build trust.")
            else:
                tips.append(f"⭐ You have {shop.total_reviews} reviews averaging {shop.avg_rating:.1f} stars.")
        elif any(word in question_lower for word in ['follower', 'follow']):
            tips.append(f"👥 You have {follower_count} followers. Share your shop link to grow your audience.")
        elif any(word in question_lower for word in ['deal', 'offer', 'discount']):
            tips.append(f"🏷️ You have {active_deals} active deals. Create time-limited offers to drive urgency.")
        else:
            # Default contextual tips
            if total_products == 0:
                tips.append("📸 Add products to your catalog using Snap & List for quick AI-powered listing.")
            if orders_7d == 0 and total_views == 0:
                tips.append("📢 Share your shop on WhatsApp to attract nearby customers.")
            elif orders_7d == 0 and total_views > 0:
                tips.append(f"💰 You have {total_views} views but no orders. Try creating deals with 10-20% discounts.")
            if orders_7d > 0:
                tips.append(f"🎉 You're doing well with {orders_7d} orders this week!")
        
        if len(tips) == 1:
            tips.append("🌟 Your shop is doing well! Keep adding fresh products and creating deals.")
        
        return {
            "answer": "\n\n".join(tips),
            "shop_name": shop.name,
            "fallback": True,
            "error_code": ai_error["code"],
            "retryable": ai_error["retryable"],
        }


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
