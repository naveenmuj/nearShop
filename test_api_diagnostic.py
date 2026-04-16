#!/usr/bin/env python3
"""
Simple diagnostic test to understand API behavior
"""
import httpx
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    with httpx.Client() as client:
        resp = client.get(f"{BASE_URL}/api/v1/health")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}\n")

def test_features():
    """Test features endpoint"""
    print("Testing features endpoint...")
    with httpx.Client() as client:
        resp = client.get(f"{BASE_URL}/api/v1/features")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}\n")

def test_conversations_no_auth():
    """Test conversations endpoint without auth"""
    print("Testing /api/v1/messaging/conversations without auth...")
    with httpx.Client() as client:
        resp = client.get(f"{BASE_URL}/api/v1/messaging/conversations")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:300]}\n")

def test_conversations_with_headers():
    """Test conversations endpoint with customer/business headers"""
    print("Testing /api/v1/messaging/conversations with headers...")
    with httpx.Client() as client:
        # Try with customer header
        resp = client.get(
            f"{BASE_URL}/api/v1/messaging/conversations",
            headers={"X-Customer-Id": "test-customer-123"}
        )
        print(f"Status with X-Customer-Id: {resp.status_code}")
        print(f"Response: {resp.text[:300]}\n")

def test_auth_endpoints():
    """Test available auth endpoints"""
    print("Testing auth endpoints...")
    with httpx.Client() as client:
        # Check if there's a signin endpoint
        resp = client.post(
            f"{BASE_URL}/api/v1/auth/firebase-signin",
            json={"token": "test"}
        )
        print(f"POST /auth/firebase-signin: {resp.status_code}")
        print(f"Response: {resp.text[:300]}\n")

def test_docs():
    """Test OpenAPI docs"""
    print("Testing OpenAPI docs...")
    with httpx.Client() as client:
        resp = client.get(f"{BASE_URL}/docs")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            # Check if messaging endpoints are listed
            if "messaging" in resp.text:
                print("✓ Messaging endpoints found in OpenAPI docs")
            else:
                print("✗ Messaging endpoints NOT found in OpenAPI docs")
        print()

if __name__ == "__main__":
    print("=" * 60)
    print("API DIAGNOSTIC TEST")
    print("=" * 60 + "\n")
    
    test_health()
    test_features()
    test_conversations_no_auth()
    test_conversations_with_headers()
    test_auth_endpoints()
    test_docs()
    
    print("=" * 60)
    print("Diagnostic complete")
    print("=" * 60)
