"""Achievement checking and awarding logic."""
from uuid import UUID
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.engagement.models import Achievement, UserAchievement
from app.auth.models import User
from app.orders.models import Order
from app.loyalty.models import ShopCoinsLedger
from app.loyalty.service import earn_coins


async def check_and_award_achievements(db: AsyncSession, user_id: UUID) -> list[dict]:
    """
    Check all achievements for user_id and award any not yet unlocked.
    Returns a list of newly unlocked achievement dicts.
    """
    # ---------- gather user stats ----------
    # Order count
    order_count_result = await db.execute(
        select(func.count()).select_from(Order).where(Order.customer_id == user_id)
    )
    order_count: int = order_count_result.scalar() or 0

    # Referral count
    referral_count_result = await db.execute(
        select(func.count()).select_from(User).where(User.referred_by == user_id)
    )
    referral_count: int = referral_count_result.scalar() or 0

    # Total coins earned (sum of positive ledger entries)
    coins_result = await db.execute(
        select(func.sum(ShopCoinsLedger.amount))
        .where(ShopCoinsLedger.user_id == user_id, ShopCoinsLedger.amount > 0)
    )
    coins_earned: int = int(coins_result.scalar() or 0)

    # Wishlist count — use products.wishlist_count aggregation via wishlists table
    from app.products.models import Wishlist
    wishlist_count_result = await db.execute(
        select(func.count()).select_from(Wishlist).where(Wishlist.user_id == user_id)
    )
    wishlist_count: int = wishlist_count_result.scalar() or 0

    # Daily spin streak (stored directly on user row)
    user_result = await db.execute(select(User).where(User.id == user_id))
    user: Optional[User] = user_result.scalar_one_or_none()
    streak_days: int = getattr(user, "daily_spin_streak", 0) or 0

    stats = {
        "order_count": order_count,
        "referral_count": referral_count,
        "coins_earned": coins_earned,
        "wishlist_count": wishlist_count,
        "streak_days": streak_days,
    }

    # ---------- fetch all achievements ----------
    all_achievements_result = await db.execute(select(Achievement))
    all_achievements = list(all_achievements_result.scalars().all())

    # ---------- fetch already-unlocked achievement IDs ----------
    unlocked_result = await db.execute(
        select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
    )
    unlocked_ids = set(unlocked_result.scalars().all())

    # ---------- evaluate and award ----------
    newly_unlocked = []
    for ach in all_achievements:
        if ach.id in unlocked_ids:
            continue
        criteria_type = ach.criteria_type
        criteria_value = ach.criteria_value

        if criteria_type is None or criteria_value is None:
            continue

        user_value = stats.get(criteria_type, 0)
        if user_value >= criteria_value:
            # Award achievement
            ua = UserAchievement(user_id=user_id, achievement_id=ach.id)
            db.add(ua)
            await db.flush()

            # Award coins
            if ach.coins_reward and ach.coins_reward > 0:
                await earn_coins(
                    db,
                    user_id,
                    ach.coins_reward,
                    f"achievement_{ach.name.lower().replace(' ', '_')}",
                    reference_id=ach.id,
                )

            newly_unlocked.append({
                "achievement_id": str(ach.id),
                "name": ach.name,
                "description": ach.description,
                "icon": ach.icon,
                "coins_reward": ach.coins_reward,
            })

    return newly_unlocked
