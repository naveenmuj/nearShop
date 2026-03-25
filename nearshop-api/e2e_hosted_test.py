"""
E2E Test for Hosted VM
Creates users with +2/+3 email variants, populates data, tests all flows.
Usage: python e2e_hosted_test.py [API_URL]
"""

import os, sys, json, requests, math

API = sys.argv[1] if len(sys.argv) > 1 else "http://165.232.182.130/api/v1"
BIZ_EMAIL = "naveen.kumar3610+2@gmail.com"
CUST_EMAIL = "naveen.kumar3610+3@gmail.com"
PASSWORD = "123456"

passed = 0
failed = 0
failures = []

def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def check(label, resp, expected=200):
    global passed, failed
    ok = resp.status_code == expected
    icon = "+" if ok else "x"
    detail = ""
    if not ok:
        try: detail = f" -- {resp.json().get('detail','')[:80]}"
        except: detail = f" -- {resp.text[:80]}"
        failures.append(f"{label}: {resp.status_code}{detail}")
    print(f"  [{icon}] {label}: {resp.status_code}{detail}")
    if ok: passed += 1
    else: failed += 1
    return ok, resp

def get_firebase_api_key():
    gs = os.path.join(os.path.dirname(__file__), "..", "nearshop-mobile", "android", "app", "google-services.json")
    if os.path.exists(gs):
        with open(gs) as f:
            data = json.load(f)
            for c in data.get("client", []):
                for k in c.get("api_key", []):
                    if k.get("current_key"): return k["current_key"]
    return None

def firebase_signin(email):
    api_key = get_firebase_api_key()
    if not api_key:
        print("  ERROR: No Firebase API key found")
        return None
    resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={"email": email, "password": PASSWORD, "returnSecureToken": True}
    )
    if resp.status_code != 200:
        print(f"  Firebase sign-in failed for {email}: {resp.json().get('error',{}).get('message','')}")
        return None
    id_token = resp.json()["idToken"]
    r = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token})
    if r.status_code != 200:
        print(f"  API firebase-signin failed: {r.status_code} {r.text[:100]}")
        return None
    data = r.json()
    print(f"  Signed in: {email} (new={data.get('is_new_user')}, id={data['user']['id'][:8]}...)")
    return data

def main():
    print("=" * 60)
    print(f"  E2E TEST: {API}")
    print("=" * 60)

    # Health check
    check("Health", requests.get(f"{API}/health"))

    # ── Firebase: create users ───────────────────────────────────────────
    print("\n--- Create Firebase Users ---")
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth
    sa = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    try: firebase_admin.get_app()
    except: firebase_admin.initialize_app(credentials.Certificate(sa))

    for email in [BIZ_EMAIL, CUST_EMAIL]:
        try:
            u = fb_auth.get_user_by_email(email)
            fb_auth.delete_user(u.uid)
            print(f"  Deleted existing: {email}")
        except: pass
        fb_auth.create_user(email=email, password=PASSWORD,
            display_name="Naveen Biz" if "+2" in email else "Priya Cust")
        print(f"  Created: {email}")

    # ── Sign in via API ──────────────────────────────────────────────────
    print("\n--- Sign In ---")
    biz = firebase_signin(BIZ_EMAIL)
    cust = firebase_signin(CUST_EMAIL)
    if not biz or not cust:
        print("FATAL: Auth failed"); sys.exit(1)

    bt = biz["access_token"]
    ct = cust["access_token"]

    # ── Complete profiles ────────────────────────────────────────────────
    print("\n--- Profiles ---")
    check("Biz profile", requests.post(f"{API}/auth/complete-profile", headers=h(bt),
        json={"name": "Naveen Biz", "role": "business", "interests": ["Electronics"]}))
    # Re-auth to get updated token with business role
    biz = firebase_signin(BIZ_EMAIL)
    bt = biz["access_token"]
    check("Cust profile", requests.post(f"{API}/auth/complete-profile", headers=h(ct),
        json={"name": "Priya Cust", "role": "customer", "interests": ["Electronics","Food"]}))

    # ── Create shop ──────────────────────────────────────────────────────
    print("\n--- Create Shop ---")
    ok, r = check("Create shop", requests.post(f"{API}/shops", headers=h(bt), json={
        "name": "TechWorld Store",
        "description": "Best electronics store in Bangalore with latest gadgets",
        "category": "Electronics",
        "phone": "9876543210",
        "address": "100, MG Road, Koramangala, Bangalore",
        "latitude": 12.9352, "longitude": 77.6245,
        "cover_image": "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800",
        "logo_url": "https://images.unsplash.com/photo-1560472355-536de3962603?w=200",
        "delivery_options": ["pickup","delivery"], "delivery_radius": 5,
        "delivery_fee": 30, "free_delivery_above": 500, "min_order": 200,
        "opening_hours": {
            "monday": {"open":"09:00","close":"21:00"}, "tuesday": {"open":"09:00","close":"21:00"},
            "wednesday": {"open":"09:00","close":"21:00"}, "thursday": {"open":"09:00","close":"21:00"},
            "friday": {"open":"09:00","close":"21:00"}, "saturday": {"open":"10:00","close":"22:00"},
            "sunday": {"open":"10:00","close":"20:00"}
        }
    }))
    if not ok: print("FATAL: shop failed"); sys.exit(1)
    shop_id = r.json()["id"]

    # ── Products ─────────────────────────────────────────────────────────
    print("\n--- Products ---")
    products = [
        {"name":"iPhone 15 Pro 256GB","price":134900,"compare_price":159900,"category":"Electronics","subcategory":"Mobiles",
         "images":["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600"],"is_featured":True,
         "tags":["apple","iphone"],"description":"Apple iPhone 15 Pro with A17 Pro chip"},
        {"name":"Samsung Galaxy S24 Ultra","price":129999,"compare_price":144999,"category":"Electronics","subcategory":"Mobiles",
         "images":["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600"],"is_featured":True,
         "tags":["samsung","galaxy"],"description":"Samsung flagship with Snapdragon 8 Gen 3"},
        {"name":"MacBook Air M3","price":149900,"compare_price":164900,"category":"Electronics","subcategory":"Laptops",
         "images":["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600"],
         "tags":["apple","macbook"],"description":"Apple MacBook Air 15-inch with M3 chip"},
        {"name":"Sony WH-1000XM5","price":24990,"compare_price":34990,"category":"Electronics","subcategory":"Accessories",
         "images":["https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600"],
         "tags":["sony","headphones"],"description":"Industry-leading noise canceling headphones"},
        {"name":"AirPods Pro 2","price":20900,"compare_price":24900,"category":"Electronics","subcategory":"Accessories",
         "images":["https://images.unsplash.com/photo-1606741965326-cb990ae01bb2?w=600"],
         "tags":["apple","airpods"],"description":"AirPods Pro 2nd gen with USB-C"},
        {"name":"iPad Air M2","price":59900,"compare_price":69900,"category":"Electronics","subcategory":"Tablets",
         "images":["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600"],
         "tags":["apple","ipad"],"description":"iPad Air with M2 chip, 11-inch display"},
    ]
    pids = []
    for p in products:
        ok, r = check(f"Product: {p['name'][:25]}", requests.post(
            f"{API}/products?shop_id={shop_id}", headers=h(bt), json=p))
        if ok: pids.append(r.json()["id"])

    # ── Deals ────────────────────────────────────────────────────────────
    print("\n--- Deals ---")
    dids = []
    for d in [
        {"title":"Flash Sale: 15% off iPhones!","discount_pct":15,"duration_hours":48,
         "product_id":pids[0] if pids else None,"max_claims":50},
        {"title":"30% OFF Headphones","discount_pct":30,"duration_hours":24,
         "product_id":pids[3] if len(pids)>3 else None},
        {"title":"Weekend Sale 25% off","discount_pct":25,"duration_hours":72},
    ]:
        ok, r = check(f"Deal: {d['title'][:25]}", requests.post(
            f"{API}/deals?shop_id={shop_id}", headers=h(bt), json=d))
        if ok: dids.append(r.json()["id"])

    # ══════════════════════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    print("  CUSTOMER ACTIVITIES")
    print("=" * 60)

    # ── Browse ───────────────────────────────────────────────────────────
    print("\n--- Browse ---")
    check("Nearby shops", requests.get(f"{API}/shops/nearby?lat=12.935&lng=77.625&radius_km=10"))
    check("Search: iphone", requests.get(f"{API}/products/search?q=iphone"))
    check("Search: headphones", requests.get(f"{API}/products/search?q=headphones"))
    check("Suggestions: air", requests.get(f"{API}/search/suggestions?q=air&lat=12.9&lng=77.6"))
    check("Unified: electronics", requests.get(f"{API}/search/unified?q=electronics&lat=12.9&lng=77.6"))

    # ── View ─────────────────────────────────────────────────────────────
    print("\n--- View ---")
    check("Shop detail", requests.get(f"{API}/shops/{shop_id}"))
    check("Shop products", requests.get(f"{API}/shops/{shop_id}/products"))
    if pids: check("Product detail", requests.get(f"{API}/products/{pids[0]}"))
    check("Nearby deals", requests.get(f"{API}/deals/nearby?lat=12.935&lng=77.625"))

    # ── Engagement ───────────────────────────────────────────────────────
    print("\n--- Engagement ---")
    if pids:
        check("Track view", requests.post(f"{API}/users/recently-viewed",
            headers=h(ct), json={"product_id": pids[0]}))
    check("Log search", requests.post(f"{API}/search/log",
        headers=h(ct), json={"query": "iphone 15 pro"}))

    # ── Wishlist ─────────────────────────────────────────────────────────
    print("\n--- Wishlist ---")
    for i in [0, 2, 4]:
        if i < len(pids):
            check(f"Wishlist add #{i+1}", requests.post(
                f"{API}/wishlists/{pids[i]}", headers=h(ct)))
    check("Get wishlist", requests.get(f"{API}/wishlists", headers=h(ct)))

    # ── Follow ───────────────────────────────────────────────────────────
    check("Follow shop", requests.post(f"{API}/shops/{shop_id}/follow", headers=h(ct)))

    # ── Orders ───────────────────────────────────────────────────────────
    print("\n--- Orders ---")
    oids = []
    if len(pids) >= 2:
        ok, r = check("Order 1 (delivery)", requests.post(f"{API}/orders", headers=h(ct), json={
            "shop_id": shop_id,
            "items": [{"product_id": pids[0], "quantity": 1}, {"product_id": pids[4] if len(pids)>4 else pids[1], "quantity": 1}],
            "delivery_type": "delivery", "delivery_address": "123, Koramangala, Bangalore",
            "payment_method": "cod", "notes": "Deliver before 6 PM"
        }))
        if ok: oids.append(r.json()["id"])

        ok, r = check("Order 2 (pickup)", requests.post(f"{API}/orders", headers=h(ct), json={
            "shop_id": shop_id,
            "items": [{"product_id": pids[3] if len(pids)>3 else pids[0], "quantity": 2}],
            "delivery_type": "pickup", "payment_method": "cod"
        }))
        if ok: oids.append(r.json()["id"])

    check("Get orders", requests.get(f"{API}/orders/my", headers=h(ct)))

    # ── Business: process orders ─────────────────────────────────────────
    print("\n--- Process Orders ---")
    for oid in oids:
        for st in ["confirmed", "preparing", "ready"]:
            check(f"Order {st}", requests.put(
                f"{API}/orders/{oid}/status", headers=h(bt), json={"status": st}))

    # ── Reviews ──────────────────────────────────────────────────────────
    print("\n--- Reviews ---")
    rids = []
    ok, r = check("Review 5 stars", requests.post(f"{API}/reviews", headers=h(ct), json={
        "shop_id": shop_id, "order_id": oids[0] if oids else None, "rating": 5,
        "comment": "Excellent shop! Genuine products, fast delivery. Highly recommended!",
        "images": ["https://images.unsplash.com/photo-1556656793-08538906a9f8?w=400"]
    }))
    if ok: rids.append(r.json()["id"])

    if len(oids) > 1:
        ok, r = check("Review 4 stars", requests.post(f"{API}/reviews", headers=h(ct), json={
            "shop_id": shop_id, "order_id": oids[1], "rating": 4,
            "comment": "Good quality headphones. Pickup was smooth."
        }))
        if ok: rids.append(r.json()["id"])

    for rid in rids:
        check("Reply to review", requests.post(f"{API}/reviews/{rid}/reply", headers=h(bt),
            json={"reply": "Thank you for your feedback! See you again!"}))

    check("Shop reviews", requests.get(f"{API}/reviews/shop/{shop_id}"))

    # ── Final verification ───────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  FINAL VERIFICATION")
    print("=" * 60)

    for label, url in [
        ("Health", f"{API}/health"),
        ("Nearby shops", f"{API}/shops/nearby?lat=12.935&lng=77.625&radius_km=10"),
        ("Products search", f"{API}/products/search?q=iphone"),
        ("Deals", f"{API}/deals/nearby?lat=12.935&lng=77.625"),
        ("Unified search", f"{API}/search/unified?q=electronics&lat=12.9&lng=77.6"),
        ("Suggestions", f"{API}/search/suggestions?q=mac&lat=12.9&lng=77.6"),
        ("Customer me", f"{API}/auth/me"),
    ]:
        r = requests.get(url, headers=h(ct) if "me" in url else {})
        ok, _ = check(label, r)
        try:
            d = r.json()
            if "items" in d: print(f"       -> {len(d['items'])} items")
            elif "products" in d: print(f"       -> {len(d['products'])} products, {len(d.get('shops',[]))} shops")
            elif "suggestions" in d: print(f"       -> {len(d['suggestions'])} suggestions")
        except: pass

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"  RESULTS: {passed} PASSED, {failed} FAILED")
    print(f"  API: {API}")
    print(f"  Business: {BIZ_EMAIL} / {PASSWORD}")
    print(f"  Customer: {CUST_EMAIL} / {PASSWORD}")
    print(f"  Shop: TechWorld Store ({len(pids)} products, {len(dids)} deals)")
    print(f"  Orders: {len(oids)}, Reviews: {len(rids)}")
    if failures:
        print(f"\n  FAILURES:")
        for f in failures: print(f"    - {f}")
    print("=" * 60)

if __name__ == "__main__":
    main()
