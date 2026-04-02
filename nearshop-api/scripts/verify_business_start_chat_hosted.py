"""Targeted hosted verification for business-initiated conversation endpoint."""

import json
import os
import sys
import requests

API = sys.argv[1] if len(sys.argv) > 1 else "http://165.232.182.130/api/v1"
BIZ_EMAIL = "naveen.kumar3610+2@gmail.com"
CUST_EMAIL = "naveen.kumar3610+3@gmail.com"
PASSWORD = "123456"


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_firebase_api_key() -> str | None:
    gs = os.path.join(os.path.dirname(__file__), "..", "..", "nearshop-mobile", "android", "app", "google-services.json")
    if not os.path.exists(gs):
        return None
    with open(gs, "r", encoding="utf-8") as f:
        data = json.load(f)
    for c in data.get("client", []):
        for k in c.get("api_key", []):
            if k.get("current_key"):
                return k["current_key"]
    return None


def firebase_signin_to_api(email: str) -> dict:
    api_key = get_firebase_api_key()
    if not api_key:
        raise RuntimeError("Firebase API key not found")
    fb = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={"email": email, "password": PASSWORD, "returnSecureToken": True},
        timeout=30,
    )
    fb.raise_for_status()
    id_token = fb.json()["idToken"]
    r = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token}, timeout=30)
    r.raise_for_status()
    return r.json()


def ensure_profiles(bt: str, ct: str):
    requests.post(f"{API}/auth/complete-profile", headers=headers(bt), json={"name": "Nearshop Biz", "role": "business"}, timeout=30)
    requests.post(f"{API}/auth/complete-profile", headers=headers(ct), json={"name": "Nearshop Cust", "role": "customer"}, timeout=30)


def main() -> int:
    biz = firebase_signin_to_api(BIZ_EMAIL)
    cust = firebase_signin_to_api(CUST_EMAIL)
    bt = biz["access_token"]
    ct = cust["access_token"]

    ensure_profiles(bt, ct)

    bt = firebase_signin_to_api(BIZ_EMAIL)["access_token"]
    ct = firebase_signin_to_api(CUST_EMAIL)["access_token"]

    my_shops = requests.get(f"{API}/shops/mine", headers=headers(bt), timeout=30)
    my_shops.raise_for_status()
    shops = my_shops.json()
    if not shops:
        raise RuntimeError("Business has no shops")
    shop_id = shops[0]["id"]

    # Ensure customer is follower so this reflects real UI path behavior.
    requests.post(f"{API}/shops/{shop_id}/follow", headers=headers(ct), timeout=30)

    customer_id = cust["user"]["id"]

    start = requests.post(
        f"{API}/messaging/conversations/business",
        headers=headers(bt),
        json={"customer_id": customer_id, "shop_id": shop_id, "initial_message": "Hi from business followers screen"},
        timeout=30,
    )

    print(f"business start conversation status={start.status_code}")
    if start.status_code != 200:
        print(start.text[:500])
        return 1

    conv = start.json()
    conv_id = conv["id"]
    print(f"conversation_id={conv_id}")

    detail = requests.get(f"{API}/messaging/conversations/{conv_id}", headers=headers(bt), timeout=30)
    print(f"business conversation detail status={detail.status_code}")
    if detail.status_code != 200:
        print(detail.text[:500])
        return 1

    messages = detail.json().get("messages", [])
    found = any((m.get("content") or "") == "Hi from business followers screen" for m in messages)
    print(f"initial_message_present={found}")
    return 0 if found else 2


if __name__ == "__main__":
    raise SystemExit(main())
