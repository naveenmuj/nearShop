"""Engagement router — Features 3, 5, 6, 14, 15."""
import random
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User, SearchLog
from app.auth.permissions import get_current_user, get_current_user_optional
from app.engagement.models import (
    UserRecentlyViewed,
    UserRecentSearch,
    OrderTrackingEvent,
    Achievement,
    UserAchievement,
    DailySpin,
)
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop
from app.loyalty.service import earn_coins

router = APIRouter(tags=["engagement"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RecentlyViewedItem(BaseModel):
    product_id: str
    name: str
    price: float
    image_url: Optional[str] = None
    shop_name: Optional[str] = None
    viewed_at: datetime

    class Config:
        from_attributes = True


class SearchSuggestionsResponse(BaseModel):
    suggestions: list[str]
    trending: list[str]
    recent: list[str]


class TrackingEvent(BaseModel):
    status: str
    title: str
    description: str
    timestamp: Optional[datetime] = None
    completed: bool


class OrderTrackingResponse(BaseModel):
    order_id: str
    current_status: str
    estimated_delivery: Optional[datetime] = None
    timeline: list[TrackingEvent]


class AchievementOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    coins_reward: int
    criteria_type: Optional[str] = None
    criteria_value: Optional[int] = None
    unlocked: bool
    unlocked_at: Optional[datetime] = None


class SpinResult(BaseModel):
    prize: str
    coins: int
    next_spin_available: datetime
    streak: int
    segment_index: int


class SpinStatus(BaseModel):
    available: bool
    next_spin_available: Optional[datetime]
    streak: int


# ---------------------------------------------------------------------------
# FEATURE 3 — Recently Viewed
# ---------------------------------------------------------------------------

@router.post("/api/v1/users/recently-viewed", status_code=200)
async def record_recently_viewed(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record (or refresh) a product view for the authenticated user."""
    product_id_str = body.get("product_id")
    if not product_id_str:
        raise HTTPException(status_code=400, detail="product_id is required")

    try:
        product_uuid = UUID(product_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id format")

    # Verify product exists
    product_result = await db.execute(select(Product).where(Product.id == product_uuid))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    # Upsert: update viewed_at if row already exists, else insert
    existing_result = await db.execute(
        select(UserRecentlyViewed).where(
            UserRecentlyViewed.user_id == current_user.id,
            UserRecentlyViewed.product_id == product_uuid,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.viewed_at = datetime.now(timezone.utc)
    else:
        db.add(UserRecentlyViewed(
            user_id=current_user.id,
            product_id=product_uuid,
            viewed_at=datetime.now(timezone.utc),
        ))

    await db.flush()
    return {"message": "Recorded"}


@router.get("/api/v1/users/recently-viewed", response_model=list[RecentlyViewedItem])
async def get_recently_viewed(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's recently viewed products, newest first."""
    result = await db.execute(
        select(
            UserRecentlyViewed.product_id,
            Product.name,
            Product.price,
            Product.images,
            Shop.name.label("shop_name"),
            UserRecentlyViewed.viewed_at,
        )
        .join(Product, Product.id == UserRecentlyViewed.product_id)
        .join(Shop, Shop.id == Product.shop_id, isouter=True)
        .where(UserRecentlyViewed.user_id == current_user.id)
        .order_by(UserRecentlyViewed.viewed_at.desc())
        .limit(limit)
    )
    rows = result.all()

    items = []
    for row in rows:
        images = row.images or []
        image_url = images[0] if images else None
        items.append(RecentlyViewedItem(
            product_id=str(row.product_id),
            name=row.name,
            price=float(row.price),
            image_url=image_url,
            shop_name=row.shop_name,
            viewed_at=row.viewed_at,
        ))
    return items


@router.delete("/api/v1/users/recently-viewed", status_code=200)
async def clear_recently_viewed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the user's entire recently-viewed history."""
    await db.execute(
        delete(UserRecentlyViewed).where(UserRecentlyViewed.user_id == current_user.id)
    )
    await db.flush()
    return {"message": "History cleared"}


# ---------------------------------------------------------------------------
# FEATURE 5 — Search Suggestions, Logging, Recent Searches
# ---------------------------------------------------------------------------

@router.get("/api/v1/search/suggestions", response_model=SearchSuggestionsResponse)
async def search_suggestions(
    q: str = Query(default=""),
    limit: int = Query(default=5, ge=1, le=20),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Return product/shop name suggestions, trending queries, and user's recent searches."""
    suggestions: list[str] = []

    if q.strip():
        pattern = f"%{q.strip()}%"

        # Product name suggestions
        product_result = await db.execute(
            select(Product.name)
            .where(Product.name.ilike(pattern), Product.is_available == True)
            .limit(limit)
        )
        suggestions.extend(product_result.scalars().all())

        # Shop name suggestions (fill up to limit)
        remaining = limit - len(suggestions)
        if remaining > 0:
            shop_result = await db.execute(
                select(Shop.name)
                .where(Shop.name.ilike(pattern))
                .limit(remaining)
            )
            for name in shop_result.scalars().all():
                if name not in suggestions:
                    suggestions.append(name)

    # Trending: top queries in last 24h (using the `query` field added by migration a1b2c3d4e5f6)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    trending_result = await db.execute(
        select(SearchLog.query, func.count(SearchLog.id).label("cnt"))
        .where(SearchLog.created_at >= cutoff, SearchLog.query.isnot(None))
        .group_by(SearchLog.query)
        .order_by(func.count(SearchLog.id).desc())
        .limit(5)
    )
    trending = [row.query for row in trending_result.all()]

    # User's recent searches
    recent: list[str] = []
    if current_user:
        recent_result = await db.execute(
            select(UserRecentSearch.query)
            .where(UserRecentSearch.user_id == current_user.id)
            .order_by(UserRecentSearch.searched_at.desc())
            .limit(10)
        )
        recent = list(recent_result.scalars().all())

    return SearchSuggestionsResponse(suggestions=suggestions, trending=trending, recent=recent)


@router.post("/api/v1/search/log", status_code=200)
async def log_search(
    body: dict,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Log a search query. Works for both authenticated and anonymous users."""
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    if len(query) > 255:
        raise HTTPException(status_code=400, detail="query too long")

    # Log to search_logs (uses existing table; `query` column added by migration a1b2c3d4e5f6)
    user_id = current_user.id if current_user else None
    db.add(SearchLog(user_id=user_id, query=query, query_text=query))

    # Upsert user_recent_searches for authenticated users
    if current_user:
        existing_result = await db.execute(
            select(UserRecentSearch).where(
                UserRecentSearch.user_id == current_user.id,
                UserRecentSearch.query == query,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            existing.searched_at = datetime.now(timezone.utc)
        else:
            db.add(UserRecentSearch(
                user_id=current_user.id,
                query=query,
                searched_at=datetime.now(timezone.utc),
            ))

    await db.flush()
    return {"message": "Logged"}


@router.get("/api/v1/search/recent")
async def get_recent_searches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's 10 most recent searches."""
    result = await db.execute(
        select(UserRecentSearch.query, UserRecentSearch.searched_at)
        .where(UserRecentSearch.user_id == current_user.id)
        .order_by(UserRecentSearch.searched_at.desc())
        .limit(10)
    )
    rows = result.all()
    return [{"query": r.query, "searched_at": r.searched_at} for r in rows]


@router.delete("/api/v1/search/recent/{query}", status_code=200)
async def delete_recent_search(
    query: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific recent search entry for the authenticated user."""
    result = await db.execute(
        select(UserRecentSearch).where(
            UserRecentSearch.user_id == current_user.id,
            UserRecentSearch.query == query,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Recent search not found")
    await db.delete(entry)
    await db.flush()
    return {"message": "Deleted"}


# ---------------------------------------------------------------------------
# FEATURE 6 — Order Tracking
# ---------------------------------------------------------------------------

_STATUS_ORDER = ["placed", "confirmed", "packed", "shipped", "delivered"]

_STATUS_META = {
    "placed": ("Order Placed", "Your order has been placed successfully."),
    "confirmed": ("Order Confirmed", "The shop has confirmed your order."),
    "packed": ("Order Packed", "Your items are packed and ready for dispatch."),
    "shipped": ("Out for Delivery", "Your order is on its way."),
    "delivered": ("Delivered", "Your order has been delivered. Enjoy!"),
}


@router.get("/api/v1/orders/{order_id}/tracking", response_model=OrderTrackingResponse)
async def get_order_tracking(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the tracking timeline for a specific order belonging to the current user."""
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format")

    order_result = await db.execute(select(Order).where(Order.id == order_uuid))
    order: Optional[Order] = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    current_status = order.status or "placed"

    # Try to fetch explicit tracking events from the DB
    events_result = await db.execute(
        select(OrderTrackingEvent)
        .where(OrderTrackingEvent.order_id == order_uuid)
        .order_by(OrderTrackingEvent.event_time.asc())
    )
    db_events = list(events_result.scalars().all())

    # Determine completed statuses
    current_idx = _STATUS_ORDER.index(current_status) if current_status in _STATUS_ORDER else 0

    if db_events:
        # Build timeline from explicit events; mark completed by status position
        event_map: dict[str, OrderTrackingEvent] = {e.status: e for e in db_events}
        timeline = []
        for idx, status in enumerate(_STATUS_ORDER):
            meta_title, meta_desc = _STATUS_META.get(status, (status, ""))
            ev = event_map.get(status)
            completed = idx <= current_idx
            timeline.append(TrackingEvent(
                status=status,
                title=ev.title if ev else meta_title,
                description=ev.description if ev else meta_desc,
                timestamp=ev.event_time if ev else (order.created_at if idx == 0 else None),
                completed=completed,
            ))
    else:
        # Derive timeline from order's created_at and status
        timeline = []
        for idx, status in enumerate(_STATUS_ORDER):
            meta_title, meta_desc = _STATUS_META.get(status, (status, ""))
            completed = idx <= current_idx
            ts: Optional[datetime] = None
            if idx == 0:
                ts = order.created_at
            elif idx <= current_idx:
                # Approximate timestamp spacing (1h per step) for display purposes
                ts = order.created_at + timedelta(hours=idx) if order.created_at else None
            timeline.append(TrackingEvent(
                status=status,
                title=meta_title,
                description=meta_desc,
                timestamp=ts,
                completed=completed,
            ))

    # Estimated delivery: 2 days from order creation if not yet delivered
    estimated_delivery: Optional[datetime] = None
    if current_status != "delivered" and order.created_at:
        estimated_delivery = order.created_at + timedelta(days=2)

    return OrderTrackingResponse(
        order_id=str(order.id),
        current_status=current_status,
        estimated_delivery=estimated_delivery,
        timeline=timeline,
    )


# ---------------------------------------------------------------------------
# FEATURE 14 — Achievements
# ---------------------------------------------------------------------------

@router.get("/api/v1/users/achievements", response_model=list[AchievementOut])
async def get_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all achievements with unlock status for the current user."""
    all_result = await db.execute(select(Achievement))
    all_achievements = list(all_result.scalars().all())

    unlocked_result = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == current_user.id)
    )
    unlocked_map: dict[UUID, UserAchievement] = {
        ua.achievement_id: ua for ua in unlocked_result.scalars().all()
    }

    out = []
    for ach in all_achievements:
        ua = unlocked_map.get(ach.id)
        out.append(AchievementOut(
            id=str(ach.id),
            name=ach.name,
            description=ach.description,
            icon=ach.icon,
            coins_reward=ach.coins_reward or 0,
            criteria_type=ach.criteria_type,
            criteria_value=ach.criteria_value,
            unlocked=ua is not None,
            unlocked_at=ua.unlocked_at if ua else None,
        ))
    return out


@router.post("/api/v1/users/achievements/check")
async def check_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger achievement evaluation for the current user. Returns newly unlocked achievements."""
    from app.engagement.achievements import check_and_award_achievements
    newly_unlocked = await check_and_award_achievements(db, current_user.id)
    return {"newly_unlocked": newly_unlocked}


# ---------------------------------------------------------------------------
# FEATURE 15 — Daily Spin
# ---------------------------------------------------------------------------

# Prize wheel definition — (label, coin_value, weight, segment_index)
_PRIZES = [
    ("5 coins",        5,   40, 0),
    ("10 coins",       10,  25, 1),
    ("20 coins",       20,  15, 2),
    ("50 coins",       50,  10, 3),
    ("100 coins",      100,  5, 4),
    ("2x Multiplier",   0,   3, 5),  # special prize — coins=0 in ledger (apply elsewhere)
    ("200 coins",      200,  2, 6),
]


def _weighted_spin() -> tuple[str, int, int]:
    """Return (label, coins, segment_index) based on weighted random."""
    population = [p for p in _PRIZES]
    weights = [p[2] for p in population]
    chosen = random.choices(population, weights=weights, k=1)[0]
    return chosen[0], chosen[1], chosen[3]


def _next_midnight_utc() -> datetime:
    """Return the next UTC midnight (i.e. start of tomorrow)."""
    now = datetime.now(timezone.utc)
    tomorrow = now.date() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=timezone.utc)


@router.get("/api/v1/daily-spin/status", response_model=SpinStatus)
async def daily_spin_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check whether the user can spin today."""
    today = datetime.now(timezone.utc).date()

    last_spin_result = await db.execute(
        select(DailySpin)
        .where(DailySpin.user_id == current_user.id)
        .order_by(DailySpin.spun_at.desc())
        .limit(1)
    )
    last_spin: Optional[DailySpin] = last_spin_result.scalar_one_or_none()

    already_spun = False
    if last_spin and last_spin.spun_at:
        spun_date = last_spin.spun_at.astimezone(timezone.utc).date()
        already_spun = spun_date == today

    streak = getattr(current_user, "daily_spin_streak", 0) or 0

    return SpinStatus(
        available=not already_spun,
        next_spin_available=_next_midnight_utc(),
        streak=streak,
    )


@router.post("/api/v1/daily-spin", response_model=SpinResult)
async def perform_daily_spin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Perform the daily spin. Returns the prize and updates streak."""
    today = datetime.now(timezone.utc).date()

    # Check if already spun today
    last_spin_result = await db.execute(
        select(DailySpin)
        .where(DailySpin.user_id == current_user.id)
        .order_by(DailySpin.spun_at.desc())
        .limit(1)
    )
    last_spin: Optional[DailySpin] = last_spin_result.scalar_one_or_none()

    if last_spin and last_spin.spun_at:
        spun_date = last_spin.spun_at.astimezone(timezone.utc).date()
        if spun_date == today:
            raise HTTPException(status_code=400, detail="Already claimed today")

    # Determine prize
    prize_label, coins, segment_index = _weighted_spin()

    # Record spin
    spin_record = DailySpin(
        user_id=current_user.id,
        prize_label=prize_label,
        coins_won=coins,
        spun_at=datetime.now(timezone.utc),
    )
    db.add(spin_record)
    await db.flush()

    # Credit coins (only for coin prizes)
    if coins > 0:
        await earn_coins(db, current_user.id, coins, "daily_spin")

    # Update streak on user
    last_spin_date = getattr(current_user, "last_spin_date", None)
    yesterday = today - timedelta(days=1)

    current_streak = getattr(current_user, "daily_spin_streak", 0) or 0
    if last_spin_date == yesterday:
        current_streak += 1
    elif last_spin_date == today:
        pass  # already spun; guard above would have caught this
    else:
        current_streak = 1

    current_user.daily_spin_streak = current_streak
    current_user.last_spin_date = today
    await db.flush()

    return SpinResult(
        prize=prize_label,
        coins=coins,
        next_spin_available=_next_midnight_utc(),
        streak=current_streak,
        segment_index=segment_index,
    )
