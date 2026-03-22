#!/usr/bin/env python3
"""
NearShop Search API -- End-to-End Test Script
=============================================
Tests all search endpoints across different scenarios.

Usage:
    python test_search_api.py
    python test_search_api.py http://localhost:8000   # custom base URL
"""

import sys
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://165.232.182.130"
PREFIX = f"{BASE}/api/v1"

PASS = 0
FAIL = 0
WARN = 0


def req(method, path, params=None, expect_status=200):
    global PASS, FAIL, WARN
    url = f"{PREFIX}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    label = f"{method} {path}"
    if params:
        label += f"?{urllib.parse.urlencode(params)}"
    try:
        request = urllib.request.Request(url, method=method)
        request.add_header("Accept", "application/json")
        response = urllib.request.urlopen(request, timeout=15)
        status = response.status
        body = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
    except Exception as e:
        print(f"  FAIL  {label}")
        print(f"        Error: {e}")
        FAIL += 1
        return None, 0

    ok = status == expect_status
    icon = "PASS" if ok else "FAIL"
    if not ok:
        FAIL += 1
    else:
        PASS += 1

    print(f"  {icon}  [{status}] {label}")
    if not ok:
        detail = body.get("detail", "")
        if detail:
            print(f"        Detail: {detail[:200]}")
    return body, status


def section(title):
    print()
    print(f"--- {title} {'--' * max(1, 60 - len(title))}")


def main():
    global PASS, FAIL, WARN
    print()
    print("=" * 70)
    print(f"  NearShop Search API -- E2E Tests")
    print(f"  Base: {BASE}")
    print("=" * 70)

    # ── 1. Health check ──────────────────────────────────────────────────────
    section("1. Health Check")
    body, _ = req("GET", "/health")
    if body:
        print(f"        status={body.get('status')}, version={body.get('version')}")

    # ── 2. Product search -- no params (should return all products) ───────────
    section("2. Product Search -- No filters (all products)")
    body, _ = req("GET", "/products/search")
    if body:
        total = body.get("total", 0)
        items = body.get("items", [])
        print(f"        total={total}, returned={len(items)}")
        if len(items) > 0:
            print(f"        First product: {items[0].get('name', '?')}")
            # Collect some product names for later search tests
            product_names = [p["name"] for p in items[:5]]
            print(f"        Product names for search tests: {product_names}")
        else:
            print("        WARNING: No products in database!")
            WARN += 1

    # ── 3. Product search -- with query term ──────────────────────────────────
    section("3. Product Search -- Text queries")

    # 3a. Known term "test"
    body, _ = req("GET", "/products/search", {"q": "test"})
    if body:
        print(f"        q=test -> total={body.get('total', 0)}, items={len(body.get('items', []))}")

    # 3b. Known term "rice"
    body, _ = req("GET", "/products/search", {"q": "rice"})
    if body:
        print(f"        q=rice -> total={body.get('total', 0)}, items={len(body.get('items', []))}")

    # 3c. Partial term "chia"
    body, _ = req("GET", "/products/search", {"q": "chia"})
    if body:
        print(f"        q=chia -> total={body.get('total', 0)}, items={len(body.get('items', []))}")

    # 3d. With location (should NOT geo-filter since no radius_km)
    body, _ = req("GET", "/products/search", {"q": "test", "lat": "19.0596", "lng": "72.8295"})
    if body:
        print(f"        q=test+lat/lng(Mumbai, no radius) -> total={body.get('total', 0)}")

    # 3e. With location AND explicit radius (should geo-filter)
    body, _ = req("GET", "/products/search", {"q": "test", "lat": "19.0596", "lng": "72.8295", "radius_km": "5"})
    if body:
        print(f"        q=test+lat/lng+radius=5km -> total={body.get('total', 0)}")

    # 3f. With location AND huge radius
    body, _ = req("GET", "/products/search", {"q": "test", "lat": "19.0596", "lng": "72.8295", "radius_km": "50"})
    if body:
        print(f"        q=test+lat/lng+radius=50km -> total={body.get('total', 0)}")

    # ── 4. Product search -- category + price filters ─────────────────────────
    section("4. Product Search -- Category & Price filters")
    body, _ = req("GET", "/products/search", {"category": "grocery"})
    if body:
        print(f"        category=grocery -> total={body.get('total', 0)}")

    body, _ = req("GET", "/products/search", {"min_price": "10", "max_price": "100"})
    if body:
        print(f"        price 10-100 -> total={body.get('total', 0)}")

    # ── 5. Product search -- sort options ─────────────────────────────────────
    section("5. Product Search -- Sort options")
    for sort in ["newest", "price_asc", "price_desc", "popular"]:
        body, _ = req("GET", "/products/search", {"sort_by": sort, "per_page": "3"})
        if body and body.get("items"):
            first = body["items"][0]
            print(f"        sort={sort} -> first: {first.get('name', '?')} (Rs.{first.get('price', '?')})")

    # ── 6. Product search -- pagination ───────────────────────────────────────
    section("6. Product Search -- Pagination")
    body, _ = req("GET", "/products/search", {"page": "1", "per_page": "5"})
    if body:
        print(f"        page=1, per_page=5 -> total={body.get('total', 0)}, items={len(body.get('items', []))}")
    body, _ = req("GET", "/products/search", {"page": "2", "per_page": "5"})
    if body:
        print(f"        page=2, per_page=5 -> items={len(body.get('items', []))}")

    # ── 7. Shop search ───────────────────────────────────────────────────────
    section("7. Shop Search")
    body, _ = req("GET", "/shops/search", {"q": "test"})
    if body:
        items = body.get("items", [])
        print(f"        q=test -> total={body.get('total', 0)}, items={len(items)}")
        if items:
            print(f"        First: {items[0].get('name', '?')} ({items[0].get('category', '?')})")

    body, _ = req("GET", "/shops/search", {"q": "chia"})
    if body:
        print(f"        q=chia -> total={body.get('total', 0)}")

    body, _ = req("GET", "/shops/search", {"q": "test", "lat": "19.0596", "lng": "72.8295"})
    if body:
        print(f"        q=test+lat/lng -> total={body.get('total', 0)} (ordered by distance)")

    # ── 8. Suggestions (autocomplete) ────────────────────────────────────────
    section("8. Search Suggestions (Autocomplete)")
    body, status = req("GET", "/products/suggestions", {"q": "te"})
    if body:
        sugg = body.get("suggestions", [])
        print(f"        q=te -> {len(sugg)} suggestions")
        for s in sugg[:5]:
            print(f"          [{s.get('type')}] {s.get('name')} ({s.get('category', '')})")

    body, status = req("GET", "/products/suggestions", {"q": "ric"})
    if body:
        sugg = body.get("suggestions", [])
        print(f"        q=ric -> {len(sugg)} suggestions")
        for s in sugg[:3]:
            print(f"          [{s.get('type')}] {s.get('name')}")

    body, status = req("GET", "/products/suggestions", {"q": "chia"})
    if body:
        sugg = body.get("suggestions", [])
        print(f"        q=chia -> {len(sugg)} suggestions")

    # 8b. Suggestions with lat/lng
    body, status = req("GET", "/products/suggestions", {"q": "test", "lat": "19.0596", "lng": "72.8295"})
    if body:
        print(f"        q=test+lat/lng -> {len(body.get('suggestions', []))} suggestions")

    # 8c. Edge cases
    body, status = req("GET", "/products/suggestions", {"q": "a"})
    if body:
        print(f"        q=a (1 char) -> {len(body.get('suggestions', []))} suggestions")

    req("GET", "/products/suggestions", {}, expect_status=422)  # missing required q
    print(f"        q missing -> correctly rejected (422)")

    # ── 9. Nearby shops ──────────────────────────────────────────────────────
    section("9. Nearby Shops")
    body, _ = req("GET", "/shops/nearby", {"lat": "12.935", "lng": "77.624"})
    if body:
        print(f"        lat=12.935(Bangalore) -> total={body.get('total', 0)}")

    body, _ = req("GET", "/shops/nearby", {"lat": "19.0596", "lng": "72.8295"})
    if body:
        print(f"        lat=19.05(Mumbai) -> total={body.get('total', 0)}")

    body, _ = req("GET", "/shops/nearby", {"lat": "12.935", "lng": "77.624", "radius_km": "50"})
    if body:
        print(f"        Bangalore radius=50km -> total={body.get('total', 0)}")

    # ── Summary ──────────────────────────────────────────────────────────────
    print()
    print("=" * 70)
    total_tests = PASS + FAIL
    print(f"  Results: {PASS} passed, {FAIL} failed, {WARN} warnings / {total_tests} total")
    if FAIL == 0:
        print("  All tests passed!")
    else:
        print(f"  {FAIL} test(s) FAILED -- see details above")
    print("=" * 70)
    print()

    return 1 if FAIL > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
