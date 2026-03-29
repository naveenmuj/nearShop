from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

import app.deals.models  # noqa: F401
import app.delivery.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.stories.models  # noqa: F401

from app.auth.models import Follow, SearchLog, User, UserEvent
from app.orders.models import Order
from app.products.models import Product
from app.shops.models import Shop


ANCHOR_COORDS = {"lat": 12.9352, "lng": 77.6245}
ANCHOR_SHOP_SLUG = "ml-test-electronics-1774488839"
BUSINESS_EMAIL = "ml.biz.1774488839@example.com"
PERSONA_CONFIG = {
    "ml.c1.1774488839@example.com": {
        "name": "ML Persona Gamer",
        "phone": "+919700000001",
        "interests": ["gaming", "keyboard", "mouse", "headset"],
        "follow_slugs": ["ml-gamer-garage"],
        "searches": [
            "gaming mouse",
            "gaming mouse",
            "mechanical keyboard",
            "mechanical keyboard",
            "gaming headset",
            "rgb mousepad",
        ],
        "events": [
            ("product_view", "Gaming Mouse Pro"),
            ("wishlist_add", "Gaming Mouse Pro"),
            ("add_to_cart", "Gaming Mouse Pro"),
            ("product_view", "Mechanical Keyboard X"),
            ("wishlist_add", "Mechanical Keyboard X"),
            ("product_view", "Compact Mechanical Keyboard"),
            ("product_click", "Compact Mechanical Keyboard"),
            ("product_view", "Pro Gaming Headset"),
            ("product_view", "RGB Mouse Pad XL"),
        ],
        "orders": [
            ["Gaming Mouse Pro", "RGB Mouse Pad XL"],
            ["Compact Mechanical Keyboard"],
        ],
    },
    "ml.c4@example.com": {
        "name": "ML Persona Audio",
        "phone": "+919700000004",
        "interests": ["audio", "headphones", "earbuds", "bluetooth"],
        "follow_slugs": ["ml-audio-hub", "ml-premium-audio"],
        "searches": [
            "bluetooth earbuds",
            "bluetooth earbuds",
            "noise cancelling headphones",
            "portable bluetooth speaker",
            "audio headphones",
        ],
        "events": [
            ("product_view", "Wireless Earbuds Neo"),
            ("wishlist_add", "Wireless Earbuds Neo"),
            ("add_to_cart", "Wireless Earbuds Neo"),
            ("product_view", "Sony WH-1000XM5 Headphones"),
            ("product_click", "Sony WH-1000XM5 Headphones"),
            ("product_view", "Apple AirPods Pro 2"),
            ("product_view", "Bluetooth Speaker Mini"),
            ("product_click", "Studio Bluetooth Speaker"),
        ],
        "orders": [
            ["Wireless Earbuds Neo"],
            ["Bluetooth Speaker Mini"],
        ],
    },
    "ml.c5@example.com": {
        "name": "ML Persona Creator",
        "phone": "+919700000005",
        "interests": ["streaming", "webcam", "microphone", "creator"],
        "follow_slugs": ["ml-creator-studio", "ml-audio-hub"],
        "searches": [
            "streaming webcam",
            "streaming webcam",
            "usb microphone",
            "usb microphone",
            "ring light for streaming",
            "creator setup usb",
        ],
        "events": [
            ("product_view", "4K Streaming Webcam"),
            ("wishlist_add", "4K Streaming Webcam"),
            ("add_to_cart", "4K Streaming Webcam"),
            ("product_view", "USB Condenser Mic"),
            ("product_click", "USB Condenser Mic"),
            ("product_view", "RGB Ring Light 12-inch"),
            ("wishlist_add", "RGB Ring Light 12-inch"),
            ("product_view", "USB Audio Interface Mini"),
            ("product_view", "Desk Boom Arm"),
        ],
        "orders": [
            ["USB Condenser Mic"],
            ["RGB Ring Light 12-inch"],
        ],
    },
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _placeholder(name: str, tint: str) -> str:
    return f"https://placehold.co/600x600/{tint}/ffffff?text={name.replace(' ', '+')}"


SHOP_CONFIGS = [
    {
        "name": "ML Test Electronics 1774488839",
        "slug": ANCHOR_SHOP_SLUG,
        "category": "electronics",
        "description": "Anchor catalog for local recommendation evaluation.",
        "address": "17 Residency Road, Bengaluru",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "logo_url": _placeholder("ML Test Electronics", "4f46e5"),
    },
    {
        "name": "ML Gamer Garage",
        "slug": "ml-gamer-garage",
        "category": "electronics",
        "description": "Gaming keyboards, headsets, mice, and battle-station accessories.",
        "address": "22 Brigade Road, Bengaluru",
        "latitude": 12.9364,
        "longitude": 77.6228,
        "logo_url": _placeholder("ML Gamer Garage", "7c3aed"),
    },
    {
        "name": "ML Audio Hub",
        "slug": "ml-audio-hub",
        "category": "electronics",
        "description": "Bluetooth earbuds, speakers, creator microphones, and USB audio gear.",
        "address": "5 Church Street, Bengaluru",
        "latitude": 12.9341,
        "longitude": 77.6267,
        "logo_url": _placeholder("ML Audio Hub", "0f766e"),
    },
    {
        "name": "ML Premium Audio",
        "slug": "ml-premium-audio",
        "category": "electronics",
        "description": "Premium headphones, ANC earbuds, and flagship listening devices.",
        "address": "91 MG Road, Bengaluru",
        "latitude": 12.9371,
        "longitude": 77.6253,
        "logo_url": _placeholder("ML Premium Audio", "1d4ed8"),
    },
    {
        "name": "ML Creator Studio",
        "slug": "ml-creator-studio",
        "category": "electronics",
        "description": "Streaming webcams, ring lights, creator audio interfaces, and studio gear.",
        "address": "40 Lavelle Road, Bengaluru",
        "latitude": 12.9335,
        "longitude": 77.6236,
        "logo_url": _placeholder("ML Creator Studio", "db2777"),
    },
]


PRODUCT_CONFIGS = [
    {
        "shop_slug": ANCHOR_SHOP_SLUG,
        "name": "Gaming Mouse Pro",
        "price": "2499",
        "compare_price": "3299",
        "category": "Electronics",
        "subcategory": "Gaming Accessories",
        "tags": ["gaming", "mouse", "rgb", "esports"],
        "description": "Ultra-light gaming mouse with RGB lighting, low latency sensor, and esports switches.",
        "view_count": 38,
        "wishlist_count": 18,
        "inquiry_count": 6,
        "is_featured": True,
        "created_hours_ago": 18,
    },
    {
        "shop_slug": ANCHOR_SHOP_SLUG,
        "name": "Mechanical Keyboard X",
        "price": "5799",
        "compare_price": "6999",
        "category": "Electronics",
        "subcategory": "Gaming Keyboards",
        "tags": ["keyboard", "mechanical", "gaming", "rgb"],
        "description": "Compact hot-swappable mechanical keyboard with RGB backlight and tactile switches.",
        "view_count": 31,
        "wishlist_count": 16,
        "inquiry_count": 4,
        "is_featured": True,
        "created_hours_ago": 20,
    },
    {
        "shop_slug": ANCHOR_SHOP_SLUG,
        "name": "USB-C Hub 7-in-1",
        "price": "3499",
        "compare_price": "4299",
        "category": "Electronics",
        "subcategory": "Laptop Accessories",
        "tags": ["usb", "hub", "docking", "productivity"],
        "description": "7-in-1 USB-C hub with HDMI, USB-A, SD, and PD passthrough for creator desks.",
        "view_count": 22,
        "wishlist_count": 7,
        "inquiry_count": 3,
        "created_hours_ago": 72,
    },
    {
        "shop_slug": ANCHOR_SHOP_SLUG,
        "name": "4K Streaming Webcam",
        "price": "8999",
        "compare_price": "10999",
        "category": "Electronics",
        "subcategory": "Creator Cameras",
        "tags": ["streaming", "webcam", "creator", "4k"],
        "description": "4K streaming webcam with HDR, autofocus, and low-light creator presets.",
        "view_count": 26,
        "wishlist_count": 14,
        "inquiry_count": 5,
        "is_featured": True,
        "created_hours_ago": 12,
    },
    {
        "shop_slug": ANCHOR_SHOP_SLUG,
        "name": "USB Audio Interface Mini",
        "price": "6999",
        "compare_price": "8499",
        "category": "Electronics",
        "subcategory": "Creator Audio",
        "tags": ["usb", "audio", "interface", "streaming"],
        "description": "Portable USB audio interface for streaming microphones, instruments, and creator desks.",
        "view_count": 19,
        "wishlist_count": 9,
        "inquiry_count": 2,
        "created_hours_ago": 36,
    },
    {
        "shop_slug": "ml-gamer-garage",
        "name": "Compact Mechanical Keyboard",
        "price": "5299",
        "compare_price": "6399",
        "category": "Electronics",
        "subcategory": "Gaming Keyboards",
        "tags": ["keyboard", "gaming", "mechanical", "compact"],
        "description": "60 percent compact gaming keyboard with fast optical switches and RGB layers.",
        "view_count": 34,
        "wishlist_count": 12,
        "inquiry_count": 3,
        "is_featured": True,
        "created_hours_ago": 14,
    },
    {
        "shop_slug": "ml-gamer-garage",
        "name": "Pro Gaming Headset",
        "price": "4599",
        "compare_price": "5599",
        "category": "Electronics",
        "subcategory": "Gaming Audio",
        "tags": ["headset", "gaming", "audio", "mic"],
        "description": "Gaming headset with surround audio, detachable mic, and lightweight comfort tuning.",
        "view_count": 28,
        "wishlist_count": 11,
        "inquiry_count": 4,
        "created_hours_ago": 28,
    },
    {
        "shop_slug": "ml-gamer-garage",
        "name": "RGB Mouse Pad XL",
        "price": "1499",
        "compare_price": "1999",
        "category": "Electronics",
        "subcategory": "Gaming Accessories",
        "tags": ["mousepad", "gaming", "rgb", "deskmat"],
        "description": "Extended RGB desk mat with smooth glide surface for mouse and keyboard setups.",
        "view_count": 24,
        "wishlist_count": 13,
        "inquiry_count": 1,
        "created_hours_ago": 40,
    },
    {
        "shop_slug": "ml-audio-hub",
        "name": "USB Condenser Mic",
        "price": "6299",
        "compare_price": "7499",
        "category": "Electronics",
        "subcategory": "Creator Audio",
        "tags": ["microphone", "usb", "streaming", "podcast"],
        "description": "USB condenser microphone for streaming, podcasting, and crystal-clear voice capture.",
        "view_count": 35,
        "wishlist_count": 15,
        "inquiry_count": 5,
        "is_featured": True,
        "created_hours_ago": 10,
    },
    {
        "shop_slug": "ml-audio-hub",
        "name": "Bluetooth Speaker Mini",
        "price": "3499",
        "compare_price": "4299",
        "category": "Electronics",
        "subcategory": "Portable Audio",
        "tags": ["speaker", "bluetooth", "portable", "audio"],
        "description": "Pocket Bluetooth speaker with punchy audio, fast pairing, and 12-hour battery life.",
        "view_count": 29,
        "wishlist_count": 10,
        "inquiry_count": 3,
        "created_hours_ago": 22,
    },
    {
        "shop_slug": "ml-audio-hub",
        "name": "Wireless Earbuds Neo",
        "price": "3999",
        "compare_price": "4999",
        "category": "Electronics",
        "subcategory": "True Wireless Earbuds",
        "tags": ["earbuds", "bluetooth", "wireless", "audio"],
        "description": "Wireless earbuds with low-latency bluetooth, environmental noise cancellation, and rich bass.",
        "view_count": 33,
        "wishlist_count": 17,
        "inquiry_count": 4,
        "is_featured": True,
        "created_hours_ago": 16,
    },
    {
        "shop_slug": "ml-audio-hub",
        "name": "Studio Bluetooth Speaker",
        "price": "6999",
        "compare_price": "8499",
        "category": "Electronics",
        "subcategory": "Portable Audio",
        "tags": ["speaker", "bluetooth", "audio", "stereo"],
        "description": "Room-filling bluetooth speaker with stereo pairing and balanced midrange audio.",
        "view_count": 21,
        "wishlist_count": 8,
        "inquiry_count": 2,
        "created_hours_ago": 34,
    },
    {
        "shop_slug": "ml-premium-audio",
        "name": "Sony WH-1000XM5 Headphones",
        "price": "24990",
        "compare_price": "34990",
        "category": "Electronics",
        "subcategory": "Noise Cancelling Headphones",
        "tags": ["sony", "headphones", "bluetooth", "anc", "audio"],
        "description": "Premium ANC headphones with bluetooth multipoint, adaptive sound, and detailed audio.",
        "view_count": 27,
        "wishlist_count": 16,
        "inquiry_count": 3,
        "is_featured": True,
        "created_hours_ago": 30,
    },
    {
        "shop_slug": "ml-premium-audio",
        "name": "Apple AirPods Pro 2",
        "price": "20900",
        "compare_price": "24900",
        "category": "Electronics",
        "subcategory": "True Wireless Earbuds",
        "tags": ["apple", "airpods", "earbuds", "bluetooth", "anc"],
        "description": "AirPods Pro with USB-C, adaptive audio, ANC, and seamless Apple device pairing.",
        "view_count": 25,
        "wishlist_count": 15,
        "inquiry_count": 4,
        "created_hours_ago": 26,
    },
    {
        "shop_slug": "ml-creator-studio",
        "name": "RGB Ring Light 12-inch",
        "price": "2899",
        "compare_price": "3599",
        "category": "Electronics",
        "subcategory": "Creator Lighting",
        "tags": ["ring", "light", "streaming", "creator"],
        "description": "12-inch RGB ring light with desktop stand and creator scene presets for streaming.",
        "view_count": 30,
        "wishlist_count": 12,
        "inquiry_count": 3,
        "created_hours_ago": 18,
    },
    {
        "shop_slug": "ml-creator-studio",
        "name": "Desk Boom Arm",
        "price": "2199",
        "compare_price": "2799",
        "category": "Electronics",
        "subcategory": "Creator Audio",
        "tags": ["microphone", "boom", "streaming", "creator"],
        "description": "Adjustable boom arm for streaming microphones, webcams, and creator desk setups.",
        "view_count": 17,
        "wishlist_count": 7,
        "inquiry_count": 2,
        "created_hours_ago": 44,
    },
]


async def _get_or_create_user(
    db: AsyncSession,
    *,
    email: str,
    phone: str,
    name: str,
    roles: list[str],
    active_role: str,
    interests: list[str],
) -> User:
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        user = User(email=email, phone=phone)
        db.add(user)
        await db.flush()
    user.name = name
    user.roles = roles
    user.active_role = active_role
    user.interests = interests
    user.latitude = ANCHOR_COORDS["lat"]
    user.longitude = ANCHOR_COORDS["lng"]
    user.is_active = True
    await db.flush()
    return user


async def _get_or_create_shop(db: AsyncSession, owner_id, config: dict) -> Shop:
    shop = (
        await db.execute(select(Shop).where(Shop.slug == config["slug"]))
    ).scalar_one_or_none()
    if shop is None:
        shop = Shop(
            owner_id=owner_id,
            name=config["name"],
            slug=config["slug"],
            description=config["description"],
            category=config["category"],
            address=config["address"],
            latitude=config["latitude"],
            longitude=config["longitude"],
            logo_url=config["logo_url"],
        )
        db.add(shop)
    shop.owner_id = owner_id
    shop.name = config["name"]
    shop.category = config["category"]
    shop.description = config["description"]
    shop.address = config["address"]
    shop.latitude = config["latitude"]
    shop.longitude = config["longitude"]
    shop.logo_url = config["logo_url"]
    shop.is_active = True
    shop.is_verified = True
    shop.avg_rating = 4.6
    shop.score = 86
    shop.delivery_options = ["pickup", "delivery"]
    shop.delivery_radius = 5
    shop.delivery_fee = Decimal("30")
    shop.free_delivery_above = Decimal("500")
    shop.min_order = Decimal("200")
    await db.flush()
    return shop


async def _upsert_product(db: AsyncSession, shop: Shop, config: dict) -> Product:
    product = (
        await db.execute(
            select(Product).where(Product.shop_id == shop.id, Product.name == config["name"])
        )
    ).scalar_one_or_none()
    if product is None:
        product = Product(
            shop_id=shop.id,
            name=config["name"],
            price=Decimal(config["price"]),
            category=config["category"],
            images=[_placeholder(config["name"], "111827")],
        )
        db.add(product)
    product.price = Decimal(config["price"])
    product.compare_price = Decimal(config["compare_price"]) if config.get("compare_price") else None
    product.category = config["category"]
    product.subcategory = config["subcategory"]
    product.tags = list(config["tags"])
    product.description = config["description"]
    product.images = [_placeholder(config["name"], "111827")]
    product.is_available = True
    product.is_featured = bool(config.get("is_featured", False))
    product.view_count = config.get("view_count", 0)
    product.wishlist_count = config.get("wishlist_count", 0)
    product.inquiry_count = config.get("inquiry_count", 0)
    product.created_at = _utc_now() - timedelta(hours=config.get("created_hours_ago", 48))
    await db.flush()
    return product


async def _reset_persona_history(db: AsyncSession, user_ids: Iterable) -> None:
    ids = list(user_ids)
    if not ids:
        return
    await db.execute(delete(Follow).where(Follow.user_id.in_(ids)))
    await db.execute(delete(UserEvent).where(UserEvent.user_id.in_(ids)))
    await db.execute(delete(SearchLog).where(SearchLog.user_id.in_(ids)))
    await db.execute(delete(Order).where(Order.customer_id.in_(ids), Order.order_number.like("MLR-%")))


async def _ensure_follow(db: AsyncSession, user_id, shop_id, created_at: datetime) -> None:
    follow = (
        await db.execute(select(Follow).where(Follow.user_id == user_id, Follow.shop_id == shop_id))
    ).scalar_one_or_none()
    if follow is None:
        follow = Follow(user_id=user_id, shop_id=shop_id)
        db.add(follow)
    follow.created_at = created_at


async def _add_searches(db: AsyncSession, user_id, queries: list[str], clicked_ids: list | None = None) -> None:
    clicked_ids = clicked_ids or []
    base = _utc_now() - timedelta(days=2)
    for idx, query in enumerate(queries):
        db.add(
            SearchLog(
                user_id=user_id,
                query=query,
                query_text=query,
                search_type="text",
                latitude=ANCHOR_COORDS["lat"],
                longitude=ANCHOR_COORDS["lng"],
                results_count=8,
                clicked_ids=clicked_ids[:2] if clicked_ids else None,
                created_at=base + timedelta(minutes=idx * 14),
            )
        )


async def _add_event(
    db: AsyncSession,
    *,
    user_id,
    event_type: str,
    product: Product,
    created_at: datetime,
) -> None:
    db.add(
        UserEvent(
            user_id=user_id,
            event_type=event_type,
            entity_type="product",
            entity_id=product.id,
            metadata_={
                "category": product.category,
                "subcategory": product.subcategory,
                "tags": product.tags or [],
            },
            latitude=ANCHOR_COORDS["lat"],
            longitude=ANCHOR_COORDS["lng"],
            created_at=created_at,
        )
    )


async def _add_orders(
    db: AsyncSession,
    *,
    user_id,
    order_sets: list[list[Product]],
) -> None:
    base = _utc_now() - timedelta(days=1)
    for idx, products in enumerate(order_sets, start=1):
        subtotal = sum(Decimal(str(product.price)) for product in products)
        db.add(
            Order(
                order_number=f"MLR-{str(user_id)[:8]}-{idx}",
                customer_id=user_id,
                shop_id=products[0].shop_id,
                items=[
                    {
                        "product_id": str(product.id),
                        "name": product.name,
                        "quantity": 1,
                        "price": float(product.price),
                    }
                    for product in products
                ],
                subtotal=subtotal,
                delivery_fee=Decimal("0"),
                discount=Decimal("0"),
                total=subtotal,
                status="delivered",
                delivery_type="delivery",
                payment_method="cod",
                payment_status="paid",
                delivery_address="12 Residency Road, Bengaluru",
                created_at=base + timedelta(hours=idx * 3),
            )
        )


async def ensure_recommendation_fixtures(db: AsyncSession) -> dict:
    business = await _get_or_create_user(
        db,
        email=BUSINESS_EMAIL,
        phone="+919700000099",
        name="ML Biz Owner",
        roles=["customer", "business"],
        active_role="business",
        interests=["electronics", "audio", "gaming"],
    )

    shops_by_slug: dict[str, Shop] = {}
    for shop_config in SHOP_CONFIGS:
        shops_by_slug[shop_config["slug"]] = await _get_or_create_shop(db, business.id, shop_config)

    products_by_name: dict[str, Product] = {}
    for product_config in PRODUCT_CONFIGS:
        shop = shops_by_slug[product_config["shop_slug"]]
        products_by_name[product_config["name"]] = await _upsert_product(db, shop, product_config)

    personas: dict[str, User] = {}
    for email, config in PERSONA_CONFIG.items():
        personas[email] = await _get_or_create_user(
            db,
            email=email,
            phone=config["phone"],
            name=config["name"],
            roles=["customer"],
            active_role="customer",
            interests=config["interests"],
        )

    await _reset_persona_history(db, [persona.id for persona in personas.values()])

    for email, config in PERSONA_CONFIG.items():
        user = personas[email]
        for offset, slug in enumerate(config["follow_slugs"], start=1):
            await _ensure_follow(db, user.id, shops_by_slug[slug].id, _utc_now() - timedelta(days=offset))

        clicked_ids = [
            products_by_name[name].id
            for _, name in config["events"][:3]
        ]
        await _add_searches(db, user.id, config["searches"], clicked_ids)

        base_time = _utc_now() - timedelta(days=1, hours=12)
        for idx, (event_type, product_name) in enumerate(config["events"]):
            await _add_event(
                db,
                user_id=user.id,
                event_type=event_type,
                product=products_by_name[product_name],
                created_at=base_time + timedelta(minutes=idx * 11),
            )

        order_sets = [
            [products_by_name[name] for name in order_group]
            for order_group in config["orders"]
        ]
        await _add_orders(db, user_id=user.id, order_sets=order_sets)

    await db.commit()

    return {
        "anchor_shop_id": str(shops_by_slug[ANCHOR_SHOP_SLUG].id),
        "anchor_lat": shops_by_slug[ANCHOR_SHOP_SLUG].latitude,
        "anchor_lng": shops_by_slug[ANCHOR_SHOP_SLUG].longitude,
        "persona_ids": {email: str(user.id) for email, user in personas.items()},
        "business_id": str(business.id),
        "shop_ids": {slug: str(shop.id) for slug, shop in shops_by_slug.items()},
    }
