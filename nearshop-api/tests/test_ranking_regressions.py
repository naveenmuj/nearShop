import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import app.auth.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.delivery.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.stories.models  # noqa: F401

from app.ai.personalized_deals import get_personalized_deals
from app.ai.recommendations import get_recommendations
from app.ranking.service import (
    RankingContext,
    UserPreferenceProfile,
    rank_deals,
    rank_products,
    rank_shops,
    score_product,
)
from app.search.service import _phrase_and_token_patterns, _query_terms


class _FakeResult:
    def __init__(self, *, rows=None, scalars=None):
        self._rows = rows or []
        self._scalars = scalars

    def fetchall(self):
        return self._rows

    def all(self):
        return self._rows

    def scalars(self):
        values = self._scalars if self._scalars is not None else self._rows
        return SimpleNamespace(all=lambda: values)


class RankingRegressions(unittest.TestCase):
    def test_unified_search_query_patterns_include_phrase_and_tokens(self):
        self.assertEqual(
            _query_terms("gaming audio streaming"),
            ["gaming", "audio", "streaming"],
        )
        self.assertEqual(
            _phrase_and_token_patterns("gaming audio streaming"),
            [
                "%gaming audio streaming%",
                "%gaming%",
                "%audio%",
                "%streaming%",
            ],
        )

    def test_rank_products_prefers_profile_match_and_shop_affinity(self):
        followed_shop_id = str(uuid4())
        neutral_shop_id = str(uuid4())

        profile = UserPreferenceProfile(
            categories={"electronics": 4},
            subcategories={"audio": 5},
            tags={"wireless": 4, "anc": 3},
            followed_shops={followed_shop_id},
        )
        context = RankingContext(lat=12.935, lng=77.624, radius_km=5, surface="product_search")

        best = SimpleNamespace(
            id=uuid4(),
            shop_id=followed_shop_id,
            category="Electronics",
            subcategory="Audio",
            tags=["wireless", "anc"],
            view_count=12,
            wishlist_count=4,
            inquiry_count=1,
            is_featured=True,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            shop=SimpleNamespace(
                id=followed_shop_id,
                latitude=12.936,
                longitude=77.625,
                avg_rating=4.7,
                score=88,
            ),
        )
        weaker = SimpleNamespace(
            id=uuid4(),
            shop_id=neutral_shop_id,
            category="Grocery",
            subcategory="Staples",
            tags=["rice"],
            view_count=50,
            wishlist_count=20,
            inquiry_count=5,
            is_featured=False,
            created_at=datetime.now(timezone.utc) - timedelta(days=5),
            shop=SimpleNamespace(
                id=neutral_shop_id,
                latitude=12.98,
                longitude=77.70,
                avg_rating=4.1,
                score=55,
            ),
        )

        ranked = rank_products([weaker, best], profile, context)
        self.assertEqual(ranked[0], best)
        self.assertGreater(score_product(best, best.shop, profile, context), score_product(weaker, weaker.shop, profile, context))

    def test_rank_products_boosts_query_overlap(self):
        profile = UserPreferenceProfile()
        context = RankingContext(query="gaming keyboard", surface="product_search")

        matching = SimpleNamespace(
            id=uuid4(),
            shop_id=uuid4(),
            name="Gaming Keyboard Pro",
            category="Electronics",
            subcategory="Accessories",
            tags=["gaming", "keyboard"],
            view_count=2,
            wishlist_count=1,
            inquiry_count=0,
            is_featured=False,
            created_at=datetime.now(timezone.utc),
            shop=SimpleNamespace(id=uuid4(), latitude=12.9, longitude=77.6, avg_rating=4.3, score=60),
        )
        non_matching = SimpleNamespace(
            id=uuid4(),
            shop_id=uuid4(),
            name="Kitchen Container Set",
            category="Home",
            subcategory="Storage",
            tags=["plastic"],
            view_count=20,
            wishlist_count=10,
            inquiry_count=1,
            is_featured=False,
            created_at=datetime.now(timezone.utc),
            shop=SimpleNamespace(id=uuid4(), latitude=12.9, longitude=77.6, avg_rating=4.8, score=90),
        )

        ranked = rank_products([non_matching, matching], profile, context)
        self.assertEqual(ranked[0], matching)

    def test_rank_deals_prefers_relevant_product_and_discount(self):
        profile = UserPreferenceProfile(categories={"electronics": 4}, tags={"wireless": 3})
        context = RankingContext(lat=12.935, lng=77.624, radius_km=5, surface="nearby_deals")
        shop = SimpleNamespace(id=uuid4(), latitude=12.936, longitude=77.625, avg_rating=4.6, score=82)

        relevant_product = SimpleNamespace(
            id=uuid4(),
            shop_id=shop.id,
            name="Wireless Earbuds",
            category="Electronics",
            subcategory="Audio",
            tags=["wireless"],
            view_count=10,
            wishlist_count=5,
            inquiry_count=1,
            is_featured=True,
            created_at=datetime.now(timezone.utc),
        )
        weaker_product = SimpleNamespace(
            id=uuid4(),
            shop_id=shop.id,
            name="Notebook",
            category="Stationery",
            subcategory="Paper",
            tags=["paper"],
            view_count=1,
            wishlist_count=0,
            inquiry_count=0,
            is_featured=False,
            created_at=datetime.now(timezone.utc),
        )

        strong_deal = (
            SimpleNamespace(
                id=uuid4(),
                shop_id=shop.id,
                product_id=relevant_product.id,
                discount_pct=25,
                discount_amount=0,
                current_claims=8,
                max_claims=20,
                created_at=datetime.now(timezone.utc) - timedelta(hours=3),
            ),
            shop,
            relevant_product,
        )
        weak_deal = (
            SimpleNamespace(
                id=uuid4(),
                shop_id=shop.id,
                product_id=weaker_product.id,
                discount_pct=5,
                discount_amount=0,
                current_claims=1,
                max_claims=20,
                created_at=datetime.now(timezone.utc) - timedelta(hours=20),
            ),
            shop,
            weaker_product,
        )

        ranked = rank_deals([weak_deal, strong_deal], profile, context)
        self.assertEqual(ranked[0], strong_deal)

    def test_rank_shops_prefers_followed_query_matching_shop(self):
        followed_shop_id = str(uuid4())
        profile = UserPreferenceProfile(
            followed_shops={followed_shop_id},
            recent_queries={"gaming": 2, "audio": 1},
        )
        context = RankingContext(query="gaming audio", lat=12.935, lng=77.624, surface="unified_search")

        matching = SimpleNamespace(
            id=followed_shop_id,
            name="Gaming Audio Hub",
            category="Electronics",
            description="Headsets, keyboards, mice",
            latitude=12.936,
            longitude=77.625,
            avg_rating=4.7,
            total_reviews=42,
            score=86,
        )
        weaker = SimpleNamespace(
            id=str(uuid4()),
            name="Daily Grocery Mart",
            category="Grocery",
            description="Groceries and staples",
            latitude=12.98,
            longitude=77.71,
            avg_rating=4.8,
            total_reviews=130,
            score=92,
        )

        ranked = rank_shops([weaker, matching], profile, context)
        self.assertEqual(ranked[0], matching)


class RecommendationIntegrationRegressions(unittest.IsolatedAsyncioTestCase):
    async def test_recommendations_exclude_ordered_products_after_ranking(self):
        ordered_id = uuid4()
        candidate = SimpleNamespace(
            id=uuid4(),
            shop_id=uuid4(),
            category="Electronics",
            subcategory="Audio",
            tags=["wireless"],
            view_count=10,
            wishlist_count=4,
            inquiry_count=1,
            is_featured=False,
            created_at=datetime.now(timezone.utc),
            shop=SimpleNamespace(id=uuid4(), latitude=12.935, longitude=77.624, avg_rating=4.6, score=80),
        )
        ordered = SimpleNamespace(
            id=ordered_id,
            shop_id=uuid4(),
            category="Electronics",
            subcategory="Audio",
            tags=["wireless"],
            view_count=50,
            wishlist_count=20,
            inquiry_count=4,
            is_featured=True,
            created_at=datetime.now(timezone.utc),
            shop=SimpleNamespace(id=uuid4(), latitude=12.935, longitude=77.624, avg_rating=4.9, score=95),
        )

        fake_db = SimpleNamespace(
            execute=AsyncMock(return_value=_FakeResult(scalars=[candidate, ordered]))
        )
        profile = UserPreferenceProfile(
            categories={"electronics": 5},
            ordered_products={str(ordered_id)},
        )

        with patch("app.ai.recommendations.build_user_preference_profile", AsyncMock(return_value=profile)):
            products = await get_recommendations(fake_db, uuid4(), 12.935, 77.624, limit=5)

        self.assertEqual([product.id for product in products], [candidate.id])

    async def test_personalized_deals_surface_affinity_reason(self):
        followed_shop_id = uuid4()
        shop = SimpleNamespace(name="TechWorld", avg_rating=4.7, latitude=12.936, longitude=77.625)
        deal = SimpleNamespace(
            id=uuid4(),
            title="Earbuds Weekend Deal",
            description="Discount on premium earbuds",
            discount_pct=20,
            discount_amount=0,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=6),
            shop_id=followed_shop_id,
            product_id=uuid4(),
            current_claims=4,
            max_claims=20,
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        product = SimpleNamespace(
            id=deal.product_id,
            shop_id=followed_shop_id,
            name="Wireless Earbuds",
            category="Electronics",
            subcategory="Audio",
            tags=["wireless"],
            view_count=12,
            wishlist_count=5,
            inquiry_count=1,
            is_featured=True,
            created_at=datetime.now(timezone.utc) - timedelta(hours=12),
        )
        row = (deal, shop, product)
        fake_db = SimpleNamespace(execute=AsyncMock(return_value=_FakeResult(rows=[row])))
        profile = UserPreferenceProfile(
            categories={"electronics": 4},
            tags={"wireless": 4},
            followed_shops={str(followed_shop_id)},
        )

        with patch("app.ai.personalized_deals.build_user_preference_profile", AsyncMock(return_value=profile)):
            deals = await get_personalized_deals(fake_db, uuid4(), 12.935, 77.624, limit=5)

        self.assertEqual(len(deals), 1)
        self.assertEqual(deals[0]["match_reason"], "From a shop you follow or visit")
