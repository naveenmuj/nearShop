"""
Focused messaging verification against hosted API.

Covers:
1) customer -> business conversation creation
2) business inbox receives the conversation
3) business reply visible to customer
4) attachment upload + message send + retrieval
5) pagination contract (limit/before_id/messages_has_more/messages_next_before_id)

Usage:
  d:/Local_shop/.venv/Scripts/python.exe nearshop-api/scripts/verify_messaging_flow_hosted.py
  d:/Local_shop/.venv/Scripts/python.exe nearshop-api/scripts/verify_messaging_flow_hosted.py http://165.232.182.130/api/v1
"""

from __future__ import annotations

import base64
import json
import os
import sys
from typing import Any

import requests

API = sys.argv[1] if len(sys.argv) > 1 else "http://165.232.182.130/api/v1"
BIZ_EMAIL = "naveen.kumar3610+2@gmail.com"
CUST_EMAIL = "naveen.kumar3610+3@gmail.com"
PASSWORD = "123456"

PASSED = 0
FAILED = 0
FAILURES: list[str] = []


def ok(name: str, condition: bool, detail: str = "") -> bool:
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"[PASS] {name}")
        return True
    FAILED += 1
    msg = f"{name}{(' - ' + detail) if detail else ''}"
    FAILURES.append(msg)
    print(f"[FAIL] {msg}")
    return False


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def get_firebase_api_key() -> str | None:
    gs = os.path.join(os.path.dirname(__file__), "..", "..", "nearshop-mobile", "android", "app", "google-services.json")
    if not os.path.exists(gs):
        return None
    with open(gs, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    for client in data.get("client", []):
        for key in client.get("api_key", []):
            if key.get("current_key"):
                return key["current_key"]
    return None


def ensure_firebase_users() -> None:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials

    service_account = os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json")
    try:
        firebase_admin.get_app()
    except Exception:
        firebase_admin.initialize_app(credentials.Certificate(service_account))

    for email, display_name in [(BIZ_EMAIL, "Nearshop Biz"), (CUST_EMAIL, "Nearshop Cust")]:
        try:
            user = fb_auth.get_user_by_email(email)
            fb_auth.delete_user(user.uid)
            print(f"Deleted Firebase user: {email}")
        except Exception:
            pass
        fb_auth.create_user(email=email, password=PASSWORD, display_name=display_name)
        print(f"Created Firebase user: {email}")


def firebase_signin_to_api(email: str) -> dict[str, Any]:
    api_key = get_firebase_api_key()
    if not api_key:
        raise RuntimeError("Firebase API key not found in nearshop-mobile/android/app/google-services.json")

    firebase_resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={"email": email, "password": PASSWORD, "returnSecureToken": True},
        timeout=30,
    )
    firebase_resp.raise_for_status()
    id_token = firebase_resp.json()["idToken"]

    api_resp = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token}, timeout=30)
    api_resp.raise_for_status()
    return api_resp.json()


def ensure_shop_for_business(bt: str) -> str:
    mine = requests.get(f"{API}/shops/mine", headers=auth_headers(bt), timeout=30)
    mine.raise_for_status()
    shops = mine.json()
    if shops:
        return shops[0]["id"]

    payload = {
        "name": "Messaging Verify Shop",
        "description": "Shop for messaging verification",
        "category": "Electronics",
        "phone": "9876543210",
        "address": "100 MG Road, Bangalore",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "delivery_options": ["pickup", "delivery"],
        "delivery_radius": 5,
        "delivery_fee": 30,
        "free_delivery_above": 500,
        "min_order": 100,
    }
    create = requests.post(f"{API}/shops", headers=auth_headers(bt), json=payload, timeout=30)
    create.raise_for_status()
    return create.json()["id"]


def upload_test_image(token: str) -> str:
    # 1x1 png
    png_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnL2v4AAAAASUVORK5CYII="
    )
    files = {"file": ("chat-test.png", png_data, "image/png")}
    data = {"folder": "chat", "purpose": "messaging"}
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{API}/upload", headers=headers, files=files, data=data, timeout=30)
    resp.raise_for_status()
    body = resp.json()
    return body.get("url") or body.get("file_url")


def main() -> int:
    print(f"Running focused messaging verification on: {API}")

    health = requests.get(f"{API}/health", timeout=20)
    ok("health endpoint", health.status_code == 200, f"status={health.status_code}")
    if health.status_code != 200:
        return 1

    ensure_firebase_users()

    biz = firebase_signin_to_api(BIZ_EMAIL)
    cust = firebase_signin_to_api(CUST_EMAIL)
    bt = biz["access_token"]
    ct = cust["access_token"]

    prof_b = requests.post(
        f"{API}/auth/complete-profile",
        headers=auth_headers(bt),
        json={"name": "Nearshop Biz", "role": "business", "interests": ["Electronics"]},
        timeout=30,
    )
    ok("business complete-profile", prof_b.status_code in (200, 201), str(prof_b.status_code))

    # Re-sign in to ensure token role alignment after profile update.
    bt = firebase_signin_to_api(BIZ_EMAIL)["access_token"]

    prof_c = requests.post(
        f"{API}/auth/complete-profile",
        headers=auth_headers(ct),
        json={"name": "Nearshop Cust", "role": "customer", "interests": ["Electronics"]},
        timeout=30,
    )
    ok("customer complete-profile", prof_c.status_code in (200, 201), str(prof_c.status_code))

    # Re-sign in to ensure token role alignment after profile update.
    ct = firebase_signin_to_api(CUST_EMAIL)["access_token"]

    biz_me = requests.get(f"{API}/auth/me", headers=auth_headers(bt), timeout=30)
    cust_me = requests.get(f"{API}/auth/me", headers=auth_headers(ct), timeout=30)
    ok("business auth/me", biz_me.status_code == 200, biz_me.text[:120])
    ok("customer auth/me", cust_me.status_code == 200, cust_me.text[:120])
    if biz_me.status_code == 200:
        ok("business active role is business", biz_me.json().get("active_role") == "business", str(biz_me.json().get("active_role")))
    if cust_me.status_code == 200:
        ok("customer active role is customer", cust_me.json().get("active_role") == "customer", str(cust_me.json().get("active_role")))

    shop_id = ensure_shop_for_business(bt)
    ok("business has shop", bool(shop_id), "shop missing")

    create_conv = requests.post(
        f"{API}/messaging/conversations",
        headers=auth_headers(ct),
        json={"shop_id": shop_id, "initial_message": "Hello from customer - initial"},
        timeout=30,
    )
    created_with_initial = create_conv.status_code == 200
    ok("customer creates conversation with initial_message", created_with_initial, create_conv.text[:120])
    if not created_with_initial:
        create_conv = requests.post(
            f"{API}/messaging/conversations",
            headers=auth_headers(ct),
            json={"shop_id": shop_id},
            timeout=30,
        )
        ok("customer creates conversation without initial_message", create_conv.status_code == 200, create_conv.text[:120])
        if create_conv.status_code != 200:
            return 1

    conv_id = create_conv.json()["id"]

    if not created_with_initial:
        first_msg = requests.post(
            f"{API}/messaging/conversations/{conv_id}/messages",
            headers=auth_headers(ct),
            json={"content": "Hello from customer - first message", "message_type": "text"},
            timeout=30,
        )
        ok("customer sends first text after conversation create", first_msg.status_code == 200, first_msg.text[:120])

    list_biz = requests.get(f"{API}/messaging/conversations?limit=20&offset=0", headers=auth_headers(bt), timeout=30)
    ok("business list conversations", list_biz.status_code == 200, list_biz.text[:120])
    biz_items = list_biz.json().get("items", []) if list_biz.status_code == 200 else []
    ok("business sees customer conversation", any(i.get("id") == conv_id for i in biz_items), "conversation not in business inbox")

    get_biz_conv = requests.get(
        f"{API}/messaging/conversations/{conv_id}?limit=2",
        headers=auth_headers(bt),
        timeout=30,
    )
    ok("business get conversation", get_biz_conv.status_code == 200, get_biz_conv.text[:120])

    reply = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(bt),
        json={"content": "Hello customer - business reply", "message_type": "text"},
        timeout=30,
    )
    ok("business reply message", reply.status_code == 200, reply.text[:120])

    image_url = upload_test_image(ct)
    ok("customer upload attachment", bool(image_url), "no uploaded image url")

    send_attachment = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(ct),
        json={"content": "Please see attached", "message_type": "image", "attachments": [image_url]},
        timeout=30,
    )
    ok("customer send attachment message", send_attachment.status_code == 200, send_attachment.text[:120])

    for i in range(5):
        extra = requests.post(
            f"{API}/messaging/conversations/{conv_id}/messages",
            headers=auth_headers(ct),
            json={"content": f"pagination-msg-{i+1}", "message_type": "text"},
            timeout=30,
        )
        ok(f"customer sends pagination message {i+1}", extra.status_code == 200, extra.text[:120])

    cust_view_latest = requests.get(
        f"{API}/messaging/conversations/{conv_id}?limit=3",
        headers=auth_headers(ct),
        timeout=30,
    )
    ok("customer get conversation limit=3", cust_view_latest.status_code == 200, cust_view_latest.text[:120])

    if cust_view_latest.status_code == 200:
        body = cust_view_latest.json()
        messages = body.get("messages", [])
        ok("pagination returns <= limit messages", len(messages) <= 3, f"count={len(messages)}")
        has_more = bool(body.get("messages_has_more"))
        next_before_id = body.get("messages_next_before_id")
        ok("pagination has_more true", has_more, f"has_more={has_more}")
        ok("pagination next_before_id present", bool(next_before_id), f"next_before_id={next_before_id}")

        if next_before_id:
            older = requests.get(
                f"{API}/messaging/conversations/{conv_id}?limit=3&before_id={next_before_id}",
                headers=auth_headers(ct),
                timeout=30,
            )
            ok("customer get older messages page", older.status_code == 200, older.text[:120])
            if older.status_code == 200:
                older_msgs = older.json().get("messages", [])
                ok("older page has messages", len(older_msgs) > 0, "no older messages")

    biz_view = requests.get(f"{API}/messaging/conversations/{conv_id}?limit=50", headers=auth_headers(bt), timeout=30)
    ok("business fetch final conversation", biz_view.status_code == 200, biz_view.text[:120])
    if biz_view.status_code == 200:
        all_msgs = biz_view.json().get("messages", [])
        has_reply = any((m.get("content") or "") == "Hello customer - business reply" for m in all_msgs)
        has_attachment = any((m.get("attachments") or []) for m in all_msgs)
        ok("business sees its own reply in thread", has_reply, "reply missing")
        ok("business sees customer attachment in thread", has_attachment, "attachment missing")

    print("\n" + "=" * 60)
    print(f"RESULT: {PASSED} passed, {FAILED} failed")
    if FAILURES:
        print("Failures:")
        for f in FAILURES:
            print(f" - {f}")
    print("=" * 60)

    return 0 if FAILED == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
