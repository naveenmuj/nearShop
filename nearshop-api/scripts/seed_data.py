"""
Seed script for NearShop demo data.
Run from the nearshop-api directory:
    python scripts/seed_data.py

This script is idempotent - it checks for existing data by phone number
before inserting to avoid duplicates.
"""

import asyncio
import sys
import os

# Ensure stdout uses UTF-8 on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
# Import all models to ensure SQLAlchemy mapper is fully configured
from app.auth.models import User
from app.shops.models import Shop
from app.products.models import Product, Category
from app.deals.models import Deal
from app.reviews.models import Review
from app.stories.models import Story
from app.community.models import CommunityPost
from app.loyalty.models import ShopCoinsLedger
from app.orders.models import Order  # noqa: F401 — registers Order mapper
import app.haggle.models  # noqa: F401
import app.reservations.models  # noqa: F401
import app.notifications.models  # noqa: F401
import app.udhaar.models  # noqa: F401

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

NOW = datetime.now(timezone.utc)


async def create_or_get_user(session: AsyncSession, phone: str, name: str, roles: list, active_role: str, lat: float, lng: float) -> User:
    result = await session.execute(select(User).where(User.phone == phone))
    existing = result.scalar_one_or_none()
    if existing:
        print(f"  User exists: {name} ({phone})")
        return existing

    user = User(
        phone=phone,
        name=name,
        roles=roles,
        active_role=active_role,
        latitude=lat,
        longitude=lng,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    print(f"  Created user: {name} ({phone})")
    return user


async def create_or_get_shop(session: AsyncSession, owner: User, name: str, slug: str, category: str, address: str, lat: float, lng: float, description: str = "") -> Shop:
    result = await session.execute(select(Shop).where(Shop.slug == slug))
    existing = result.scalar_one_or_none()
    if existing:
        print(f"  Shop exists: {name}")
        return existing

    shop = Shop(
        owner_id=owner.id,
        name=name,
        slug=slug,
        category=category,
        description=description,
        address=address,
        latitude=lat,
        longitude=lng,
        is_active=True,
        is_verified=True,
        delivery_options=["pickup", "delivery"],
    )
    session.add(shop)
    await session.flush()
    print(f"  Created shop: {name}")
    return shop


async def create_product(session: AsyncSession, shop: Shop, name: str, price: float, compare_price: float = None, category: str = None, images: list = None, description: str = "") -> Product:
    product = Product(
        shop_id=shop.id,
        name=name,
        price=price,
        compare_price=compare_price,
        category=category or shop.category,
        description=description,
        images=images or ["https://placehold.co/400x400/7C3AED/white?text=" + name[:10].replace(" ", "+")],
        is_available=True,
    )
    session.add(product)
    await session.flush()
    return product


async def seed(session: AsyncSession):
    print("\n=== Seeding Categories ===")
    categories = [
        ("Electronics", "electronics", "📱"),
        ("Groceries", "groceries", "🛒"),
        ("Fashion", "fashion", "👗"),
        ("Food & Beverages", "food-beverages", "🍜"),
        ("Home & Kitchen", "home-kitchen", "🏠"),
        ("Books & Stationery", "books-stationery", "📚"),
        ("Health & Beauty", "health-beauty", "💄"),
        ("Sports & Fitness", "sports-fitness", "🏋️"),
    ]
    for name, slug, icon in categories:
        result = await session.execute(select(Category).where(Category.slug == slug))
        existing = result.scalar_one_or_none()
        if not existing:
            cat = Category(name=name, slug=slug, icon=icon, is_active=True, display_order=categories.index((name, slug, icon)))
            session.add(cat)
            print(f"  Created category: {name}")
        else:
            print(f"  Category exists: {name}")

    print("\n=== Seeding Users ===")
    # Test customer
    customer = await create_or_get_user(
        session,
        phone="+919876543210",
        name="Rahul Sharma",
        roles=["customer", "business"],
        active_role="customer",
        lat=28.6139,
        lng=77.2090,
    )

    # Business owners
    owner1 = await create_or_get_user(
        session,
        phone="+919811111111",
        name="Amit Kumar",
        roles=["customer", "business"],
        active_role="business",
        lat=28.6145,
        lng=77.2080,
    )
    owner2 = await create_or_get_user(
        session,
        phone="+919822222222",
        name="Priya Patel",
        roles=["customer", "business"],
        active_role="business",
        lat=28.6150,
        lng=77.2100,
    )
    owner3 = await create_or_get_user(
        session,
        phone="+919833333333",
        name="Vijay Singh",
        roles=["customer", "business"],
        active_role="business",
        lat=28.6135,
        lng=77.2095,
    )
    owner4 = await create_or_get_user(
        session,
        phone="+919844444444",
        name="Sunita Devi",
        roles=["customer", "business"],
        active_role="business",
        lat=28.6130,
        lng=77.2085,
    )
    owner5 = await create_or_get_user(
        session,
        phone="+919855555555",
        name="Ravi Gupta",
        roles=["customer", "business"],
        active_role="business",
        lat=28.6155,
        lng=77.2070,
    )

    print("\n=== Seeding Shops ===")
    shop1 = await create_or_get_shop(
        session, owner1,
        name="TechZone Electronics",
        slug="techzone-electronics",
        category="electronics",
        description="Best electronics store in the area. Mobile phones, accessories, laptops and more.",
        address="12 Main Market, Connaught Place, New Delhi",
        lat=28.6145, lng=77.2080,
    )
    shop2 = await create_or_get_shop(
        session, owner2,
        name="Priya's Fresh Groceries",
        slug="priyas-fresh-groceries",
        category="groceries",
        description="Fresh vegetables, fruits, dairy and daily essentials delivered to your door.",
        address="45 Rajpur Road, Civil Lines, New Delhi",
        lat=28.6150, lng=77.2100,
    )
    shop3 = await create_or_get_shop(
        session, owner3,
        name="Fashion Street",
        slug="fashion-street-delhi",
        category="fashion",
        description="Trendy clothes, ethnic wear, accessories for men and women.",
        address="Lajpat Nagar Central Market, New Delhi",
        lat=28.6135, lng=77.2095,
    )
    shop4 = await create_or_get_shop(
        session, owner4,
        name="Sunita's Tiffin Service",
        slug="sunitas-tiffin-service",
        category="food-beverages",
        description="Home-cooked Indian meals. Dal, sabzi, roti, rice — fresh daily.",
        address="Sector 15, Rohini, New Delhi",
        lat=28.6130, lng=77.2085,
    )
    shop5 = await create_or_get_shop(
        session, owner5,
        name="BookNest",
        slug="booknest-delhi",
        category="books-stationery",
        description="New and second-hand books, stationery supplies, art materials.",
        address="Daryaganj Book Market, New Delhi",
        lat=28.6155, lng=77.2070,
    )

    print("\n=== Seeding Products ===")
    # Electronics products
    await create_product(session, shop1, "Samsung Galaxy A54 (5G)", 38999, 42999, "electronics",
        description="6.4-inch display, 50MP camera, 5000mAh battery")
    await create_product(session, shop1, "Realme C55 Smartphone", 11999, 13999, "electronics",
        description="6.72-inch display, 64MP camera, 5000mAh battery, NFC")
    await create_product(session, shop1, "boAt Airdopes 141 TWS", 1299, 2499, "electronics",
        description="Bluetooth 5.0, 42H playback, IPX4 water resistant")
    await create_product(session, shop1, "Redmi Note 12 Pro 5G", 19999, 22999, "electronics",
        description="6.67-inch AMOLED, 50MP main camera, 67W fast charging")
    await create_product(session, shop1, "USB-C Fast Charger 65W", 799, 1299, "electronics",
        description="GaN technology, multi-port charging, foldable pins")
    await create_product(session, shop1, "Logitech MX Keys Mini", 6295, 7999, "electronics",
        description="Wireless keyboard, backlit keys, Bluetooth multi-device")

    # Grocery products
    await create_product(session, shop2, "Amul Toned Milk 1L", 60, None, "groceries",
        description="Fresh toned milk, 3% fat, pasteurized")
    await create_product(session, shop2, "Fresh Tomatoes 1kg", 40, None, "groceries",
        description="Farm fresh tomatoes, red and ripe")
    await create_product(session, shop2, "Aashirvaad Atta 5kg", 260, 290, "groceries",
        description="Whole wheat flour, fresh grind, high fiber")
    await create_product(session, shop2, "Tata Salt 1kg", 28, None, "groceries",
        description="Iodized table salt, vacuum evaporated")
    await create_product(session, shop2, "Basmati Rice Premium 1kg", 120, None, "groceries",
        description="Long grain aged basmati, ideal for biryani")
    await create_product(session, shop2, "Surf Excel Easy Wash 1kg", 175, 200, "groceries",
        description="Detergent powder, tough stain removal")

    # Fashion products
    await create_product(session, shop3, "Cotton Kurta for Men", 699, 1299, "fashion",
        description="Pure cotton, regular fit, multiple colors available")
    await create_product(session, shop3, "Printed Kurti for Women", 599, 999, "fashion",
        description="Rayon fabric, floral print, size S to XXL")
    await create_product(session, shop3, "Denim Jeans Slim Fit", 999, 1799, "fashion",
        description="Stretchable denim, 5-pocket style, waist 28-36")
    await create_product(session, shop3, "Chiffon Saree with Blouse", 1299, 2499, "fashion",
        description="Lightweight chiffon, printed border, free blouse piece")
    await create_product(session, shop3, "Sports Shoes Men", 1499, 2999, "fashion",
        description="Breathable mesh, cushioned sole, sizes 6-11")

    # Food products
    await create_product(session, shop4, "Dal Makhani Tiffin Box", 120, None, "food-beverages",
        description="Home-style dal makhani with 3 rotis, serves 1")
    await create_product(session, shop4, "Rajma Chawal Combo", 130, None, "food-beverages",
        description="Rajma curry with steamed rice, salad included")
    await create_product(session, shop4, "Paneer Butter Masala Set", 160, None, "food-beverages",
        description="Rich paneer gravy with 4 rotis and rice")
    await create_product(session, shop4, "Full Meal Thali", 200, 250, "food-beverages",
        description="Dal, sabzi, roti x4, rice, pickle, papad, sweet")
    await create_product(session, shop4, "Monthly Tiffin Plan", 2800, 3500, "food-beverages",
        description="30 days lunch delivery, fresh daily, customize menu")

    # Books products
    await create_product(session, shop5, "Atomic Habits by James Clear", 399, 699, "books-stationery",
        description="Bestseller on habit building, paperback")
    await create_product(session, shop5, "NCERT Class 12 Physics Set", 350, None, "books-stationery",
        description="Both parts, latest edition, original NCERT")
    await create_product(session, shop5, "Classmate Notebook 200 Pages", 65, 80, "books-stationery",
        description="Single line, hard cover, A4 size")
    await create_product(session, shop5, "Camlin Geometry Box", 120, 150, "books-stationery",
        description="12-piece set with compass, ruler, protractor")
    await create_product(session, shop5, "The Alchemist (Hindi)", 199, 299, "books-stationery",
        description="Paulo Coelho classic in Hindi, paperback")

    print("\n=== Seeding Deals ===")
    shops_deals = [
        (shop1, "Diwali Electronics Sale", "Up to 30% off on all mobile phones!", 30, None),
        (shop1, "Earbuds Combo Offer", "Buy any earbuds and get 15% off", 15, None),
        (shop2, "Weekend Fresh Veggie Discount", "10% off on all vegetables Saturday-Sunday", 10, None),
        (shop2, "Monthly Grocery Bundle", "Flat ₹100 off on orders above ₹500", None, 100),
        (shop3, "Festive Season Sale", "25% off on ethnic wear", 25, None),
        (shop4, "First Order Special", "₹50 off on your first tiffin subscription", None, 50),
    ]
    for shop, title, desc, disc_pct, disc_amt in shops_deals:
        result = await session.execute(
            select(Deal).where(Deal.shop_id == shop.id, Deal.title == title)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            deal = Deal(
                shop_id=shop.id,
                title=title,
                description=desc,
                discount_pct=disc_pct,
                discount_amount=disc_amt,
                starts_at=NOW - timedelta(hours=1),
                expires_at=NOW + timedelta(days=30),
                is_active=True,
                max_claims=100,
            )
            session.add(deal)
            print(f"  Created deal: {title}")
        else:
            print(f"  Deal exists: {title}")

    print("\n=== Seeding Stories ===")
    story_data = [
        (shop1, "https://placehold.co/400x700/7C3AED/white?text=New+Arrivals", "New mobile arrivals this week! Samsung A54 and Realme C55 now in stock 📱"),
        (shop2, "https://placehold.co/400x700/16A34A/white?text=Fresh+Veggies", "Morning fresh vegetables just arrived 🥦🍅 Order by 10am for same day delivery"),
        (shop3, "https://placehold.co/400x700/DB2777/white?text=New+Collection", "New ethnic collection for the festive season 🎉 Check out our kurtas and sarees"),
        (shop4, "https://placehold.co/400x700/D97706/white?text=Today+Menu", "Today's special: Paneer Butter Masala + Garlic Naan 🍛 Limited tiffins available"),
        (shop5, "https://placehold.co/400x700/2563EB/white?text=Book+Sale", "Second-hand books at half price! Come visit us at Daryaganj 📚"),
    ]
    for shop, media_url, caption in story_data:
        result = await session.execute(
            select(Story).where(Story.shop_id == shop.id, Story.caption == caption)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            story = Story(
                shop_id=shop.id,
                media_url=media_url,
                media_type="image",
                caption=caption,
                expires_at=NOW + timedelta(hours=24),
            )
            session.add(story)
            print(f"  Created story for: {shop.name}")
        else:
            print(f"  Story exists for: {shop.name}")

    print("\n=== Seeding Reviews ===")
    review_data = [
        (customer, shop1, 5, "Amazing electronics store! Got my phone at a great price. Staff very helpful."),
        (customer, shop2, 4, "Fresh vegetables every day. Delivery is prompt. Highly recommend."),
        (customer, shop3, 5, "Beautiful collection of ethnic wear. Great prices and quality fabric."),
        (customer, shop4, 5, "Best tiffin service in the area. Food tastes just like home."),
        (customer, shop5, 4, "Great selection of books, especially second-hand. Found rare editions here."),
        (owner1, shop2, 4, "Good quality groceries. Delivery on time. Will order again."),
    ]
    for reviewer, shop, rating, comment in review_data:
        result = await session.execute(
            select(Review).where(Review.user_id == reviewer.id, Review.shop_id == shop.id)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            review = Review(
                user_id=reviewer.id,
                shop_id=shop.id,
                rating=rating,
                comment=comment,
                is_trusted=True,
            )
            session.add(review)
            print(f"  Created review: {reviewer.name} -> {shop.name} ({rating} stars)")
        else:
            print(f"  Review exists: {reviewer.name} -> {shop.name}")

    print("\n=== Seeding Community Posts ===")
    community_data = [
        (customer, "question", "Where can I find good quality basmati rice near Connaught Place?",
         "Looking for a reliable shop that sells premium basmati rice in bulk. Any recommendations?"),
        (customer, "tip", "TechZone Electronics has the best prices for mobile accessories",
         "I bought boAt earbuds for ₹1299 at TechZone, same ones are ₹2000 on Amazon. Check them out!"),
        (owner1, "tip", "How to identify fake electronics — tips from a shop owner",
         "Always check the IMEI, buy from verified shops, look for the ISI mark on chargers. Fake products are everywhere!"),
        (owner2, "question", "Best supplier for organic vegetables in Delhi NCR?",
         "Looking for a reliable organic vegetable supplier for my grocery shop. Any contact would be helpful."),
    ]
    for author, post_type, title, body in community_data:
        result = await session.execute(
            select(CommunityPost).where(CommunityPost.user_id == author.id, CommunityPost.title == title)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            post = CommunityPost(
                user_id=author.id,
                post_type=post_type,
                title=title,
                body=body,
                latitude=28.6139,
                longitude=77.2090,
            )
            session.add(post)
            print(f"  Created post: {title[:50]}...")
        else:
            print(f"  Post exists: {title[:50]}...")

    print("\n=== Seeding Loyalty Coins ===")
    result = await session.execute(
        select(ShopCoinsLedger).where(ShopCoinsLedger.user_id == customer.id)
    )
    existing_coins = result.scalars().all()
    if not existing_coins:
        coins = ShopCoinsLedger(
            user_id=customer.id,
            amount=500,
            balance_after=500,
            reason="welcome_bonus",
        )
        session.add(coins)
        print(f"  Added 500 welcome coins for: {customer.name}")
    else:
        print(f"  Coins already exist for: {customer.name}")

    await session.commit()
    print("\n=== Seed complete! ===")
    print("\nTest credentials (use OTP 123456 for login if OTP_BYPASS is enabled):")
    print(f"  Customer: +919876543210 (Rahul Sharma)")
    print(f"  Business: +919811111111 (Amit Kumar - TechZone Electronics)")
    print(f"  Business: +919822222222 (Priya Patel - Fresh Groceries)")


async def main():
    async with async_session() as session:
        try:
            await seed(session)
        except Exception as e:
            await session.rollback()
            print(f"\nError during seed: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
