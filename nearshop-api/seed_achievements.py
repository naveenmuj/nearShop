"""Seed the achievements table with standard achievement definitions."""
import asyncio
import sys
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent to path so we can import app modules
sys.path.insert(0, ".")

from app.core.database import async_session_factory
from app.engagement.models import Achievement

ACHIEVEMENTS = [
    # Order milestones
    {"name": "First Order", "description": "Place your first order", "icon": "🛍️", "coins_reward": 20, "criteria_type": "order_count", "criteria_value": 1},
    {"name": "Frequent Buyer", "description": "Place 5 orders", "icon": "🛒", "coins_reward": 50, "criteria_type": "order_count", "criteria_value": 5},
    {"name": "Loyal Customer", "description": "Place 10 orders", "icon": "🏆", "coins_reward": 100, "criteria_type": "order_count", "criteria_value": 10},
    {"name": "Shopping Pro", "description": "Place 25 orders", "icon": "💎", "coins_reward": 200, "criteria_type": "order_count", "criteria_value": 25},
    {"name": "Shop Legend", "description": "Place 50 orders", "icon": "👑", "coins_reward": 500, "criteria_type": "order_count", "criteria_value": 50},

    # Coins milestones
    {"name": "Coin Collector", "description": "Earn 100 ShopCoins", "icon": "🪙", "coins_reward": 15, "criteria_type": "coins_earned", "criteria_value": 100},
    {"name": "Coin Hoarder", "description": "Earn 500 ShopCoins", "icon": "💰", "coins_reward": 50, "criteria_type": "coins_earned", "criteria_value": 500},
    {"name": "Coin Master", "description": "Earn 2000 ShopCoins", "icon": "🏦", "coins_reward": 150, "criteria_type": "coins_earned", "criteria_value": 2000},

    # Wishlist milestones
    {"name": "Window Shopper", "description": "Add 3 items to wishlist", "icon": "❤️", "coins_reward": 10, "criteria_type": "wishlist_count", "criteria_value": 3},
    {"name": "Curator", "description": "Add 10 items to wishlist", "icon": "📋", "coins_reward": 30, "criteria_type": "wishlist_count", "criteria_value": 10},
    {"name": "Collector", "description": "Add 25 items to wishlist", "icon": "🎯", "coins_reward": 75, "criteria_type": "wishlist_count", "criteria_value": 25},

    # Streak milestones
    {"name": "Getting Started", "description": "Check in 3 days in a row", "icon": "🔥", "coins_reward": 15, "criteria_type": "streak_days", "criteria_value": 3},
    {"name": "On a Roll", "description": "Check in 7 days in a row", "icon": "⚡", "coins_reward": 40, "criteria_type": "streak_days", "criteria_value": 7},
    {"name": "Dedicated", "description": "Check in 14 days in a row", "icon": "🌟", "coins_reward": 100, "criteria_type": "streak_days", "criteria_value": 14},
    {"name": "Unstoppable", "description": "Check in 30 days in a row", "icon": "🚀", "coins_reward": 250, "criteria_type": "streak_days", "criteria_value": 30},

    # Referral milestones
    {"name": "Social Butterfly", "description": "Refer 1 friend", "icon": "🤝", "coins_reward": 25, "criteria_type": "referral_count", "criteria_value": 1},
    {"name": "Influencer", "description": "Refer 5 friends", "icon": "📢", "coins_reward": 100, "criteria_type": "referral_count", "criteria_value": 5},
    {"name": "Community Builder", "description": "Refer 10 friends", "icon": "🌐", "coins_reward": 250, "criteria_type": "referral_count", "criteria_value": 10},
]


async def seed():
    async with async_session_factory() as db:
        # Check existing
        result = await db.execute(select(Achievement))
        existing = {a.name for a in result.scalars().all()}

        added = 0
        for ach_data in ACHIEVEMENTS:
            if ach_data["name"] in existing:
                print(f"  [skip] {ach_data['name']} already exists")
                continue
            db.add(Achievement(**ach_data))
            print(f"  [add]  {ach_data['icon']} {ach_data['name']}")
            added += 1

        await db.commit()
        print(f"\nDone! Added {added} achievements ({len(existing)} already existed)")


if __name__ == "__main__":
    asyncio.run(seed())
