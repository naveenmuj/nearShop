#!/usr/bin/env python3
"""
Comprehensive E2E Test Suite for NearShop Customer Features
Tests: Unified Search, Delivery Checks, Cart Validation, Shop Discovery
"""

import requests
import json
import time
from typing import Dict, Any
import sys
import io

# Fix encoding for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Configuration
API_BASE_URL = "http://localhost:8000/api/v1"
CUSTOMER_LAT = 12.9352  # Sample: Bangalore
CUSTOMER_LNG = 77.6245
TEST_TIMEOUT = 10

def log_test(name: str):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")

def log_success(msg: str):
    print(f"[PASS] {msg}")

def log_error(msg: str):
    print(f"[FAIL] {msg}")

def log_info(msg: str):
    print(f"[INFO] {msg}")

def test_unified_search():
    """Test unified search across products and shops"""
    log_test("Unified Search API")

    try:
        response = requests.get(
            f"{API_BASE_URL}/search/unified",
            params={
                "q": "food",
                "lat": CUSTOMER_LAT,
                "lng": CUSTOMER_LNG,
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error(f"HTTP {response.status_code}: {response.text[:200]}")
            return False

        data = response.json()
        products = data.get("products", [])
        shops = data.get("shops", [])

        log_success(f"Unified search returned {len(products)} products and {len(shops)} shops")

        if len(products) > 0:
            log_info(f"Sample product: {products[0].get('name')}")
        if len(shops) > 0:
            log_info(f"Sample shop: {shops[0].get('name')}")

        return True
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

def test_search_suggestions():
    """Test search suggestions"""
    log_test("Search Suggestions API")

    try:
        response = requests.get(
            f"{API_BASE_URL}/search/suggestions",
            params={
                "q": "pizza",
                "lat": CUSTOMER_LAT,
                "lng": CUSTOMER_LNG,
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error(f"HTTP {response.status_code}")
            return False

        data = response.json()
        suggestions = data.get("suggestions", [])

        log_success(f"Got {len(suggestions)} suggestions")

        for i, suggestion in enumerate(suggestions[:3]):
            log_info(f"  {i+1}. [{suggestion.get('type')}] {suggestion.get('name')}")

        return True
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

def test_nearby_shops():
    """Test getting nearby shops that deliver"""
    log_test("Nearby Shops API")

    try:
        response = requests.get(
            f"{API_BASE_URL}/delivery/nearby-shops",
            params={
                "lat": CUSTOMER_LAT,
                "lng": CUSTOMER_LNG,
                "radius_km": 5,
                "limit": 10
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error(f"HTTP {response.status_code}")
            return False

        data = response.json()
        shops = data.get("shops", [])

        log_success(f"Found {len(shops)} shops that deliver")

        if len(shops) > 0:
            shop = shops[0]
            log_info(f"Sample shop:")
            log_info(f"  Name: {shop.get('name')}")
            log_info(f"  Distance: {shop.get('distance_km')}km")
            log_info(f"  Delivery Fee: ₹{shop.get('delivery_fee')}")
            log_info(f"  Rating: {shop.get('rating')}")

            return True
        else:
            log_error("No shops found - may need test data in DB")
            return False
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

def test_delivery_check(shop_id: str = None):
    """Test delivery eligibility check"""
    log_test("Delivery Eligibility Check")

    if not shop_id:
        # First get a shop ID
        response = requests.get(
            f"{API_BASE_URL}/shops/nearby",
            params={
                "lat": CUSTOMER_LAT,
                "lng": CUSTOMER_LNG,
                "radius_km": 5,
                "page": 1,
                "per_page": 1
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error("Could not fetch shops for delivery check")
            return False

        shops = response.json().get("items", [])
        if not shops:
            log_error("No shops available for testing")
            return False

        shop_id = str(shops[0].get("id"))

    try:
        response = requests.post(
            f"{API_BASE_URL}/delivery/check/{shop_id}",
            json={
                "customer_lat": CUSTOMER_LAT,
                "customer_lng": CUSTOMER_LNG,
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error(f"HTTP {response.status_code}: {response.text[:200]}")
            return False

        data = response.json()
        can_deliver = data.get("can_deliver")
        reason = data.get("reason")
        distance = data.get("distance_km")
        fee = data.get("delivery_fee")

        log_success(f"Delivery check completed")
        log_info(f"  Can Deliver: {can_deliver}")
        log_info(f"  Reason: {reason}")
        log_info(f"  Distance: {distance}km")
        log_info(f"  Fee: ₹{fee}")

        return True
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

def test_cart_validation():
    """Test cart validation API"""
    log_test("Cart Validation API")

    # First get a shop
    try:
        response = requests.get(
            f"{API_BASE_URL}/shops/nearby",
            params={
                "lat": CUSTOMER_LAT,
                "lng": CUSTOMER_LNG,
                "page": 1,
                "per_page": 1
            },
            timeout=TEST_TIMEOUT
        )

        shops = response.json().get("items", [])
        if not shops:
            log_error("No shops available")
            return False

        shop_id = str(shops[0].get("id"))

        # Validate cart with this shop
        response = requests.post(
            f"{API_BASE_URL}/cart/validate",
            json={
                "customer_lat": CUSTOMER_LAT,
                "customer_lng": CUSTOMER_LNG,
                "items": [
                    {
                        "shop_id": shop_id,
                        "product_id": "dummy-1",
                        "quantity": 2,
                        "price": 100
                    }
                ]
            },
            timeout=TEST_TIMEOUT
        )

        if response.status_code != 200:
            log_error(f"HTTP {response.status_code}")
            return False

        data = response.json()
        can_checkout = data.get("can_checkout")
        total_fees = data.get("total_fees")
        warnings = data.get("warnings", [])
        errors = data.get("errors", [])

        log_success(f"Cart validation completed")
        log_info(f"  Can Checkout: {can_checkout}")
        log_info(f"  Total Fees: ₹{total_fees}")
        if warnings:
            log_info(f"  Warnings: {len(warnings)}")
        if errors:
            log_error(f"  Errors: {len(errors)}")

        return True
    except Exception as e:
        log_error(f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all tests and report results"""
    print(f"\n{'*'*60}")
    print(f"NearShop Customer Features - E2E Test Suite")
    print(f"{'*'*60}")
    print(f"\nTesting API at: {API_BASE_URL}")
    print(f"Customer Location: {CUSTOMER_LAT}, {CUSTOMER_LNG}\n")

    tests = [
        ("Unified Search", test_unified_search),
        ("Search Suggestions", test_search_suggestions),
        ("Nearby Shops", test_nearby_shops),
        ("Delivery Check", test_delivery_check),
        ("Cart Validation", test_cart_validation),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            time.sleep(0.5)  # Avoid rate limiting
        except Exception as e:
            log_error(f"Test failed with exception: {str(e)}")
            results.append((test_name, False))

    # Summary
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}\n")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} - {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed\n")

    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
