import requests
import json
import time
from datetime import datetime, timedelta, timezone
import jwt
import uuid
import asyncio
import websockets

BASE_URL = "http://localhost:8000/api/v1"
WS_BASE_URL = "ws://localhost:8000/api/v1"
JWT_SECRET = "nearshop-dev-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

def create_token(user_id, role):
    payload = {
        "sub": str(user_id),
        "role": role,
        "active_role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def test():
    results = []
    
    # 1. Setup mock users
    customer_id = uuid.uuid4()
    business_id = uuid.uuid4()
    
    customer_token = create_token(customer_id, "customer")
    business_token = create_token(business_id, "business")
    
    headers_cust = {"Authorization": f"Bearer {customer_token}"}
    headers_biz = {"Authorization": f"Bearer {business_token}"}

    print("--- Step 1 & 2: User setup simulated via token forgery ---")
    results.append(("User Setup", "Pass"))

    # Create a shop for the business user
    shop_data = {
        "name": "Test Shop",
        "description": "A test shop",
        "address": "123 Test St",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "Electronics"
    }
    resp = requests.post(f"{BASE_URL}/shops", json=shop_data, headers=headers_biz)
    if resp.status_code != 200:
        print(f"Failed to create shop: {resp.status_code} {resp.text}")
        results.append(("Create Shop", f"Fail: {resp.status_code}"))
        return results
    shop_id = resp.json()["id"]
    print(f"Shop created: {shop_id}")
    results.append(("Create Shop", "Pass"))

    # 3. Customer starts conversation
    conv_data = {
        "shop_id": shop_id,
        "initial_message": "Hello, is this available?"
    }
    resp = requests.post(f"{BASE_URL}/messaging/conversations", json=conv_data, headers=headers_cust)
    if resp.status_code != 200:
        print(f"Failed to start conversation: {resp.status_code} {resp.text}")
        results.append(("Start Conversation", f"Fail: {resp.status_code}"))
        return results
    conv_id = resp.json()["id"]
    print(f"Conversation started: {conv_id}")
    results.append(("Start Conversation", "Pass"))

    # 4. Business fetches conversation list
    resp = requests.get(f"{BASE_URL}/messaging/conversations", headers=headers_biz)
    if resp.status_code != 200:
        print(f"Failed to fetch conversation list: {resp.status_code}")
        results.append(("List Conversations", f"Fail: {resp.status_code}"))
    else:
        convs = resp.json()["items"]
        found = any(c["id"] == conv_id for c in convs)
        results.append(("List Conversations (Found Conv)", "Pass" if found else "Fail: Conv not in list"))
        print(f"Business conversation list count: {len(convs)}")

    # 5. Business fetches conversation detail
    resp = requests.get(f"{BASE_URL}/messaging/conversations/{conv_id}", headers=headers_biz)
    if resp.status_code != 200:
        print(f"Failed to fetch conversation detail: {resp.status_code}")
        results.append(("Get Conversation Detail", f"Fail: {resp.status_code}"))
    else:
        detail = resp.json()
        messages = detail.get("messages", [])
        found_msg = any("Hello" in m["content"] for m in messages)
        results.append(("Get Conversation Detail (Initial Msg)", "Pass" if found_msg else "Fail: Msg not found"))
        print(f"Message count in detail: {len(messages)}")

    # 6. Business replies
    reply_data = {"content": "Yes, it is!"}
    resp = requests.post(f"{BASE_URL}/messaging/conversations/{conv_id}/messages", json=reply_data, headers=headers_biz)
    if resp.status_code != 200:
        print(f"Failed to reply: {resp.status_code} {resp.text}")
        results.append(("Business Reply", f"Fail: {resp.status_code}"))
    else:
        results.append(("Business Reply", "Pass"))

    # 7. Customer fetches detail and verifies reply
    resp = requests.get(f"{BASE_URL}/messaging/conversations/{conv_id}", headers=headers_cust)
    if resp.status_code != 200:
        results.append(("Customer Verifies Reply", f"Fail: {resp.status_code}"))
    else:
        messages = resp.json().get("messages", [])
        found_reply = any("Yes, it is!" in m["content"] for m in messages)
        results.append(("Customer Verifies Reply", "Pass" if found_reply else "Fail: Reply not found"))

    # 8. Test read state
    resp = requests.post(f"{BASE_URL}/messaging/conversations/{conv_id}/read", headers=headers_cust)
    results.append(("Customer Mark Read", "Pass" if resp.status_code == 200 else f"Fail: {resp.status_code}"))

    # 9. Test Assignment (Bug fix test)
    # Check if assignment endpoint exists
    assign_data = {"assignee_id": str(business_id)}
    resp = requests.post(f"{BASE_URL}/messaging/conversations/{conv_id}/assign", json=assign_data, headers=headers_biz)
    if resp.status_code == 200:
        assignee_name = resp.json().get("assignee_name")
        results.append(("Conversation Assignment", "Pass" if assignee_name else "Fail: assignee_name missing"))
        print(f"Assigned to: {assignee_name}")
    else:
        results.append(("Conversation Assignment", f"Fail/Not Available: {resp.status_code}"))

    # 10. Websocket test
    async def test_ws():
        uri = f"{WS_BASE_URL}/messaging/ws/{conv_id}?token={customer_token}"
        try:
            async with websockets.connect(uri) as ws:
                # Wait for a message or just close
                # Since we can't easily wait for a broadcast without a second client here, 
                # we'll just check if connection is successful
                results.append(("WebSocket Connection", "Pass"))
        except Exception as e:
            results.append(("WebSocket Connection", f"Fail: {str(e)}"))

    asyncio.run(test_ws())

    return results

if __name__ == "__main__":
    test_results = test()
    print("\n--- TEST SUMMARY ---")
    for step, status in test_results:
        print(f"{step}: {status}")
