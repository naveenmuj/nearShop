#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive E2E Test Suite for NearShop API
Reads OTP codes directly from the database to enable full auth flow.

Key corrections vs original spec (discovered from OpenAPI / source schemas):
  - POST /shops: uses latitude/longitude (not lat/lng)
  - POST /products: shop_id is a QUERY param (not body), requires images[]
  - POST /deals: shop_id is a QUERY param; uses duration_hours (not starts_at/ends_at)
  - POST /stories: shop_id is a QUERY param; no shop_id in body
  - GET /reservations -> /reservations/my
  - DELETE /reservations/{id} (not PATCH /cancel)
  - POST /reservations: body is {product_id}, not {shop_id, notes}
  - GET /orders -> /orders/my
  - PUT /orders/{id}/status (not PATCH)
  - PUT /notifications/{id}/read (not POST)
  - GET /haggle/sessions -> /haggle/my
  - POST /haggle/sessions -> /haggle/start; body uses offer_amount (not initial_offer)
  - POST /haggle/{id}/messages -> /haggle/{id}/offer; body uses offer_amount
  - POST /haggle/{id}/accept -> /haggle/{id}/accept (same path, exists)
  - GET /loyalty/leaderboard: requires auth (get_current_user)
  - GET /stories/feed: requires auth (require_customer), no lat/lng
  - GET /feed/hook: requires lat/lng params
  - POST /analytics/events -> does NOT exist (404); analytics prefix is /analytics/shop/{id}/...
  - POST /ai/smart-search -> /ai/search/conversational; body uses query/latitude/longitude
  - POST /ai/price-suggestion -> GET /ai/pricing/suggest/{product_id}?shop_id=...
"""

import requests
import psycopg2
import time
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
DB_DSN   = "host=localhost dbname=nearshop user=postgres password=Winter#123 port=5432"

results = []
state = {
    "customer_token": None,
    "biz_token": None,
    "shop_id": None,
    "product_id": None,
    "order_id": None,
    "deal_id": None,
    "story_id": None,
    "reservation_id": None,
    "session_id": None,
    "post_id": None,
    "notification_id": None,
}

# ─── helpers ──────────────────────────────────────────────────────────────────

def get_otp(phone):
    try:
        conn = psycopg2.connect(DB_DSN)
        cur  = conn.cursor()
        cur.execute(
            "SELECT code FROM otp_codes WHERE phone=%s ORDER BY created_at DESC LIMIT 1",
            (phone,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        return row[0] if row else None
    except Exception as e:
        return None


def test(num, method, path, desc, headers=None, json_body=None, params=None):
    url = f"{BASE_URL}{path}"
    h   = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    try:
        resp = requests.request(
            method, url, headers=h, json=json_body, params=params,
            timeout=20, allow_redirects=True,
        )
        status = resp.status_code
        try:    body = resp.json()
        except: body = resp.text[:300]

        passed = status < 400
        flag   = "PASS" if passed else "FAIL"
        note   = ""
        if isinstance(body, dict):
            if "detail" in body:   note = str(body["detail"])[:80]
            elif "message" in body: note = str(body["message"])[:80]
            elif "id" in body:      note = f"id={body['id']}"
        elif isinstance(body, list):
            note = f"list[{len(body)}]"

        results.append(dict(num=num, method=method, path=path,
                            status=status, flag=flag, note=note, desc=desc))
        print(f"[{num:02d}] {flag} | {method:7s} {path[:52]:<52} | HTTP {status} | {note[:65]}")
        return status, body

    except requests.exceptions.ConnectionError:
        note = "Connection refused"
        results.append(dict(num=num, method=method, path=path,
                            status=0, flag="FAIL", note=note, desc=desc))
        print(f"[{num:02d}] FAIL | {method:7s} {path[:52]:<52} | HTTP 000 | {note}")
        return 0, {}
    except Exception as e:
        note = str(e)[:80]
        results.append(dict(num=num, method=method, path=path,
                            status=0, flag="FAIL", note=note, desc=desc))
        print(f"[{num:02d}] FAIL | {method:7s} {path[:52]:<52} | HTTP 000 | {note}")
        return 0, {}


def skip(num, method, path, desc, note="Dependency not available"):
    results.append(dict(num=num, method=method, path=path,
                        status=0, flag="SKIP", note=note, desc=desc))
    print(f"[{num:02d}] SKIP | {method:7s} {path[:52]:<52} | HTTP N/A | {note[:65]}")


def auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


def do_auth(phone, label):
    r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone}, timeout=10)
    if r.status_code >= 400:
        print(f"  [PRE] send-otp failed for {label}: {r.text[:80]}")
        return None
    time.sleep(0.4)
    otp = get_otp(phone)
    if not otp:
        print(f"  [PRE] OTP not found in DB for {label}")
        return None
    r2 = requests.post(f"{BASE_URL}/auth/verify-otp",
                       json={"phone": phone, "code": otp}, timeout=10)
    if r2.status_code >= 400:
        print(f"  [PRE] verify-otp failed for {label}: {r2.text[:80]}")
        return None
    tok = r2.json().get("access_token") or r2.json().get("token")
    print(f"  [PRE] {label}: authenticated OK (token={'yes' if tok else 'NO'})")
    return tok


# ─── banner ───────────────────────────────────────────────────────────────────
print("=" * 100)
print(f"NearShop API E2E Test Suite  |  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Base URL : {BASE_URL}")
print("=" * 100)

print("\nPre-flight auth (reading real OTPs from DB)...")
state["customer_token"] = do_auth("+911234567890", "customer")
state["biz_token"]      = do_auth("+911234567891", "business")
print()

print(f"{'#':>4}  RESULT  {'METHOD':<7}  {'PATH':<52}  STATUS  NOTE")
print("-" * 100)

# ─────────────────────────────────────────────────────────────────────────────
# 1-6  AUTH
# ─────────────────────────────────────────────────────────────────────────────

# 1. Send OTP — customer
st, bd = test(1, "POST", "/auth/send-otp", "Send OTP - customer",
              json_body={"phone": "+911234567890"})

# 2. Verify OTP — customer (fresh OTP from DB)
time.sleep(0.4)
real_otp = get_otp("+911234567890")
st, bd = test(2, "POST", "/auth/verify-otp", "Verify OTP - customer",
              json_body={"phone": "+911234567890", "code": real_otp or "000000"})
if st < 400 and isinstance(bd, dict):
    state["customer_token"] = bd.get("access_token") or bd.get("token") or state["customer_token"]

# 3. Complete profile — customer
st, bd = test(3, "POST", "/auth/complete-profile", "Complete profile - customer",
              headers=auth(state["customer_token"]),
              json_body={"name": "Test User", "role": "customer",
                         "lat": 12.9716, "lng": 77.5946})

# 4. Send OTP — business
st, bd = test(4, "POST", "/auth/send-otp", "Send OTP - business",
              json_body={"phone": "+911234567891"})

# 5. Verify OTP — business
time.sleep(0.4)
real_otp_biz = get_otp("+911234567891")
st, bd = test(5, "POST", "/auth/verify-otp", "Verify OTP - business",
              json_body={"phone": "+911234567891", "code": real_otp_biz or "000000"})
if st < 400 and isinstance(bd, dict):
    state["biz_token"] = bd.get("access_token") or bd.get("token") or state["biz_token"]

# 6. Complete profile — business
st, bd = test(6, "POST", "/auth/complete-profile", "Complete profile - business",
              headers=auth(state["biz_token"]),
              json_body={"name": "Biz Owner", "role": "business",
                         "lat": 12.9716, "lng": 77.5946})

# ─────────────────────────────────────────────────────────────────────────────
# 7-10  SHOPS  (latitude/longitude, not lat/lng)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(7, "POST", "/shops/", "Create shop",
              headers=auth(state["biz_token"]),
              json_body={"name": "Test Shop", "category": "grocery",
                         "latitude": 12.9716, "longitude": 77.5946,
                         "address": "123 Main St"})
if st < 400 and isinstance(bd, dict):
    state["shop_id"] = bd.get("id")

st, bd = test(8, "GET", "/shops/nearby", "Get nearby shops",
              params={"lat": 12.9716, "lng": 77.5946})

if state["shop_id"]:
    st, bd = test(9, "GET", f"/shops/{state['shop_id']}", "Get shop by ID")
    st, bd = test(10, "POST", f"/shops/{state['shop_id']}/follow", "Follow shop",
                  headers=auth(state["customer_token"]))
else:
    skip(9,  "GET",  "/shops/{id}",        "Get shop by ID")
    skip(10, "POST", "/shops/{id}/follow", "Follow shop")

# ─────────────────────────────────────────────────────────────────────────────
# 11-16  PRODUCTS  (shop_id as query param; images required)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(11, "POST", "/products/", "Create product",
              headers=auth(state["biz_token"]),
              params={"shop_id": state["shop_id"]},
              json_body={"name": "Rice 1kg", "price": "50.00",
                         "category": "grains",
                         "images": ["https://example.com/rice.jpg"]})
if st < 400 and isinstance(bd, dict):
    state["product_id"] = bd.get("id")

st, bd = test(12, "GET", "/products/search", "Search products",
              params={"q": "rice", "lat": 12.9716, "lng": 77.5946})

if state["product_id"]:
    st, bd = test(13, "GET", f"/products/{state['product_id']}", "Get product by ID")
    st, bd = test(14, "GET", f"/shops/{state['shop_id']}/products",
                  "Get shop products")
    st, bd = test(15, "PUT", f"/products/{state['product_id']}", "Update product price",
                  headers=auth(state["biz_token"]),
                  json_body={"price": "45.00",
                             "images": ["https://example.com/rice.jpg"],
                             "name": "Rice 1kg"})
    st, bd = test(16, "PUT", f"/products/{state['product_id']}/availability",
                  "Update product availability",
                  headers=auth(state["biz_token"]),
                  json_body={"is_available": True})
else:
    skip(13, "GET",  "/products/{id}",              "Get product by ID")
    skip(14, "GET",  "/shops/{id}/products",         "Get shop products")
    skip(15, "PUT",  "/products/{id}",               "Update product price")
    skip(16, "PUT",  "/products/{id}/availability",  "Update availability")

# ─────────────────────────────────────────────────────────────────────────────
# 17-19  WISHLISTS
# ─────────────────────────────────────────────────────────────────────────────
if state["product_id"]:
    st, bd = test(17, "POST",   f"/wishlists/{state['product_id']}", "Add to wishlist",
                  headers=auth(state["customer_token"]))
    st, bd = test(18, "GET",    "/wishlists/", "Get wishlist",
                  headers=auth(state["customer_token"]))
    st, bd = test(19, "DELETE", f"/wishlists/{state['product_id']}", "Remove from wishlist",
                  headers=auth(state["customer_token"]))
else:
    skip(17, "POST",   "/wishlists/{id}", "Add to wishlist")
    skip(18, "GET",    "/wishlists/",     "Get wishlist")
    skip(19, "DELETE", "/wishlists/{id}", "Remove from wishlist")

# ─────────────────────────────────────────────────────────────────────────────
# 20-23  ORDERS  (orders/my; PUT for status; items.price not unit_price)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(20, "POST", "/orders/", "Create order",
              headers=auth(state["customer_token"]),
              json_body={
                  "shop_id": str(state["shop_id"]) if state["shop_id"] else None,
                  "items": [{"product_id": str(state["product_id"]),
                              "quantity": 2, "price": 45.0}] if state["product_id"] else [],
                  "delivery_type": "pickup",
                  "payment_method": "cod",
              })
if st < 400 and isinstance(bd, dict):
    state["order_id"] = bd.get("id")

st, bd = test(21, "GET", "/orders/my", "List orders",
              headers=auth(state["customer_token"]))

if state["order_id"]:
    st, bd = test(22, "GET", f"/orders/{state['order_id']}", "Get order by ID",
                  headers=auth(state["customer_token"]))
    st, bd = test(23, "PUT", f"/orders/{state['order_id']}/status", "Update order status",
                  headers=auth(state["biz_token"]),
                  json_body={"status": "confirmed"})
else:
    skip(22, "GET", "/orders/{id}",        "Get order by ID")
    skip(23, "PUT", "/orders/{id}/status", "Update order status")

# ─────────────────────────────────────────────────────────────────────────────
# 24-25  REVIEWS
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(24, "POST", "/reviews/", "Create review",
              headers=auth(state["customer_token"]),
              json_body={"shop_id": str(state["shop_id"]) if state["shop_id"] else None,
                         "order_id": str(state["order_id"]) if state["order_id"] else None,
                         "rating": 5, "comment": "Great shop!"})

if state["shop_id"]:
    st, bd = test(25, "GET", f"/reviews/shop/{state['shop_id']}", "Get shop reviews")
else:
    skip(25, "GET", "/reviews/shop/{id}", "Get shop reviews")

# ─────────────────────────────────────────────────────────────────────────────
# 26-28  DEALS  (shop_id query param; duration_hours, not starts_at/ends_at)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(26, "POST", "/deals/", "Create deal",
              headers=auth(state["biz_token"]),
              params={"shop_id": state["shop_id"]},
              json_body={"title": "Weekend Sale", "description": "20% off",
                         "discount_pct": 20, "duration_hours": 120})
if st < 400 and isinstance(bd, dict):
    state["deal_id"] = bd.get("id")

st, bd = test(27, "GET", "/deals/nearby", "Get nearby deals",
              params={"lat": 12.9716, "lng": 77.5946})

if state["deal_id"]:
    st, bd = test(28, "POST", f"/deals/{state['deal_id']}/claim", "Claim deal",
                  headers=auth(state["customer_token"]))
else:
    skip(28, "POST", "/deals/{id}/claim", "Claim deal")

# ─────────────────────────────────────────────────────────────────────────────
# 29-31  STORIES  (shop_id query param; no lat/lng on feed)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(29, "POST", "/stories/", "Create story",
              headers=auth(state["biz_token"]),
              params={"shop_id": state["shop_id"]},
              json_body={"media_url": "https://example.com/img.jpg",
                         "media_type": "image"})
if st < 400 and isinstance(bd, dict):
    state["story_id"] = bd.get("id")

# GET /stories/feed requires customer auth, no lat/lng
st, bd = test(30, "GET", "/stories/feed", "Get stories feed",
              headers=auth(state["customer_token"]))

if state["story_id"]:
    st, bd = test(31, "POST", f"/stories/{state['story_id']}/view", "View story",
                  headers=auth(state["customer_token"]))
else:
    skip(31, "POST", "/stories/{id}/view", "View story")

# ─────────────────────────────────────────────────────────────────────────────
# 32-34  RESERVATIONS  (body: {product_id}; list: /my; cancel: DELETE)
# ─────────────────────────────────────────────────────────────────────────────
if state["product_id"]:
    st, bd = test(32, "POST", "/reservations/", "Create reservation",
                  headers=auth(state["customer_token"]),
                  json_body={"product_id": str(state["product_id"])})
    if st < 400 and isinstance(bd, dict):
        state["reservation_id"] = bd.get("id")
else:
    skip(32, "POST", "/reservations/", "Create reservation", "product_id not available")

st, bd = test(33, "GET", "/reservations/my", "List reservations",
              headers=auth(state["customer_token"]))

if state["reservation_id"]:
    st, bd = test(34, "DELETE", f"/reservations/{state['reservation_id']}",
                  "Cancel reservation",
                  headers=auth(state["customer_token"]))
else:
    skip(34, "DELETE", "/reservations/{id}", "Cancel reservation")

# ─────────────────────────────────────────────────────────────────────────────
# 35-38  HAGGLE  (paths: /haggle/start, /haggle/my, /haggle/{id}/offer, /haggle/{id}/accept)
# ─────────────────────────────────────────────────────────────────────────────
if state["product_id"]:
    st, bd = test(35, "POST", "/haggle/start", "Start haggle session",
                  headers=auth(state["customer_token"]),
                  json_body={"product_id": str(state["product_id"]),
                             "offer_amount": 40.0,
                             "message": "Can you do 40?"})
    if st < 400 and isinstance(bd, dict):
        state["session_id"] = bd.get("id")
else:
    skip(35, "POST", "/haggle/start", "Start haggle session", "product_id not available")

st, bd = test(36, "GET", "/haggle/my", "List haggle sessions",
              headers=auth(state["customer_token"]))

if state["session_id"]:
    st, bd = test(37, "POST", f"/haggle/{state['session_id']}/offer",
                  "Send haggle counter-offer",
                  headers=auth(state["biz_token"]),
                  json_body={"offer_amount": 43.0, "message": "Best I can do"})
    st, bd = test(38, "POST", f"/haggle/{state['session_id']}/accept",
                  "Accept haggle offer",
                  headers=auth(state["customer_token"]))
else:
    skip(37, "POST", "/haggle/{id}/offer",  "Send counter-offer")
    skip(38, "POST", "/haggle/{id}/accept", "Accept haggle offer")

# ─────────────────────────────────────────────────────────────────────────────
# 39-44  LOYALTY  (leaderboard also requires auth)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(39, "GET", "/loyalty/balance", "Get loyalty balance",
              headers=auth(state["customer_token"]))

# reference_id is Optional[UUID] — omit it to avoid 422
st, bd = test(40, "POST", "/loyalty/earn", "Earn loyalty points",
              headers=auth(state["customer_token"]),
              json_body={"amount": 100, "reason": "purchase"})

st, bd = test(41, "POST", "/loyalty/spend", "Spend loyalty points",
              headers=auth(state["customer_token"]),
              json_body={"amount": 50, "reason": "discount"})

st, bd = test(42, "GET", "/loyalty/history", "Get loyalty history",
              headers=auth(state["customer_token"]))

st, bd = test(43, "GET", "/loyalty/badges", "Get loyalty badges",
              headers=auth(state["customer_token"]))

# leaderboard uses get_current_user (any authenticated user)
st, bd = test(44, "GET", "/loyalty/leaderboard", "Get loyalty leaderboard",
              headers=auth(state["customer_token"]))

# ─────────────────────────────────────────────────────────────────────────────
# 45-50  COMMUNITY
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(45, "POST", "/community/posts", "Create community post",
              headers=auth(state["customer_token"]),
              json_body={"post_type": "question",
                         "title": "Best grocery store?",
                         "body": "Looking for fresh veggies"})
if st < 400 and isinstance(bd, dict):
    state["post_id"] = bd.get("id")

st, bd = test(46, "GET", "/community/feed", "Get community feed",
              params={"lat": 12.9716, "lng": 77.5946})

if state["post_id"]:
    st, bd = test(47, "GET", f"/community/posts/{state['post_id']}",
                  "Get community post")
    st, bd = test(48, "POST", f"/community/posts/{state['post_id']}/answers",
                  "Answer community post",
                  headers=auth(state["customer_token"]),
                  json_body={"body": "Try the market on MG Road"})
    st, bd = test(49, "POST", f"/community/posts/{state['post_id']}/upvote",
                  "Upvote community post",
                  headers=auth(state["customer_token"]))
    st, bd = test(50, "POST", f"/community/posts/{state['post_id']}/resolve",
                  "Resolve community post",
                  headers=auth(state["customer_token"]))
else:
    skip(47, "GET",  "/community/posts/{id}",         "Get community post")
    skip(48, "POST", "/community/posts/{id}/answers",  "Answer post")
    skip(49, "POST", "/community/posts/{id}/upvote",   "Upvote post")
    skip(50, "POST", "/community/posts/{id}/resolve",  "Resolve post")

# ─────────────────────────────────────────────────────────────────────────────
# 51-52  FEED  (/hook also requires lat/lng)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(51, "GET", "/feed/home", "Get home feed",
              headers=auth(state["customer_token"]),
              params={"lat": 12.9716, "lng": 77.5946})

st, bd = test(52, "GET", "/feed/hook", "Get hook feed",
              headers=auth(state["customer_token"]),
              params={"lat": 12.9716, "lng": 77.5946})

# ─────────────────────────────────────────────────────────────────────────────
# 53-55  ANALYTICS  (prefix is /analytics/shop/ not /analytics/shops/; no /events)
# ─────────────────────────────────────────────────────────────────────────────
# Test 53: /analytics/events does NOT exist — map to the demand endpoint instead
# (original spec: POST /analytics/events — not implemented; we test demand as 53b)
# We keep the test as specified but note 404 is expected / not implemented.
st, bd = test(53, "POST", "/analytics/events", "Track analytics event (not implemented)",
              headers=auth(state["customer_token"]),
              json_body={"event_type": "view", "entity_type": "product",
                         "entity_id": str(state["product_id"]) if state["product_id"] else None})

if state["shop_id"]:
    st, bd = test(54, "GET", f"/analytics/shop/{state['shop_id']}/stats",
                  "Get shop analytics stats",
                  headers=auth(state["biz_token"]))
    st, bd = test(55, "GET", f"/analytics/shop/{state['shop_id']}/products",
                  "Get shop product analytics",
                  headers=auth(state["biz_token"]))
else:
    skip(54, "GET", "/analytics/shop/{id}/stats",    "Get shop analytics stats")
    skip(55, "GET", "/analytics/shop/{id}/products", "Get shop product analytics")

# ─────────────────────────────────────────────────────────────────────────────
# 56-57  NOTIFICATIONS  (PUT to mark read)
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(56, "GET", "/notifications/", "List notifications",
              headers=auth(state["customer_token"]))
if st < 400:
    items = bd if isinstance(bd, list) else (
        bd.get("items") or bd.get("notifications") or bd.get("data") or []
    )
    if items:
        state["notification_id"] = items[0].get("id")

if state["notification_id"]:
    test(57, "PUT", f"/notifications/{state['notification_id']}/read",
         "Mark notification read",
         headers=auth(state["customer_token"]))
else:
    skip(57, "PUT", "/notifications/{id}/read", "Mark notification read",
         "No notifications to read")

# ─────────────────────────────────────────────────────────────────────────────
# 58-59  AI  (conversational search; pricing suggest is GET with product_id)
# ─────────────────────────────────────────────────────────────────────────────
# 58: POST /ai/search/conversational  (spec says /ai/smart-search — does not exist)
st, bd = test(58, "POST", "/ai/search/conversational", "AI conversational search",
              headers=auth(state["customer_token"]),
              json_body={"query": "cheap rice near me",
                         "latitude": 12.9716, "longitude": 77.5946})

# 59: GET /ai/pricing/suggest/{product_id}?shop_id=...  (spec says POST /ai/price-suggestion)
if state["product_id"] and state["shop_id"]:
    st, bd = test(59, "GET", f"/ai/pricing/suggest/{state['product_id']}",
                  "AI price suggestion",
                  headers=auth(state["biz_token"]),
                  params={"shop_id": state["shop_id"]})
else:
    skip(59, "GET", "/ai/pricing/suggest/{id}", "AI price suggestion")

# ─────────────────────────────────────────────────────────────────────────────
# 60  CATEGORIES
# ─────────────────────────────────────────────────────────────────────────────
st, bd = test(60, "GET", "/categories/", "List categories")

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
passed  = [r for r in results if r["flag"] == "PASS"]
failed  = [r for r in results if r["flag"] == "FAIL"]
skipped = [r for r in results if r["flag"] == "SKIP"]
total   = len(results)
tested  = total - len(skipped)

print("\n" + "=" * 100)
print("SUMMARY")
print("=" * 100)
print(f"  Total Tests : {total}")
print(f"  PASSED      : {len(passed)}")
print(f"  FAILED      : {len(failed)}")
print(f"  SKIPPED     : {len(skipped)}")
print(f"  Pass Rate   : {len(passed)/max(1, tested)*100:.1f}%  ({len(passed)} of {tested} tested endpoints)")

if failed:
    print()
    print("FAILED TESTS:")
    print("-" * 90)
    for r in failed:
        print(f"  [{r['num']:02d}] {r['method']:7s} {r['path']:<48} | HTTP {r['status']} | {r['note'][:60]}")

print()
print("Captured IDs / Tokens:")
for k, v in state.items():
    if v:
        s = str(v)
        print(f"  {k:<22}: {s[:60] + ('...' if len(s)>60 else '')}")

print("=" * 100)
