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

from app.ai.customer_segments import get_customer_segments
from app.ai.collaborative_filter import get_cf_recommendations
from app.ai.pricing import suggest_price
from app.ai.recommendations import get_recommendations
from app.ai.trending import get_trending_products
from app.analytics.service import get_operational_insights
from app.products.models import Product
from app.ranking.service import UserPreferenceProfile
from app.shops.models import Shop


class _FakeResult:
    def __init__(self, *, rows=None, scalar=None, scalars=None):
        self._rows = rows
        self._scalar = scalar
        self._scalars = scalars

    def fetchall(self):
        return self._rows or []

    def all(self):
        return self._rows or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        values = self._scalars
        if values is None:
            if self._rows is not None:
                values = self._rows
            elif self._scalar is not None:
                values = [self._scalar]
            else:
                values = []
        return SimpleNamespace(all=lambda: values)


class _QueuedAsyncDB:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, _stmt):
        if not self._results:
            raise AssertionError("Unexpected execute() call")
        return self._results.pop(0)


class CustomerSegmentsRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_single_stale_customer_is_marked_at_risk(self):
        fresh_customer_id = uuid4()
        stale_customer_id = uuid4()
        now = datetime.now(timezone.utc)

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            customer_id=fresh_customer_id,
                            order_count=1,
                            total_spent=1499,
                            last_order_at=now - timedelta(days=5),
                        ),
                        SimpleNamespace(
                            customer_id=stale_customer_id,
                            order_count=1,
                            total_spent=999,
                            last_order_at=now - timedelta(days=45),
                        ),
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(id=fresh_customer_id, name="Fresh", phone="111"),
                        SimpleNamespace(id=stale_customer_id, name="Stale", phone="222"),
                    ]
                ),
            ]
        )

        result = await get_customer_segments(db, uuid4())

        customers = {customer["name"]: customer for customer in result["customers"]}
        self.assertEqual(customers["Stale"]["segment"], "At Risk")
        self.assertEqual(customers["Fresh"]["segment"], "New Customers")
        self.assertEqual(result["summary"]["at_risk_count"], 1)


class PricingRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_pricing_stays_within_reasonable_band_for_accessory(self):
        product_id = uuid4()
        shop_id = uuid4()

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    scalar=Product(
                        id=product_id,
                        shop_id=shop_id,
                        name="Gaming Mouse Pro",
                        price=1299,
                        category="Electronics",
                        subcategory="Accessories",
                        tags=["mouse", "gaming", "usb"],
                        images=["a.jpg"],
                        view_count=12,
                        wishlist_count=4,
                        inquiry_count=1,
                    )
                ),
                _FakeResult(
                    scalar=Shop(
                        id=shop_id,
                        owner_id=uuid4(),
                        name="TechWorld",
                        slug="techworld",
                        latitude=12.93,
                        longitude=77.61,
                    )
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            price=1499,
                            view_count=8,
                            wishlist_count=2,
                            name="Wireless Gaming Mouse",
                            category="Electronics",
                            subcategory="Accessories",
                            tags=["mouse", "gaming"],
                        ),
                        SimpleNamespace(
                            price=1599,
                            view_count=5,
                            wishlist_count=1,
                            name="RGB Gaming Mouse",
                            category="Electronics",
                            subcategory="Accessories",
                            tags=["mouse", "rgb"],
                        ),
                        SimpleNamespace(
                            price=1699,
                            view_count=6,
                            wishlist_count=1,
                            name="USB-C Hub 7-in-1",
                            category="Electronics",
                            subcategory="Accessories",
                            tags=["usb", "hub"],
                        ),
                        SimpleNamespace(
                            price=59900,
                            view_count=40,
                            wishlist_count=9,
                            name="Gaming Laptop",
                            category="Electronics",
                            subcategory="Laptops",
                            tags=["gaming", "laptop"],
                        ),
                    ]
                ),
            ]
        )

        result = await suggest_price(db, product_id, shop_id)

        self.assertEqual(result["comparables_count"], 3)
        self.assertLessEqual(result["suggested_price"], 1299 * 1.25)
        self.assertGreaterEqual(result["suggested_price"], 1299 * 0.8)
        self.assertIn("nearby comparable Accessories products", result["reason"])


class OperationalInsightsRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_restock_action_never_shows_zero_quantity(self):
        shop_id = uuid4()
        product_id = uuid4()
        now = datetime.now(timezone.utc)

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            created_at=now - timedelta(days=2),
                            total=1999,
                            items=[{"product_id": str(product_id), "quantity": 1}],
                        )
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            id=product_id,
                            name="Mechanical Keyboard X",
                            category="Accessories",
                            stock_quantity=1,
                            low_stock_threshold=1,
                            price=2999,
                            is_available=True,
                            created_at=now - timedelta(days=10),
                        )
                    ]
                ),
            ]
        )

        with patch(
            "app.analytics.service.get_customer_segments",
            new=AsyncMock(
                return_value={
                    "summary": {"total": 1, "at_risk_count": 1, "champions_count": 0},
                    "segments": {"At Risk": 1},
                    "customers": [],
                }
            ),
        ), patch(
            "app.analytics.service.get_demand_insights",
            new=AsyncMock(return_value=[]),
        ):
            result = await get_operational_insights(db, shop_id)

        inventory_action = next(
            action for action in result["recommended_actions"] if action["target"] == "inventory"
        )
        self.assertIn("reorder 1", inventory_action["highlights"][0])
        self.assertTrue(
            all(action["target"] in {"inventory", "demand", "marketing", "analytics"} for action in result["recommended_actions"])
        )
        self.assertEqual(result["meta"]["confidence"]["forecast"], "low")
        self.assertFalse(result["meta"]["location_applied"])
        self.assertTrue(
            any("limited order history" in warning.lower() for warning in result["meta"]["warnings"])
        )

    async def test_operational_insights_meta_reports_high_confidence_when_sample_sizes_are_strong(self):
        shop_id = uuid4()
        product_id = uuid4()
        now = datetime.now(timezone.utc)
        order_rows = [
            SimpleNamespace(
                created_at=now - timedelta(days=(idx % 10) + 1),
                total=1200 + idx * 10,
                items=[{"product_id": str(product_id), "quantity": 2}],
            )
            for idx in range(24)
        ]

        db = _QueuedAsyncDB(
            [
                _FakeResult(rows=order_rows),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            id=product_id,
                            name="Bluetooth Speaker",
                            category="Electronics",
                            stock_quantity=40,
                            low_stock_threshold=5,
                            price=2499,
                            is_available=True,
                            created_at=now - timedelta(days=15),
                        )
                    ]
                ),
            ]
        )

        with patch(
            "app.analytics.service.get_customer_segments",
            new=AsyncMock(
                return_value={
                    "summary": {"total": 30, "at_risk_count": 2, "champions_count": 6},
                    "segments": {"Champions": 6, "At Risk": 2, "Loyal": 10},
                    "customers": [],
                }
            ),
        ), patch(
            "app.analytics.service.get_demand_insights",
            new=AsyncMock(return_value=[{"query": "speaker", "count": 28}, {"query": "bluetooth speaker", "count": 17}]),
        ):
            result = await get_operational_insights(db, shop_id, lat=12.93, lng=77.61)

        self.assertTrue(result["meta"]["location_applied"])
        self.assertEqual(result["meta"]["confidence"]["forecast"], "high")
        self.assertEqual(result["meta"]["confidence"]["segments"], "high")
        self.assertEqual(result["meta"]["sample_sizes"]["orders_last_30_days"], 24)
        self.assertEqual(result["meta"]["sample_sizes"]["customers_segmented"], 30)
        self.assertEqual(result["meta"]["methods"]["forecasting"], "rolling_average")


class RecommendationRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_recommendations_follow_recent_accessory_behavior(self):
        user_id = uuid4()
        bought_hub = uuid4()
        accessory_candidate = Product(
            id=uuid4(),
            shop_id=uuid4(),
            name="Wireless Keyboard",
            price=2499,
            category="Electronics",
            subcategory="Accessories",
            tags=["keyboard", "wireless"],
            images=["keyboard.jpg"],
            wishlist_count=6,
            view_count=10,
            inquiry_count=2,
        )
        laptop_candidate = Product(
            id=uuid4(),
            shop_id=uuid4(),
            name="Creator Laptop",
            price=89999,
            category="Electronics",
            subcategory="Laptops",
            tags=["laptop", "creator"],
            images=["laptop.jpg"],
            wishlist_count=8,
            view_count=12,
            inquiry_count=1,
        )

        db = _QueuedAsyncDB([_FakeResult(scalars=[accessory_candidate, laptop_candidate])])
        profile = UserPreferenceProfile(
            categories={"electronics": 5},
            subcategories={"accessories": 6},
            tags={"gaming": 3, "usb": 2, "hub": 2},
            ordered_products={str(bought_hub)},
        )

        with patch(
            "app.ai.recommendations.build_user_preference_profile",
            AsyncMock(return_value=profile),
        ):
            results = await get_recommendations(db, user_id, 12.93, 77.61, limit=5)

        self.assertEqual(results[0].name, "Wireless Keyboard")
        self.assertEqual(results[0].subcategory, "Accessories")


class TrendingRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_trending_uses_weighted_activity_not_just_raw_views(self):
        purchase_driven_product = uuid4()
        view_only_product = uuid4()

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            product_id=view_only_product,
                            weighted_score=8,
                            unique_users=5,
                            event_count=8,
                        ),
                        SimpleNamespace(
                            product_id=purchase_driven_product,
                            weighted_score=16,
                            unique_users=2,
                            event_count=3,
                        ),
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            Product=Product(
                                id=view_only_product,
                                shop_id=uuid4(),
                                name="Viewed Often",
                                price=999,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["popular"],
                                images=["viewed.jpg"],
                            ),
                            shop_name="Shop A",
                            shop_rating=4.2,
                        ),
                        SimpleNamespace(
                            Product=Product(
                                id=purchase_driven_product,
                                shop_id=uuid4(),
                                name="Bought Fast",
                                price=1499,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["conversion"],
                                images=["bought.jpg"],
                            ),
                            shop_name="Shop B",
                            shop_rating=4.5,
                        ),
                    ]
                ),
            ]
        )

        results = await get_trending_products(db, 12.93, 77.61, limit=5)

        self.assertEqual(results[0]["name"], "Bought Fast")
        self.assertEqual(results[0]["trending_score"], 16)
        self.assertEqual(results[0]["event_count"], 3)


class CollaborativeRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_collaborative_fallback_returns_similar_nearby_items(self):
        user_id = uuid4()
        viewed_mouse = uuid4()
        bought_hub = uuid4()
        keyboard_id = uuid4()
        mic_id = uuid4()
        shop_id = uuid4()

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    rows=[
                        SimpleNamespace(entity_id=viewed_mouse, event_type="product_view"),
                        SimpleNamespace(entity_id=bought_hub, event_type="add_to_cart"),
                    ]
                ),
                _FakeResult(
                    scalars=[
                        [{"product_id": str(bought_hub), "quantity": 1}],
                    ]
                ),
                _FakeResult(scalars=[shop_id]),
                _FakeResult(
                    scalars=[
                        [{"product_id": str(viewed_mouse), "quantity": 1}, {"product_id": str(keyboard_id), "quantity": 1}],
                        [{"product_id": str(bought_hub), "quantity": 1}, {"product_id": str(mic_id), "quantity": 1}],
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(id=viewed_mouse, category="Electronics", subcategory="Accessories", tags=["mouse", "gaming"]),
                        SimpleNamespace(id=bought_hub, category="Electronics", subcategory="Accessories", tags=["usb", "hub"]),
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            Product=Product(
                                id=keyboard_id,
                                shop_id=shop_id,
                                name="Compact Mechanical Keyboard",
                                price=2899,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["keyboard", "gaming", "mechanical"],
                                images=["keyboard.jpg"],
                                view_count=12,
                                wishlist_count=4,
                                inquiry_count=1,
                            ),
                            shop_name="Nearby Gaming",
                        ),
                        SimpleNamespace(
                            Product=Product(
                                id=mic_id,
                                shop_id=shop_id,
                                name="USB Condenser Mic",
                                price=3199,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["microphone", "usb", "streaming"],
                                images=["mic.jpg"],
                                view_count=6,
                                wishlist_count=2,
                                inquiry_count=1,
                            ),
                            shop_name="Nearby Audio",
                        ),
                    ]
                ),
            ]
        )

        results = await get_cf_recommendations(db, user_id, 12.93, 77.61, limit=5)

        names = [item["name"] for item in results]
        self.assertIn("Compact Mechanical Keyboard", names)
        self.assertIn("USB Condenser Mic", names)
        self.assertTrue(all("near" in item["reason"].lower() or "popular" in item["reason"].lower() for item in results[:2]))
        self.assertGreater(results[0]["cf_score"], 0)

    async def test_collaborative_selection_spreads_results_across_shops(self):
        user_id = uuid4()
        viewed_mouse = uuid4()
        bought_hub = uuid4()
        shop_a = uuid4()
        shop_b = uuid4()
        shop_c = uuid4()
        keyboard_id = uuid4()
        headset_id = uuid4()
        mic_id = uuid4()

        db = _QueuedAsyncDB(
            [
                _FakeResult(
                    rows=[
                        SimpleNamespace(entity_id=viewed_mouse, event_type="wishlist_add"),
                    ]
                ),
                _FakeResult(
                    scalars=[
                        [{"product_id": str(bought_hub), "quantity": 1}],
                    ]
                ),
                _FakeResult(scalars=[shop_a, shop_b, shop_c]),
                _FakeResult(
                    scalars=[
                        [{"product_id": str(viewed_mouse), "quantity": 1}, {"product_id": str(keyboard_id), "quantity": 1}],
                        [{"product_id": str(viewed_mouse), "quantity": 1}, {"product_id": str(headset_id), "quantity": 1}],
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(id=viewed_mouse, category="Electronics", subcategory="Accessories", tags=["gaming", "mouse"]),
                        SimpleNamespace(id=bought_hub, category="Electronics", subcategory="Accessories", tags=["usb", "hub"]),
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            Product=Product(
                                id=keyboard_id,
                                shop_id=shop_a,
                                name="Gaming Keyboard",
                                price=2499,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["gaming", "keyboard", "mechanical"],
                                images=["keyboard.jpg"],
                                view_count=10,
                                wishlist_count=5,
                                inquiry_count=1,
                            ),
                            shop_name="Shop A",
                        ),
                        SimpleNamespace(
                            Product=Product(
                                id=headset_id,
                                shop_id=shop_a,
                                name="Gaming Headset",
                                price=2799,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["gaming", "headset", "audio"],
                                images=["headset.jpg"],
                                view_count=11,
                                wishlist_count=4,
                                inquiry_count=1,
                            ),
                            shop_name="Shop A",
                        ),
                        SimpleNamespace(
                            Product=Product(
                                id=mic_id,
                                shop_id=shop_b,
                                name="USB Streaming Mic",
                                price=3199,
                                category="Electronics",
                                subcategory="Accessories",
                                tags=["usb", "microphone", "streaming"],
                                images=["mic.jpg"],
                                view_count=7,
                                wishlist_count=3,
                                inquiry_count=1,
                            ),
                            shop_name="Shop B",
                        ),
                    ]
                ),
            ]
        )

        results = await get_cf_recommendations(db, user_id, 12.93, 77.61, limit=3)

        self.assertEqual(len(results), 3)
        self.assertGreaterEqual(len({item["shop_id"] for item in results[:2]}), 2)


if __name__ == "__main__":
    unittest.main()
