#!/usr/bin/env python3
"""
NearShop Full-Stack API Test Suite
===================================
Tests ALL endpoints across all 10 features + core APIs.
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://165.232.182.130"
PREFIX = f"{BASE}/api/v1"

# Use the auth token from earlier (update if expired)
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlM2NjNDE0My0xOTM5LTQxMTItOTY2ZC04YzcyYTk2NDkwZDIiLCJleHAiOjE3NzQyNjM1MDMsInR5cGUiOiJhY2Nlc3MifQ.HbIG2cPPmD2VBbD0iOoGtbWE2Rep7iGpsJBH5dqEYzc"

PASS = 0
FAIL = 0
SKIP = 0
RESULTS = []


def req(method, path, params=None, body=None, auth=True, expect=200):
    global PASS, FAIL, SKIP
    url = f"{PREFIX}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    label = f"{method} {path}"
    if params:
        label += "?" + "&".join(f"{k}={v}" for k, v in list(params.items())[:3])

    try:
        data = json.dumps(body).encode() if body else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Accept", "application/json")
        if data:
            request.add_header("Content-Type", "application/json")
        if auth and TOKEN:
            request.add_header("Authorization", f"Bearer {TOKEN}")
        response = urllib.request.urlopen(request, timeout=20)
        status = response.status
        result = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            result = json.loads(e.read().decode())
        except Exception:
            result = {}
    except Exception as e:
        FAIL += 1
        msg = f"  FAIL  {label} -- Error: {e}"
        print(msg)
        RESULTS.append(("FAIL", label, str(e)))
        return None, 0

    ok = status == expect
    if ok:
        PASS += 1
        RESULTS.append(("PASS", label, ""))
    else:
        FAIL += 1
        detail = result.get("detail", "")
        if isinstance(detail, list):
            detail = detail[0].get("msg", "") if detail else ""
        RESULTS.append(("FAIL", label, f"[{status}] {str(detail)[:80]}"))

    icon = "PASS" if ok else "FAIL"
    print(f"  {icon}  [{status}] {label}")
    if not ok:
        detail_str = result.get("detail", "")
        if isinstance(detail_str, list):
            detail_str = str(detail_str[0])[:80]
        if detail_str:
            print(f"        {str(detail_str)[:120]}")
    return result, status


def section(title):
    print()
    print(f"--- {title} ---")


def main():
    print()
    print("=" * 70)
    print("  NearShop Full-Stack API Test Suite")
    print(f"  Base: {BASE}")
    print("=" * 70)

    # ================================================================
    # CORE APIS
    # ================================================================
    section("1. Health + Core")
    req("GET", "/health")
    req("GET", "/products/search")
    req("GET", "/products/search", {"q": "test"})
    req("GET", "/products/suggestions", {"q": "ric"})
    req("GET", "/shops/search", {"q": "test"})
    req("GET", "/shops/nearby", {"lat": "12.935", "lng": "77.624"})
    req("GET", "/auth/me")

    # ================================================================
    # SEARCH (Feature from earlier)
    # ================================================================
    section("2. Search + Suggestions")
    body, _ = req("GET", "/products/search", {"q": "chia"})
    if body:
        print(f"        q=chia -> {body.get('total', 0)} results")
    body, _ = req("GET", "/products/suggestions", {"q": "test"})
    if body:
        print(f"        suggestions -> {len(body.get('suggestions', []))} items")

    # ================================================================
    # BILLING (Feature 1)
    # ================================================================
    section("3. Billing")
    # Create a bill
    bill_body, bill_status = req("POST", "/billing", body={
        "customer_name": "Test Customer",
        "customer_phone": "9876543210",
        "items": [{"name": "Test Product", "price": 299, "quantity": 2}],
        "gst_percentage": 18,
        "payment_method": "cash",
    })
    if bill_body and "bill_number" in (bill_body if isinstance(bill_body, dict) else {}):
        print(f"        Created bill: {bill_body.get('bill_number')} total={bill_body.get('total')}")
        bill_id = bill_body.get("id")
        # Get bill detail
        req("GET", f"/billing/{bill_id}")
    else:
        bill_id = None

    # List bills
    body, _ = req("GET", "/billing")
    if body:
        print(f"        Bills: {body.get('total_count', 0)} total, revenue={body.get('total_revenue', 0)}")

    # Bill stats
    req("GET", "/billing/stats", {"period": "30d"})

    # Update status
    if bill_id:
        req("PUT", f"/billing/{bill_id}/status", {"status": "paid"})

    # ================================================================
    # MARKETING (Feature 2)
    # ================================================================
    section("4. Marketing / WhatsApp")
    body, _ = req("POST", "/marketing/whatsapp-text", body={"template": "catalog"})
    if body:
        text = body.get("text", "")
        print(f"        Catalog text: {len(text)} chars, starts: {text[:50]}...")

    req("POST", "/marketing/whatsapp-text", body={"template": "new_arrivals"})
    req("POST", "/marketing/whatsapp-text", body={"template": "deals"})
    req("POST", "/marketing/whatsapp-text", body={"template": "festival"})

    body, _ = req("GET", "/marketing/catalog-data")
    if body:
        print(f"        Catalog data: {len(body.get('products', []))} products, shop={body.get('shop_name', '')}")

    body, _ = req("GET", "/marketing/festivals")
    if body:
        fests = body if isinstance(body, list) else []
        print(f"        Festivals: {len(fests)} upcoming")

    # ================================================================
    # EXPENSES (Feature 3)
    # ================================================================
    section("5. Expenses + P&L")
    # Add expense
    body, _ = req("POST", "/expenses", body={"amount": 500, "category": "rent", "description": "Monthly rent"})
    if body:
        print(f"        Added expense: {body.get('category')} Rs.{body.get('amount')}")

    req("POST", "/expenses", body={"amount": 200, "category": "electricity"})
    req("POST", "/expenses", body={"amount": 1000, "category": "stock_purchase", "description": "New stock"})

    # List expenses
    body, _ = req("GET", "/expenses", {"period": "30d"})
    if body:
        print(f"        Expenses: {len(body.get('expenses', []))} items, total={body.get('total_expenses', 0)}")

    # By category
    body, _ = req("GET", "/expenses/by-category", {"period": "30d"})
    if body:
        cats = body if isinstance(body, list) else []
        print(f"        Categories: {', '.join(c['category'] for c in cats[:5])}")

    # Profit & Loss
    body, _ = req("GET", "/expenses/profit-loss", {"period": "30d"})
    if body:
        print(f"        P&L: revenue={body.get('total_revenue', 0)}, expenses={body.get('total_expenses', 0)}, profit={body.get('profit', 0)}")

    # ================================================================
    # INVENTORY (Feature 4)
    # ================================================================
    section("6. Inventory / Stock")
    # Stock value
    body, _ = req("GET", "/inventory/value")
    if body:
        print(f"        Stock: {body.get('tracked_products', 0)} tracked, {body.get('total_units', 0)} units, value={body.get('cost_value', 0)}")

    # Low stock
    body, _ = req("GET", "/inventory/low-stock")
    if body:
        items = body if isinstance(body, list) else []
        print(f"        Low stock: {len(items)} products below threshold")

    # Margins
    body, _ = req("GET", "/inventory/margins")
    if body:
        items = body if isinstance(body, list) else []
        print(f"        Margins: {len(items)} products with cost data")

    # ================================================================
    # SHOP OPERATIONS (Features 5+6)
    # ================================================================
    section("7. Shop Operations")
    # Get shops to find ID
    shops_body, _ = req("GET", "/shops/mine")
    shop_id = None
    if shops_body and isinstance(shops_body, list) and len(shops_body) > 0:
        shop_id = shops_body[0].get("id")
        print(f"        Shop: {shops_body[0].get('name')} (id={shop_id[:8]}...)")

    if shop_id:
        # Daily summary
        body, _ = req("GET", f"/shops/{shop_id}/daily-summary")
        if body:
            print(f"        Today: {body.get('orders', 0)} orders, Rs.{body.get('revenue', 0)} revenue")

        # EOD report
        body, _ = req("GET", f"/shops/{shop_id}/eod-report")
        if body:
            print(f"        EOD: orders={body.get('orders', 0)}, revenue={body.get('total_revenue', 0)}, profit={body.get('profit', 0)}")
            if body.get("whatsapp_text"):
                print(f"        WhatsApp text: {len(body['whatsapp_text'])} chars")

        # Toggle status
        body, _ = req("POST", f"/shops/{shop_id}/toggle-status")
        if body:
            print(f"        Toggle: is_active={body.get('is_active')}")
        # Toggle back
        req("POST", f"/shops/{shop_id}/toggle-status")

    # ================================================================
    # BROADCAST (Feature 7)
    # ================================================================
    section("8. Broadcast Messaging")
    body, _ = req("GET", "/broadcast/segments")
    if body:
        print(f"        Segments: all={body.get('all', 0)}, recent={body.get('recent_30d', 0)}, inactive={body.get('inactive_30d', 0)}, followers={body.get('followers', 0)}")

    body, _ = req("POST", "/broadcast/send", body={
        "title": "Test Broadcast",
        "body": "This is a test notification from the API test suite.",
        "segment": "all",
    })
    if body:
        print(f"        Broadcast: sent={body.get('sent', 0)}, targets={body.get('total_targets', 0)}")

    body, _ = req("GET", "/broadcast/history")
    if body:
        items = body if isinstance(body, list) else []
        print(f"        History: {len(items)} broadcasts")

    # ================================================================
    # ADVISOR (Feature 9)
    # ================================================================
    section("9. AI Business Advisor")
    body, _ = req("GET", "/advisor/suggestions")
    if body:
        items = body if isinstance(body, list) else []
        print(f"        Suggestions: {len(items)} total")
        for s in items[:3]:
            print(f"          [{s.get('priority', '?')}] {s.get('icon', '')} {s.get('title', '')[:60]}")

    # ================================================================
    # PUBLIC SHOP (Feature 10)
    # ================================================================
    section("10. Public Shop Website")
    if shops_body and isinstance(shops_body, list) and len(shops_body) > 0:
        slug = shops_body[0].get("slug", "test-shop")
        body, status = req("GET", f"/shops/public/{slug}", auth=False)
        if body and "shop" in body:
            s = body["shop"]
            print(f"        Public page: {s.get('name')}")
            print(f"        Products: {len(body.get('products', []))}, Reviews: {len(body.get('reviews', []))}, Deals: {len(body.get('deals', []))}")
        elif status == 404:
            print(f"        Slug '{slug}' not found (expected if shop inactive)")

    # Non-existent slug
    req("GET", "/shops/public/nonexistent-shop-xyz", auth=False, expect=404)

    # ================================================================
    # ADMIN (existing)
    # ================================================================
    section("11. Admin Dashboard")
    body, _ = req("GET", "/admin/overview")
    if body:
        print(f"        Users={body.get('total_users')}, Shops={body.get('total_shops')}, Products={body.get('total_products')}, Orders={body.get('total_orders')}")

    # ================================================================
    # SUMMARY
    # ================================================================
    print()
    print("=" * 70)
    total = PASS + FAIL
    print(f"  RESULTS: {PASS} passed, {FAIL} failed / {total} total")
    print("=" * 70)

    if FAIL > 0:
        print()
        print("  FAILURES:")
        for status, label, detail in RESULTS:
            if status == "FAIL":
                print(f"    x {label}")
                if detail:
                    print(f"      {detail}")
        print()

    return 1 if FAIL > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
