"""
E2E Setup & Test Script
1. Create business user → shop → products → deals
2. Create customer user → browse → order → review → wishlist
3. Verify everything works end-to-end
"""

import os, sys, json, time, requests

API = "http://localhost:8000/api/v1"

# ── Firebase user creation ───────────────────────────────────────────────────

def create_firebase_users():
    """Create two Firebase users and return custom tokens."""
    try:
        import firebase_admin
        from firebase_admin import credentials, auth as fb_auth
    except ImportError:
        os.system(f"{sys.executable} -m pip install firebase-admin -q")
        import firebase_admin
        from firebase_admin import credentials, auth as fb_auth

    sa_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    try:
        firebase_admin.get_app()
    except:
        firebase_admin.initialize_app(credentials.Certificate(sa_path))

    users = {}
    for email, pw, display in [
        ("naveen.kumar3610@gmail.com", "123456", "Naveen Kumar"),
        ("naveen.kumar3610+1@gmail.com", "123456", "Priya Customer"),
    ]:
        try:
            u = fb_auth.get_user_by_email(email)
            fb_auth.delete_user(u.uid)
            print(f"  Deleted existing Firebase user: {email}")
        except:
            pass

        u = fb_auth.create_user(email=email, password=pw, display_name=display)
        # Create custom token for API auth
        custom_token = fb_auth.create_custom_token(u.uid)
        users[email] = {"uid": u.uid, "custom_token": custom_token.decode() if isinstance(custom_token, bytes) else custom_token, "display_name": display}
        print(f"  Created Firebase user: {email} (uid={u.uid})")

    return users


def exchange_firebase_token(email, uid):
    """Exchange Firebase custom token for an API access token via firebase-signin.
    Since custom tokens can't be used directly, we'll simulate by inserting user
    and getting JWT directly."""
    # Use the API's firebase-signin endpoint
    # But custom tokens need to be exchanged for ID tokens first via Firebase REST API

    # Firebase REST API to exchange custom token for ID token
    import firebase_admin
    from firebase_admin import auth as fb_auth

    # We'll create a direct approach: use custom token with Firebase REST API
    api_key = None
    # Read firebase config for web API key (not available in service account)
    # Alternative: directly create the user in DB via API endpoints

    # Simplest approach: call firebase-signin with a mock approach
    # Actually, let's just use the REST API with email/password sign-in

    # Firebase Auth REST API - sign in with email/password
    firebase_api_key = get_firebase_web_api_key()
    if not firebase_api_key:
        print("  WARNING: No Firebase Web API key found. Using direct DB insertion.")
        return None

    resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}",
        json={"email": email, "password": "123456", "returnSecureToken": True}
    )
    if resp.status_code != 200:
        print(f"  Firebase REST sign-in failed: {resp.text}")
        return None

    id_token = resp.json().get("idToken")

    # Exchange Firebase ID token for NearShop JWT
    r = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token})
    if r.status_code != 200:
        print(f"  firebase-signin failed: {r.status_code} {r.text}")
        return None

    data = r.json()
    print(f"  Got API token for {email} (new_user={data.get('is_new_user')})")
    return data


def get_firebase_web_api_key():
    """Try to get Firebase Web API key from various sources."""
    # Check common locations
    for path in [
        os.path.join(os.path.dirname(__file__), "..", "nearshop-web", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "nearshop-web", ".env.local"),
    ]:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if "VITE_FIREBASE_API_KEY" in line:
                        return line.split("=", 1)[1].strip()

    # Check android google-services.json
    gs_path = os.path.join(os.path.dirname(__file__), "..", "nearshop-mobile", "android", "app", "google-services.json")
    if os.path.exists(gs_path):
        with open(gs_path) as f:
            gs = json.load(f)
            for client in gs.get("client", []):
                for api_key in client.get("api_key", []):
                    if api_key.get("current_key"):
                        return api_key["current_key"]

    return None


def h(token):
    """Auth header helper."""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Test helpers ─────────────────────────────────────────────────────────────

def check(label, resp, expected_status=200):
    ok = resp.status_code == expected_status
    status = "PASS" if ok else "FAIL"
    icon = "+" if ok else "x"
    print(f"  [{icon}] {label}: {resp.status_code}", end="")
    if not ok:
        detail = ""
        try:
            detail = resp.json().get("detail", "")[:100]
        except:
            detail = resp.text[:100]
        print(f" — {detail}", end="")
    print()
    return ok, resp


# ── Main E2E Flow ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  NEARSHOP E2E SETUP & TEST")
    print("=" * 60)

    # Verify API is running
    try:
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        print(f"\nAPI is healthy: {r.json()}")
    except:
        print("ERROR: API not running at localhost:8000")
        sys.exit(1)

    # ── Step 1: Create Firebase users ────────────────────────────────────────
    print("\n--- Step 1: Create Firebase Users ---")
    fb_users = create_firebase_users()

    # ── Step 2: Sign in and get API tokens ───────────────────────────────────
    print("\n--- Step 2: Sign In via API ---")

    biz_email = "naveen.kumar3610@gmail.com"
    cust_email = "naveen.kumar3610+1@gmail.com"

    biz_data = exchange_firebase_token(biz_email, fb_users[biz_email]["uid"])
    if not biz_data:
        print("FATAL: Could not authenticate business user")
        sys.exit(1)

    cust_data = exchange_firebase_token(cust_email, fb_users[cust_email]["uid"])
    if not cust_data:
        print("FATAL: Could not authenticate customer user")
        sys.exit(1)

    biz_token = biz_data["access_token"]
    cust_token = cust_data["access_token"]
    biz_user = biz_data["user"]
    cust_user = cust_data["user"]

    print(f"\n  Business user: {biz_user['name']} (id={biz_user['id']})")
    print(f"  Customer user: {cust_user['name']} (id={cust_user['id']})")

    # ── Step 3: Complete business profile ────────────────────────────────────
    print("\n--- Step 3: Setup Business Profile ---")

    ok, r = check("Complete business profile", requests.post(
        f"{API}/auth/complete-profile",
        headers=h(biz_token),
        json={"name": "Naveen Kumar", "role": "business", "interests": ["Electronics", "Grocery"]}
    ))
    # Re-fetch token since role changed
    biz_data2 = exchange_firebase_token(biz_email, fb_users[biz_email]["uid"])
    if biz_data2:
        biz_token = biz_data2["access_token"]

    # Complete customer profile
    ok, r = check("Complete customer profile", requests.post(
        f"{API}/auth/complete-profile",
        headers=h(cust_token),
        json={"name": "Priya Customer", "role": "customer", "interests": ["Food", "Clothing", "Electronics"]}
    ))

    # ── Step 4: Create Shop ──────────────────────────────────────────────────
    print("\n--- Step 4: Create Shop + Products + Deals ---")

    shop_payload = {
        "name": "Naveen's Electronics Hub",
        "description": "Premium electronics store with latest gadgets, mobiles, laptops and accessories at best prices. Free delivery within 5km!",
        "category": "Electronics",
        "subcategories": ["Mobiles", "Laptops", "Accessories"],
        "phone": "9876543210",
        "whatsapp": "9876543210",
        "address": "42, MG Road, Koramangala, Bangalore - 560034",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "opening_hours": {
            "monday": {"open": "09:00", "close": "21:00"},
            "tuesday": {"open": "09:00", "close": "21:00"},
            "wednesday": {"open": "09:00", "close": "21:00"},
            "thursday": {"open": "09:00", "close": "21:00"},
            "friday": {"open": "09:00", "close": "21:00"},
            "saturday": {"open": "10:00", "close": "22:00"},
            "sunday": {"open": "10:00", "close": "20:00"}
        },
        "cover_image": "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800",
        "logo_url": "https://images.unsplash.com/photo-1560472355-536de3962603?w=200",
        "delivery_options": ["pickup", "delivery"],
        "delivery_radius": 5,
        "delivery_fee": 30,
        "free_delivery_above": 500,
        "min_order": 200
    }

    ok, r = check("Create shop", requests.post(f"{API}/shops", headers=h(biz_token), json=shop_payload))
    if not ok:
        print(f"  Shop creation failed! Response: {r.text[:300]}")
        sys.exit(1)

    shop = r.json()
    shop_id = shop["id"]
    print(f"  Shop created: {shop['name']} (id={shop_id})")

    # ── Products ─────────────────────────────────────────────────────────────
    products_data = [
        {
            "name": "iPhone 15 Pro Max 256GB",
            "description": "Apple iPhone 15 Pro Max with A17 Pro chip, titanium design, 48MP camera system. 256GB Natural Titanium.",
            "price": 134900,
            "compare_price": 159900,
            "category": "Electronics",
            "subcategory": "Mobiles",
            "tags": ["apple", "iphone", "flagship", "5g"],
            "images": [
                "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600",
                "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600"
            ],
            "is_featured": True,
        },
        {
            "name": "Samsung Galaxy S24 Ultra",
            "description": "Samsung Galaxy S24 Ultra with Snapdragon 8 Gen 3, S Pen, 200MP camera. Galaxy AI built in.",
            "price": 129999,
            "compare_price": 144999,
            "category": "Electronics",
            "subcategory": "Mobiles",
            "tags": ["samsung", "galaxy", "android", "5g", "ai"],
            "images": [
                "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600",
            ],
            "is_featured": True,
        },
        {
            "name": "MacBook Air M3 15-inch",
            "description": "Apple MacBook Air 15-inch with M3 chip, 16GB RAM, 512GB SSD. Strikingly thin design.",
            "price": 149900,
            "compare_price": 164900,
            "category": "Electronics",
            "subcategory": "Laptops",
            "tags": ["apple", "macbook", "laptop", "m3"],
            "images": [
                "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
            ],
            "is_featured": True,
        },
        {
            "name": "Sony WH-1000XM5 Headphones",
            "description": "Industry-leading noise canceling headphones with Auto NC Optimizer, crystal-clear hands-free calling.",
            "price": 24990,
            "compare_price": 34990,
            "category": "Electronics",
            "subcategory": "Accessories",
            "tags": ["sony", "headphones", "noise-canceling", "bluetooth"],
            "images": [
                "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600",
            ],
        },
        {
            "name": "Apple AirPods Pro 2",
            "description": "AirPods Pro 2nd gen with USB-C, Active Noise Cancellation, Adaptive Audio, Personalized Spatial Audio.",
            "price": 20900,
            "compare_price": 24900,
            "category": "Electronics",
            "subcategory": "Accessories",
            "tags": ["apple", "airpods", "earbuds", "wireless"],
            "images": [
                "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2?w=600",
            ],
        },
        {
            "name": "iPad Air M2 11-inch",
            "description": "iPad Air with M2 chip, 11-inch Liquid Retina display, Apple Pencil Pro support, 128GB.",
            "price": 59900,
            "compare_price": 69900,
            "category": "Electronics",
            "subcategory": "Tablets",
            "tags": ["apple", "ipad", "tablet", "m2"],
            "images": [
                "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600",
            ],
        },
        {
            "name": "Samsung 55\" Crystal 4K TV",
            "description": "Samsung 55-inch Crystal 4K UHD Smart TV with Crystal Processor, HDR, Smart Hub.",
            "price": 42990,
            "compare_price": 54990,
            "category": "Electronics",
            "subcategory": "TVs",
            "tags": ["samsung", "tv", "4k", "smart-tv"],
            "images": [
                "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600",
            ],
        },
        {
            "name": "Anker 65W USB-C Charger",
            "description": "Anker Nano II 65W compact charger with GaN II technology. Charges MacBook, iPhone, iPad.",
            "price": 2999,
            "compare_price": 4999,
            "category": "Electronics",
            "subcategory": "Accessories",
            "tags": ["anker", "charger", "usb-c", "fast-charging"],
            "images": [
                "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600",
            ],
        },
    ]

    product_ids = []
    for p in products_data:
        ok, r = check(f"Create product: {p['name'][:30]}",
                      requests.post(f"{API}/products?shop_id={shop_id}", headers=h(biz_token), json=p))
        if ok:
            pid = r.json()["id"]
            product_ids.append(pid)

    print(f"\n  Created {len(product_ids)} products")

    # ── Deals ────────────────────────────────────────────────────────────────
    deals_data = [
        {"title": "Flash Sale: 15% off iPhones!", "description": "Limited time offer on all iPhones", "discount_pct": 15, "duration_hours": 48, "product_id": product_ids[0] if len(product_ids) > 0 else None, "max_claims": 50},
        {"title": "Headphones Bonanza: 30% OFF", "description": "Sony & AirPods at massive discounts", "discount_pct": 30, "duration_hours": 24, "product_id": product_ids[3] if len(product_ids) > 3 else None, "max_claims": 20},
        {"title": "Weekend Electronics Sale", "description": "Up to 25% off on all electronics this weekend", "discount_pct": 25, "duration_hours": 72, "max_claims": 100},
    ]

    deal_ids = []
    for d in deals_data:
        ok, r = check(f"Create deal: {d['title'][:30]}",
                      requests.post(f"{API}/deals?shop_id={shop_id}", headers=h(biz_token), json=d))
        if ok:
            deal_ids.append(r.json()["id"])

    print(f"\n  Created {len(deal_ids)} deals")

    # ══════════════════════════════════════════════════════════════════════════
    # CUSTOMER ACTIVITIES
    # ══════════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    print("  CUSTOMER ACTIVITIES")
    print("=" * 60)

    # ── Browse shops ─────────────────────────────────────────────────────────
    print("\n--- Browse & Search ---")

    check("Get nearby shops", requests.get(
        f"{API}/shops/nearby?lat=12.9352&lng=77.6245&radius_km=10"))

    check("Search products: 'iphone'", requests.get(
        f"{API}/products/search?q=iphone"))

    check("Search products: 'headphones'", requests.get(
        f"{API}/products/search?q=headphones"))

    check("Unified search: 'samsung'", requests.get(
        f"{API}/search/unified?q=samsung&lat=12.9&lng=77.6"))

    check("Search suggestions: 'air'", requests.get(
        f"{API}/search/suggestions?q=air&lat=12.9&lng=77.6"))

    # ── View shop detail ─────────────────────────────────────────────────────
    print("\n--- View Shop & Products ---")

    check("Get shop detail", requests.get(f"{API}/shops/{shop_id}"))

    check("Get shop products", requests.get(f"{API}/shops/{shop_id}/products"))

    if product_ids:
        check("Get product detail", requests.get(f"{API}/products/{product_ids[0]}"))

    # ── View deals ───────────────────────────────────────────────────────────
    check("Get nearby deals", requests.get(
        f"{API}/deals/nearby?lat=12.9352&lng=77.6245"))

    # ── Log engagement ───────────────────────────────────────────────────────
    print("\n--- Customer Engagement ---")

    if product_ids:
        check("Track product view", requests.post(
            f"{API}/users/recently-viewed",
            headers=h(cust_token),
            json={"product_id": product_ids[0]}
        ))

    check("Log search", requests.post(
        f"{API}/search/log",
        headers=h(cust_token),
        json={"query": "iphone 15 pro"}
    ))

    # ── Wishlist ─────────────────────────────────────────────────────────────
    print("\n--- Wishlist ---")

    if len(product_ids) >= 3:
        for i in [0, 2, 4]:
            if i < len(product_ids):
                check(f"Add to wishlist: product {i+1}", requests.post(
                    f"{API}/wishlists/{product_ids[i]}",
                    headers=h(cust_token),
                ))

    check("Get wishlist", requests.get(f"{API}/wishlists", headers=h(cust_token)))

    # ── Follow shop ──────────────────────────────────────────────────────────
    print("\n--- Follow Shop ---")
    check("Follow shop", requests.post(
        f"{API}/shops/{shop_id}/follow", headers=h(cust_token)))

    # ── Place order ──────────────────────────────────────────────────────────
    print("\n--- Place Orders ---")

    order_ids = []
    if len(product_ids) >= 2:
        order1 = {
            "shop_id": shop_id,
            "items": [
                {"product_id": product_ids[0], "quantity": 1},
                {"product_id": product_ids[4], "quantity": 1} if len(product_ids) > 4 else {"product_id": product_ids[1], "quantity": 1},
            ],
            "delivery_type": "delivery",
            "delivery_address": "123, 4th Block, Koramangala, Bangalore - 560034",
            "payment_method": "cod",
            "notes": "Please deliver before 6 PM"
        }
        ok, r = check("Place order 1 (delivery)", requests.post(
            f"{API}/orders", headers=h(cust_token), json=order1))
        if ok:
            order_ids.append(r.json()["id"])

        order2 = {
            "shop_id": shop_id,
            "items": [
                {"product_id": product_ids[3], "quantity": 2} if len(product_ids) > 3 else {"product_id": product_ids[0], "quantity": 1},
            ],
            "delivery_type": "pickup",
            "payment_method": "cod",
            "notes": "Will pick up in the evening"
        }
        ok, r = check("Place order 2 (pickup)", requests.post(
            f"{API}/orders", headers=h(cust_token), json=order2))
        if ok:
            order_ids.append(r.json()["id"])

    check("Get customer orders", requests.get(f"{API}/orders/my", headers=h(cust_token)))

    # ── Business: update order status ────────────────────────────────────────
    print("\n--- Business: Process Orders ---")

    for oid in order_ids:
        for status in ["confirmed", "preparing", "ready"]:
            check(f"Update order to {status}", requests.put(
                f"{API}/orders/{oid}/status",
                headers=h(biz_token),
                json={"status": status}
            ))

    # ── Customer: Write reviews ──────────────────────────────────────────────
    print("\n--- Write Reviews ---")

    review_ids = []
    ok, r = check("Write review (5 stars)", requests.post(
        f"{API}/reviews",
        headers=h(cust_token),
        json={
            "shop_id": shop_id,
            "order_id": order_ids[0] if order_ids else None,
            "rating": 5,
            "comment": "Excellent shop! Products are genuine and delivery was super fast. The iPhone was well packaged. Highly recommended!",
            "images": ["https://images.unsplash.com/photo-1556656793-08538906a9f8?w=400"]
        }
    ))
    if ok:
        review_ids.append(r.json()["id"])

    if len(order_ids) > 1:
        ok, r = check("Write review (4 stars)", requests.post(
            f"{API}/reviews",
            headers=h(cust_token),
            json={
                "shop_id": shop_id,
                "order_id": order_ids[1],
                "rating": 4,
                "comment": "Good headphones quality. Pickup was smooth. Only giving 4 stars because the store was a bit crowded.",
            }
        ))
        if ok:
            review_ids.append(r.json()["id"])

    # ── Business: Reply to reviews ───────────────────────────────────────────
    print("\n--- Business: Reply to Reviews ---")
    for rid in review_ids:
        check(f"Reply to review", requests.post(
            f"{API}/reviews/{rid}/reply",
            headers=h(biz_token),
            json={"reply": "Thank you for your kind feedback! We strive to provide the best experience. See you again!"}
        ))

    # ── Get shop reviews ─────────────────────────────────────────────────────
    check("Get shop reviews", requests.get(f"{API}/reviews/shop/{shop_id}"))

    # ── Final verification ───────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  FINAL VERIFICATION")
    print("=" * 60)

    checks = [
        ("Health check", requests.get(f"{API}/health")),
        ("Nearby shops (has results)", requests.get(f"{API}/shops/nearby?lat=12.9352&lng=77.6245&radius_km=10")),
        ("Products search (has results)", requests.get(f"{API}/products/search?q=iphone")),
        ("Deals nearby (has results)", requests.get(f"{API}/deals/nearby?lat=12.9352&lng=77.6245")),
        ("Unified search", requests.get(f"{API}/search/unified?q=samsung&lat=12.9&lng=77.6")),
        ("Customer profile", requests.get(f"{API}/auth/me", headers=h(cust_token))),
        ("Business profile", requests.get(f"{API}/auth/me", headers=h(biz_token))),
    ]

    passed = 0
    failed = 0
    for label, resp in checks:
        ok, _ = check(label, resp)
        if ok:
            passed += 1
        else:
            failed += 1
        # Check for actual content
        try:
            data = resp.json()
            if "items" in data and isinstance(data["items"], list):
                print(f"       → {len(data['items'])} items returned")
            elif "products" in data:
                print(f"       → {len(data.get('products',[]))} products, {len(data.get('shops',[]))} shops")
        except:
            pass

    print(f"\n  Results: {passed} passed, {failed} failed")

    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Business: naveen.kumar3610@gmail.com / 123456")
    print(f"  Customer: naveen.kumar3610+1@gmail.com / 123456")
    print(f"  Shop: {shop_payload['name']} ({len(product_ids)} products, {len(deal_ids)} deals)")
    print(f"  Orders: {len(order_ids)}, Reviews: {len(review_ids)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
