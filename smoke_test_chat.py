import json
import os
import sys
import requests
import asyncio
try:
    import websockets
except ImportError:
    websockets = None

API = "http://165.232.182.130/api/v1"
WS_API = "ws://165.232.182.130/api/v1"
BIZ_EMAIL = "naveen.kumar3610+2@gmail.com"
CUST_EMAIL = "naveen.kumar3610+3@gmail.com"
PASSWORD = "123456"

def get_firebase_api_key():
    gs = os.path.join("nearshop-mobile", "android", "app", "google-services.json")
    if not os.path.exists(gs): return None
    with open(gs, "r", encoding="utf-8") as f:
        data = json.load(f)
    for c in data.get("client", []):
        for k in c.get("api_key", []):
            if k.get("current_key"): return k["current_key"]
    return None

def signin(email):
    api_key = get_firebase_api_key()
    fb = requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
                       json={"email": email, "password": PASSWORD, "returnSecureToken": True}, timeout=30)
    fb.raise_for_status()
    id_token = fb.json()["idToken"]
    r = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token}, timeout=30)
    print(f"Auth {email}: {r.status_code}")
    r.raise_for_status()
    return r.json()

async def test_ws(conv_id, token_biz, token_cust):
    if not websockets:
        print("Websockets package not installed. Skipping WS test.")
        return
    uri_biz = f"{WS_API}/messaging/ws/{conv_id}?token={token_biz}"
    uri_cust = f"{WS_API}/messaging/ws/{conv_id}?token={token_cust}"
    
    try:
        async with websockets.connect(uri_biz) as ws_biz, websockets.connect(uri_cust) as ws_cust:
            test_msg = {"content": "WS Hello", "type": "text"}
            await ws_cust.send(json.dumps(test_msg))
            resp = await asyncio.wait_for(ws_biz.recv(), timeout=5.0)
            data = json.loads(resp)
            print(f"WS Received: {data.get('content')}")
            if data.get('content') == "WS Hello":
                print("WS broadcast success")
            else:
                print(f"WS broadcast mismatch: {data}")
    except Exception as e:
        print(f"WS Error: {e}")

def main():
    try:
        print("1) Signing in users...")
        biz = signin(BIZ_EMAIL)
        cust = signin(CUST_EMAIL)
        bt, ct = biz["access_token"], cust["access_token"]
        headers_b = {"Authorization": f"Bearer {bt}", "Content-Type": "application/json"}
        headers_c = {"Authorization": f"Bearer {ct}", "Content-Type": "application/json"}

        print("2) Completing profiles...")
        requests.post(f"{API}/auth/complete-profile", headers=headers_b, json={"name": "Biz", "role": "business"})
        requests.post(f"{API}/auth/complete-profile", headers=headers_c, json={"name": "Cust", "role": "customer"})

        print("3) Customer starting conversation...")
        shops = requests.get(f"{API}/shops/mine", headers=headers_b).json()
        if not shops: raise Exception("No shop for business")
        shop_id = shops[0]["id"]
        
        start = requests.post(f"{API}/messaging/conversations", headers=headers_c, 
                             json={"shop_id": shop_id, "initial_message": "Hello from customer"})
        print(f"Start conv: {start.status_code}")
        start.raise_for_status()
        conv_id = start.json()["id"]

        print("4) Business fetching conversation...")
        detail = requests.get(f"{API}/messaging/conversations/{conv_id}", headers=headers_b)
        print(f"Biz fetch status: {detail.status_code}")
        messages = detail.json().get("messages", [])
        found = any(m.get("content") == "Hello from customer" for m in messages)
        print(f"Customer message found: {found}")

        print("5) Business replying...")
        reply = requests.post(f"{API}/messaging/conversations/{conv_id}/messages", headers=headers_b,
                             json={"content": "Reply from business"})
        print(f"Biz reply status: {reply.status_code}")

        print("6) Customer verifying reply...")
        detail_c = requests.get(f"{API}/messaging/conversations/{conv_id}", headers=headers_c)
        messages_c = detail_c.json().get("messages", [])
        found_reply = any(m.get("content") == "Reply from business" for m in messages_c)
        print(f"Business reply found: {found_reply}")

        print("7) Read state verification...")
        read_b = requests.post(f"{API}/messaging/conversations/{conv_id}/read", headers=headers_b)
        read_c = requests.post(f"{API!r}/messaging/conversations/{conv_id}/read", headers=headers_c)
        print(f"Read calls: Biz={read_b.status_code}, Cust={read_c.status_code}")

        print("8) Websocket test...")
        asyncio.run(test_ws(conv_id, bt, ct))

        print("\nEnd-to-end flow summary: " + ("PASSED" if found and found_reply else "FAILED"))
    except Exception as e:
        print(f"\nFlow FAILED with error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.status_code} {e.response.text}")

if __name__ == '__main__':
    main()
