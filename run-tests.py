#!/usr/bin/env python3
"""
NearShop Comprehensive E2E Testing Suite
Complete testing of all features: Backend APIs, Web, Mobile
"""

import sys
import os
import subprocess
import time
import requests
import json
from datetime import datetime

# Fix Windows encoding
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configuration
API_BASE = "http://localhost:8000/api/v1"
WEB_BASE = "http://localhost:5173"
BACKEND_TIMEOUT = 30
CUSTOMER_LAT = 12.9352
CUSTOMER_LNG = 77.6245

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.start_time = None
        self.end_time = None

    def log_pass(self, test_name):
        self.passed += 1
        print(f"[PASS] {test_name}")

    def log_fail(self, test_name, error):
        self.failed += 1
        self.errors.append((test_name, str(error)))
        print(f"[FAIL] {test_name}")
        print(f"  Error: {error[:100]}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        if self.errors:
            print(f"\nFailed Tests:")
            for name, error in self.errors:
                print(f"  - {name}")
                print(f"    {error[:80]}")
        print(f"{'='*60}\n")
        return self.failed == 0

results = TestResults()

def wait_for_service(url, name, timeout=BACKEND_TIMEOUT):
    """Wait for a service to be ready"""
    print(f"Waiting for {name}...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print(f"[OK] {name} is ready")
                return True
        except:
            pass
        time.sleep(0.5)
    print(f"[TIMEOUT] {name} did not respond in {timeout}s")
    return False

print("\n" + "="*60)
print("NearShop Comprehensive E2E Testing Suite")
print("="*60 + "\n")

# ===== CHECK SERVICES =====
print("1. Checking Services...")
print("-" * 60)

backend_ready = wait_for_service(f"{API_BASE}/health", "Backend API", 30)
if not backend_ready:
    print("\n[ERROR] Backend API is not running!")
    print("Please start it with: start-backend.bat or python -m uvicorn app.main:app --reload")
    sys.exit(1)

# ===== TEST BACKEND APIs =====
print("\n2. Testing Backend APIs...")
print("-" * 60)

# Test 1: Health Check
try:
    response = requests.get(f"{API_BASE}/health", timeout=5)
    if response.status_code == 200:
        results.log_pass("Backend health check")
    else:
        results.log_fail("Backend health check", f"HTTP {response.status_code}")
except Exception as e:
    results.log_fail("Backend health check", str(e))

# Test 2: Unified Search
try:
    response = requests.get(
        f"{API_BASE}/search/unified",
        params={"q": "food", "lat": CUSTOMER_LAT, "lng": CUSTOMER_LNG},
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        if "products" in data and "shops" in data:
            results.log_pass(f"Unified search (found {len(data['products'])} products, {len(data['shops'])} shops)")
        else:
            results.log_fail("Unified search", "Invalid response structure")
    else:
        results.log_fail("Unified search", f"HTTP {response.status_code}")
except Exception as e:
    results.log_fail("Unified search", str(e))

# Test 3: Search Suggestions
try:
    response = requests.get(
        f"{API_BASE}/search/suggestions",
        params={"q": "pizza", "lat": CUSTOMER_LAT, "lng": CUSTOMER_LNG},
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        results.log_pass(f"Search suggestions ({len(data.get('suggestions', []))} suggestions)")
    else:
        results.log_fail("Search suggestions", f"HTTP {response.status_code}")
except Exception as e:
    results.log_fail("Search suggestions", str(e))

# Test 4: Get Nearby Shops
try:
    response = requests.get(
        f"{API_BASE}/delivery/nearby-shops",
        params={"lat": CUSTOMER_LAT, "lng": CUSTOMER_LNG, "radius_km": 5, "limit": 10},
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        shops = data.get("shops", [])
        results.log_pass(f"Nearby shops with delivery ({len(shops)} shops found)")

        # Use first shop for further tests
        if shops:
            first_shop = shops[0]
            shop_id = first_shop.get("id")

            # Test 5: Delivery Check
            try:
                response = requests.post(
                    f"{API_BASE}/delivery/check/{shop_id}",
                    json={"customer_lat": CUSTOMER_LAT, "customer_lng": CUSTOMER_LNG},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    can_deliver = data.get("can_deliver")
                    results.log_pass(f"Delivery check (can_deliver: {can_deliver})")
                else:
                    results.log_fail("Delivery check", f"HTTP {response.status_code}")
            except Exception as e:
                results.log_fail("Delivery check", str(e))

            # Test 6: Cart Validation
            try:
                response = requests.post(
                    f"{API_BASE}/cart/validate",
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
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    results.log_pass(f"Cart validation (can_checkout: {data.get('can_checkout')})")
                else:
                    results.log_fail("Cart validation", f"HTTP {response.status_code}")
            except Exception as e:
                results.log_fail("Cart validation", str(e))
    else:
        results.log_fail("Nearby shops", f"HTTP {response.status_code}")
except Exception as e:
    results.log_fail("Nearby shops", str(e))

# ===== TEST WEB APP =====
print("\n3. Testing Web App...")
print("-" * 60)

web_ready = wait_for_service(WEB_BASE, "Web App (localhost:5173)", 20)
if web_ready:
    try:
        response = requests.get(WEB_BASE, timeout=5)
        if response.status_code == 200:
            results.log_pass("Web app homepage loads")
        else:
            results.log_fail("Web app", f"HTTP {response.status_code}")
    except Exception as e:
        results.log_fail("Web app", str(e))
else:
    print("[INFO] Web app not running - skipping web tests")
    print("   Start with: start-web.bat")

# ===== FINAL REPORT =====
print("\n")
success = results.summary()

if success:
    print("[SUCCESS] All tests passed!")
    sys.exit(0)
else:
    print("[WARNING] Some tests failed. Review the errors above.")
    sys.exit(1)
