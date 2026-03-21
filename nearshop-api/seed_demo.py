"""
Demo seed script for NearShop.
Creates realistic Bangalore shops, products, deals, and stories.
Safe to run multiple times — skips existing data by phone/slug.

Usage:
  cd nearshop-api
  python seed_demo.py
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta

import asyncpg

DATABASE_URL = "postgresql://postgres:Winter%23123@localhost:5432/nearshop"

# ---------------------------------------------------------------------------
# Demo data
# ---------------------------------------------------------------------------

USERS = [
    {
        "phone": "+919900000001",
        "name": "Ravi Kumar",
        "active_role": "business",
        "roles": ["business"],
        "referral_code": "RAVI001",
        "latitude": 12.935,
        "longitude": 77.624,
    },
    {
        "phone": "+919900000002",
        "name": "Priya Sharma",
        "active_role": "business",
        "roles": ["business"],
        "referral_code": "PRIYA02",
        "latitude": 12.930,
        "longitude": 77.618,
    },
    {
        "phone": "+919900000003",
        "name": "Suresh Electronics",
        "active_role": "business",
        "roles": ["business"],
        "referral_code": "SURE03",
        "latitude": 12.940,
        "longitude": 77.630,
    },
    {
        "phone": "+919900000004",
        "name": "Demo Customer",
        "active_role": "customer",
        "roles": ["customer"],
        "referral_code": "DEMO04",
        "latitude": 12.935,
        "longitude": 77.624,
    },
]

# Bangalore coordinates — all within ~3km of (12.935, 77.624) = Koramangala
SHOPS = [
    {
        "owner_phone": "+919900000001",
        "name": "Ravi's Electronics Hub",
        "slug": "ravis-electronics-hub",
        "description": "Premium electronics store with latest gadgets, headphones, and accessories.",
        "category": "electronics",
        "subcategories": ["headphones", "mobiles", "accessories"],
        "phone": "+918022334455",
        "address": "12, 5th Block, Koramangala, Bangalore - 560034",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "cover_image": "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800",
        "avg_rating": 4.5,
        "total_reviews": 128,
    },
    {
        "owner_phone": "+919900000002",
        "name": "Priya's Silk Sarees",
        "slug": "priyas-silk-sarees",
        "description": "Authentic Banarasi and Kanchipuram silk sarees, handlooms, and ethnic wear.",
        "category": "fashion",
        "subcategories": ["sarees", "ethnic wear", "handloom"],
        "phone": "+918033445566",
        "address": "78, Indiranagar 100ft Road, Bangalore - 560038",
        "latitude": 12.9316,
        "longitude": 77.6219,
        "cover_image": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800",
        "avg_rating": 4.7,
        "total_reviews": 89,
    },
    {
        "owner_phone": "+919900000003",
        "name": "Suresh Organic Store",
        "slug": "suresh-organic-store",
        "description": "100% organic and natural products — honey, ghee, spices, and superfoods.",
        "category": "grocery",
        "subcategories": ["organic", "honey", "spices", "superfoods"],
        "phone": "+918044556677",
        "address": "34, BTM Layout 2nd Stage, Bangalore - 560076",
        "latitude": 12.9398,
        "longitude": 77.6298,
        "cover_image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
        "avg_rating": 4.3,
        "total_reviews": 56,
    },
]

PRODUCTS = [
    # Electronics
    {
        "shop_slug": "ravis-electronics-hub",
        "name": "boAt Rockerz 450 Bluetooth Headphones",
        "description": "Over-ear wireless headphones with 15-hour battery, 40mm drivers, and foldable design.",
        "price": 1299.00,
        "compare_price": 1999.00,
        "category": "electronics",
        "subcategory": "headphones",
        "tags": ["headphones", "bluetooth", "wireless", "boat"],
        "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "ravis-electronics-hub",
        "name": "Sony WH-1000XM4 Noise Cancelling Headphones",
        "description": "Industry-leading noise cancellation with 30-hour battery and multipoint connection.",
        "price": 24990.00,
        "compare_price": 29990.00,
        "category": "electronics",
        "subcategory": "headphones",
        "tags": ["headphones", "sony", "noise-cancelling", "premium"],
        "images": ["https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "ravis-electronics-hub",
        "name": "Realme Buds Air 3 TWS Earbuds",
        "description": "True wireless earbuds with active noise cancellation, 30hr total playback.",
        "price": 2999.00,
        "compare_price": 4499.00,
        "category": "electronics",
        "subcategory": "earbuds",
        "tags": ["earbuds", "tws", "realme", "wireless"],
        "images": ["https://images.unsplash.com/photo-1606220838315-056192d5e927?w=400"],
    },
    {
        "shop_slug": "ravis-electronics-hub",
        "name": "USB-C Fast Charging Cable (6ft)",
        "description": "Braided nylon USB-C cable, 100W PD fast charging, compatible with all devices.",
        "price": 399.00,
        "compare_price": 599.00,
        "category": "electronics",
        "subcategory": "accessories",
        "tags": ["cable", "usb-c", "charging", "accessories"],
        "images": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"],
    },
    # Fashion
    {
        "shop_slug": "priyas-silk-sarees",
        "name": "Banarasi Silk Saree — Royal Blue",
        "description": "Handwoven pure Banarasi silk saree with zari border. Perfect for weddings and festivals.",
        "price": 8500.00,
        "compare_price": 12000.00,
        "category": "fashion",
        "subcategory": "sarees",
        "tags": ["saree", "banarasi", "silk", "wedding", "festive"],
        "images": ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "priyas-silk-sarees",
        "name": "Kanchipuram Silk Saree — Emerald Green",
        "description": "Traditional Kanjivaram silk with gold temple border. 100% pure silk with silk mark.",
        "price": 12000.00,
        "compare_price": 16000.00,
        "category": "fashion",
        "subcategory": "sarees",
        "tags": ["saree", "kanchipuram", "silk", "kanjivaram", "gold"],
        "images": ["https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "priyas-silk-sarees",
        "name": "Cotton Kurta Set — Floral Print",
        "description": "Comfortable cotton kurta with palazzo pants. Ideal for daily wear.",
        "price": 1299.00,
        "compare_price": 1899.00,
        "category": "fashion",
        "subcategory": "ethnic wear",
        "tags": ["kurta", "cotton", "ethnic", "daily wear"],
        "images": ["https://images.unsplash.com/photo-1594938298603-c8148c4b4d4b?w=400"],
    },
    # Grocery / Organic
    {
        "shop_slug": "suresh-organic-store",
        "name": "Raw Forest Honey — 500g",
        "description": "Unprocessed wild forest honey from Coorg hills. No additives or preservatives.",
        "price": 450.00,
        "compare_price": 550.00,
        "category": "grocery",
        "subcategory": "honey",
        "tags": ["honey", "organic", "raw", "forest honey", "coorg"],
        "images": ["https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "suresh-organic-store",
        "name": "A2 Cow Ghee — 500ml",
        "description": "Traditional bilona method A2 cow ghee. Pure, aromatic, and rich in nutrients.",
        "price": 750.00,
        "compare_price": 900.00,
        "category": "grocery",
        "subcategory": "dairy",
        "tags": ["ghee", "a2", "organic", "cow ghee", "bilona"],
        "images": ["https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=400"],
        "is_featured": True,
    },
    {
        "shop_slug": "suresh-organic-store",
        "name": "Mixed Organic Spices Pack",
        "description": "Set of 8 organic ground spices: turmeric, cumin, coriander, chilli, garam masala.",
        "price": 380.00,
        "compare_price": 480.00,
        "category": "grocery",
        "subcategory": "spices",
        "tags": ["spices", "organic", "turmeric", "cumin", "masala"],
        "images": ["https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"],
    },
    {
        "shop_slug": "suresh-organic-store",
        "name": "Chia Seeds — 250g",
        "description": "Organic chia seeds, rich in omega-3, fiber, and antioxidants. Perfect for smoothies.",
        "price": 280.00,
        "compare_price": 350.00,
        "category": "grocery",
        "subcategory": "superfoods",
        "tags": ["chia seeds", "superfood", "organic", "omega-3"],
        "images": ["https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=400"],
    },
]

DEALS = [
    {
        "shop_slug": "ravis-electronics-hub",
        "title": "Weekend Electronics Bonanza",
        "description": "Flat 20% off on all headphones and earbuds this weekend!",
        "discount_pct": 20,
        "hours": 48,
    },
    {
        "shop_slug": "priyas-silk-sarees",
        "title": "Festive Season Sale",
        "description": "Up to 30% off on selected silk sarees. Limited stock!",
        "discount_pct": 30,
        "hours": 72,
    },
    {
        "shop_slug": "suresh-organic-store",
        "title": "Organic Health Week",
        "description": "Buy 2 get 1 free on all honey and ghee products!",
        "discount_pct": 15,
        "hours": 120,
    },
]

STORIES = [
    {
        "shop_slug": "ravis-electronics-hub",
        "media_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
        "media_type": "image",
        "caption": "New arrival! boAt Rockerz 450 — just ₹1299. Limited stock 🎧",
    },
    {
        "shop_slug": "priyas-silk-sarees",
        "media_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
        "media_type": "image",
        "caption": "Stunning Banarasi silk sarees for the wedding season! DM to order 💛",
    },
    {
        "shop_slug": "suresh-organic-store",
        "media_url": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600",
        "media_type": "image",
        "caption": "Pure forest honey from Coorg hills — just arrived! 🍯",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def get_or_create_user(conn, u: dict) -> str:
    row = await conn.fetchrow("SELECT id FROM users WHERE phone = $1", u["phone"])
    if row:
        uid = str(row["id"])
        print(f"  USER exists  : {u['phone']} ({u['name']}) → {uid}")
        return uid
    row = await conn.fetchrow(
        """
        INSERT INTO users (phone, name, active_role, roles, referral_code, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """,
        u["phone"], u["name"], u["active_role"],
        u["roles"], u["referral_code"],
        u.get("latitude"), u.get("longitude"),
    )
    uid = str(row["id"])
    print(f"  USER created : {u['phone']} ({u['name']}) → {uid}")
    return uid


async def get_or_create_shop(conn, s: dict, owner_id: str) -> str:
    row = await conn.fetchrow("SELECT id FROM shops WHERE slug = $1", s["slug"])
    if row:
        sid = str(row["id"])
        # Update coordinates to make sure they're correct
        await conn.execute(
            "UPDATE shops SET latitude=$1, longitude=$2, is_active=true WHERE id=$3",
            s["latitude"], s["longitude"], row["id"],
        )
        print(f"  SHOP exists  : {s['slug']} → {sid} (coords updated)")
        return sid
    row = await conn.fetchrow(
        """
        INSERT INTO shops (
            owner_id, name, slug, description, category, subcategories,
            phone, address, latitude, longitude, cover_image,
            avg_rating, total_reviews, is_active, is_verified,
            delivery_options
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,true,'{pickup}')
        RETURNING id
        """,
        owner_id, s["name"], s["slug"], s["description"],
        s["category"], s["subcategories"],
        s["phone"], s["address"], s["latitude"], s["longitude"],
        s.get("cover_image"),
        s.get("avg_rating", 0), s.get("total_reviews", 0),
    )
    sid = str(row["id"])
    print(f"  SHOP created : {s['slug']} → {sid}")
    return sid


async def get_or_create_product(conn, p: dict, shop_id: str) -> str:
    row = await conn.fetchrow(
        "SELECT id FROM products WHERE shop_id=$1 AND name=$2",
        shop_id, p["name"],
    )
    if row:
        pid = str(row["id"])
        print(f"    PRODUCT exists  : {p['name'][:50]}")
        return pid
    row = await conn.fetchrow(
        """
        INSERT INTO products (
            shop_id, name, description, price, compare_price,
            category, subcategory, tags, images, is_available, is_featured
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
        RETURNING id
        """,
        shop_id, p["name"], p.get("description"),
        p["price"], p.get("compare_price"),
        p.get("category"), p.get("subcategory"),
        p.get("tags", []), p.get("images", []),
        p.get("is_featured", False),
    )
    pid = str(row["id"])
    print(f"    PRODUCT created : {p['name'][:50]}")
    return pid


async def get_or_create_deal(conn, d: dict, shop_id: str) -> str:
    row = await conn.fetchrow(
        "SELECT id FROM deals WHERE shop_id=$1 AND title=$2", shop_id, d["title"]
    )
    if row:
        print(f"    DEAL exists  : {d['title'][:50]}")
        return str(row["id"])
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=d["hours"])
    row = await conn.fetchrow(
        """
        INSERT INTO deals (shop_id, title, description, discount_pct, starts_at, expires_at, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,true)
        RETURNING id
        """,
        shop_id, d["title"], d.get("description"), d["discount_pct"], now, expires,
    )
    print(f"    DEAL created : {d['title'][:50]}")
    return str(row["id"])


async def get_or_create_story(conn, s: dict, shop_id: str) -> str:
    row = await conn.fetchrow(
        "SELECT id FROM stories WHERE shop_id=$1 AND media_url=$2", shop_id, s["media_url"]
    )
    if row:
        print(f"    STORY exists  : {s['caption'][:40]}")
        return str(row["id"])
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    row = await conn.fetchrow(
        """
        INSERT INTO stories (shop_id, media_url, media_type, caption, expires_at)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id
        """,
        shop_id, s["media_url"], s.get("media_type", "image"), s.get("caption"), expires,
    )
    print(f"    STORY created : {s['caption'][:40]}")
    return str(row["id"])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    print("\n=== NearShop Demo Seed ===\n")

    conn = await asyncpg.connect(
        "postgresql://postgres:Winter%23123@localhost:5432/nearshop"
    )

    try:
        # 1. Users
        print("--- Users ---")
        user_map = {}   # phone -> id
        for u in USERS:
            uid = await get_or_create_user(conn, u)
            user_map[u["phone"]] = uid

        # 2. Shops (keyed by slug)
        print("\n--- Shops ---")
        shop_map = {}   # slug -> id
        for s in SHOPS:
            owner_id = user_map[s["owner_phone"]]
            sid = await get_or_create_shop(conn, s, owner_id)
            shop_map[s["slug"]] = sid

        # 3. Products
        print("\n--- Products ---")
        for p in PRODUCTS:
            sid = shop_map[p["shop_slug"]]
            await get_or_create_product(conn, p, sid)

        # Update shop product counts
        for slug, sid in shop_map.items():
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM products WHERE shop_id=$1 AND is_available=true", sid
            )
            await conn.execute("UPDATE shops SET total_products=$1 WHERE id=$2", count, sid)

        # 4. Deals
        print("\n--- Deals ---")
        for d in DEALS:
            sid = shop_map[d["shop_slug"]]
            await get_or_create_deal(conn, d, sid)

        # 5. Stories
        print("\n--- Stories ---")
        for s in STORIES:
            sid = shop_map[s["shop_slug"]]
            await get_or_create_story(conn, s, sid)

        # 6. Ensure GIN FTS index exists
        print("\n--- FTS Index ---")
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_indexes WHERE indexname='idx_products_fts'"
        )
        if exists:
            print("  GIN index idx_products_fts EXISTS")
        else:
            await conn.execute(
                """
                CREATE INDEX idx_products_fts ON products
                USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')))
                """
            )
            print("  GIN index idx_products_fts CREATED")

        # 7. Summary
        print("\n--- Summary ---")
        users_n   = await conn.fetchval("SELECT COUNT(*) FROM users")
        shops_n   = await conn.fetchval("SELECT COUNT(*) FROM shops WHERE is_active=true")
        prods_n   = await conn.fetchval("SELECT COUNT(*) FROM products WHERE is_available=true")
        deals_n   = await conn.fetchval("SELECT COUNT(*) FROM deals WHERE is_active=true")
        stories_n = await conn.fetchval("SELECT COUNT(*) FROM stories WHERE expires_at > now()")
        print(f"  Users   : {users_n}")
        print(f"  Shops   : {shops_n} active")
        print(f"  Products: {prods_n} available")
        print(f"  Deals   : {deals_n} active")
        print(f"  Stories : {stories_n} live")

        print("\n=== Seed complete ===\n")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
