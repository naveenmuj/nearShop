"""
Extended messaging verification for WhatsApp-like features.

Covers:
1) image/pdf/audio uploads + message send
2) reply metadata flow
3) reactions add/remove
4) search API
5) presence API
6) edge cases (unsupported upload type, empty message, invalid reply target)

Usage:
  d:/Local_shop/.venv/Scripts/python.exe nearshop-api/scripts/verify_messaging_whatsapp_features_hosted.py
  d:/Local_shop/.venv/Scripts/python.exe nearshop-api/scripts/verify_messaging_whatsapp_features_hosted.py http://165.232.182.130/api/v1
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
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
        except Exception:
            pass
        fb_auth.create_user(email=email, password=PASSWORD, display_name=display_name)


def firebase_signin_to_api(email: str) -> dict[str, Any]:
    api_key = get_firebase_api_key()
    if not api_key:
        raise RuntimeError("Firebase API key not found in nearshop-mobile/android/app/google-services.json")

    last_exc: Exception | None = None
    for _ in range(5):
        firebase_resp = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
            json={"email": email, "password": PASSWORD, "returnSecureToken": True},
            timeout=30,
        )
        firebase_resp.raise_for_status()
        id_token = firebase_resp.json()["idToken"]

        api_resp = requests.post(f"{API}/auth/firebase-signin", json={"firebase_token": id_token}, timeout=30)
        if api_resp.status_code == 200:
            return api_resp.json()

        detail = api_resp.text
        if "Token used too early" in detail:
            time.sleep(1.1)
            continue

        last_exc = RuntimeError(api_resp.text)
    if last_exc:
        raise last_exc
    raise RuntimeError("firebase_signin_to_api failed unexpectedly")


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


def upload_bytes(token: str, filename: str, content: bytes, content_type: str, purpose: str = "messaging") -> dict[str, Any]:
    files = {"file": (filename, content, content_type)}
    data = {"folder": "chat", "purpose": purpose}
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{API}/upload", headers=headers, files=files, data=data, timeout=30)
    return {"status": resp.status_code, "body": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text}


def main() -> int:
    print(f"Running WhatsApp-style messaging verification on: {API}")

    health = requests.get(f"{API}/health", timeout=20)
    ok("health endpoint", health.status_code == 200, f"status={health.status_code}")
    if health.status_code != 200:
        return 1

    ensure_firebase_users()

    biz = firebase_signin_to_api(BIZ_EMAIL)
    cust = firebase_signin_to_api(CUST_EMAIL)
    bt = biz["access_token"]
    ct = cust["access_token"]

    requests.post(
        f"{API}/auth/complete-profile",
        headers=auth_headers(bt),
        json={"name": "Nearshop Biz", "role": "business", "interests": ["Electronics"]},
        timeout=30,
    )
    requests.post(
        f"{API}/auth/complete-profile",
        headers=auth_headers(ct),
        json={"name": "Nearshop Cust", "role": "customer", "interests": ["Electronics"]},
        timeout=30,
    )

    bt = firebase_signin_to_api(BIZ_EMAIL)["access_token"]
    ct = firebase_signin_to_api(CUST_EMAIL)["access_token"]

    shop_id = ensure_shop_for_business(bt)
    ok("business has shop", bool(shop_id), "shop missing")

    create_conv = requests.post(
        f"{API}/messaging/conversations",
        headers=auth_headers(ct),
        json={"shop_id": shop_id, "initial_message": "Hello from customer - whatsapp feature test"},
        timeout=30,
    )
    ok("create conversation", create_conv.status_code == 200, create_conv.text[:140])
    if create_conv.status_code != 200:
        return 1
    conv_id = create_conv.json()["id"]

    # Upload image
    img_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnL2v4AAAAASUVORK5CYII=")
    img_upload = upload_bytes(ct, "chat-test.png", img_bytes, "image/png", purpose="media")
    ok("upload image", img_upload["status"] == 200, str(img_upload["body"]))
    img_url = img_upload["body"].get("url") if img_upload["status"] == 200 else None

    # Upload document
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    doc_upload = upload_bytes(ct, "chat-test.pdf", pdf_bytes, "application/pdf", purpose="document")
    ok("upload document", doc_upload["status"] == 200, str(doc_upload["body"]))
    doc_url = doc_upload["body"].get("url") if doc_upload["status"] == 200 else None

    # Upload audio
    audio_bytes = b"RIFF\x24\x00\x00\x00WAVEfmt "
    audio_upload = upload_bytes(ct, "voice-note.wav", audio_bytes, "audio/wav", purpose="media")
    ok("upload audio", audio_upload["status"] == 200, str(audio_upload["body"]))
    audio_url = audio_upload["body"].get("url") if audio_upload["status"] == 200 else None

    # Where files are stored (provider check)
    if img_upload["status"] == 200:
        provider = img_upload["body"].get("provider")
        ok("upload returns provider", provider in {"digitalocean_spaces", "local_filesystem"}, f"provider={provider}")

    # Send image/file/audio messages
    m_img = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(ct),
        json={"content": "image message", "message_type": "image", "attachments": [img_url]},
        timeout=30,
    )
    ok("send image message", m_img.status_code == 200, m_img.text[:140])

    m_doc = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(ct),
        json={"content": "document message", "message_type": "file", "attachments": [doc_url]},
        timeout=30,
    )
    ok("send file message", m_doc.status_code == 200, m_doc.text[:140])

    m_audio = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(ct),
        json={"content": "voice note", "message_type": "audio", "attachments": [audio_url]},
        timeout=30,
    )
    ok("send audio message", m_audio.status_code == 200, m_audio.text[:140])

    # Reply flow
    reply_target_id = m_doc.json().get("id") if m_doc.status_code == 200 else None
    reply = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(bt),
        json={
            "content": "Reply from business",
            "message_type": "text",
            "metadata": {"reply_to_message_id": reply_target_id},
        },
        timeout=30,
    )
    ok("reply with metadata", reply.status_code == 200, reply.text[:140])

    # Reactions add/remove
    reaction_target_id = m_img.json().get("id") if m_img.status_code == 200 else None
    react = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages/{reaction_target_id}/reactions",
        headers=auth_headers(bt),
        json={"emoji": "👍"},
        timeout=30,
    )
    ok("add reaction", react.status_code == 200, react.text[:140])

    unreact = requests.delete(
        f"{API}/messaging/conversations/{conv_id}/messages/{reaction_target_id}/reactions?emoji=%F0%9F%91%8D",
        headers=auth_headers(bt),
        timeout=30,
    )
    ok("remove reaction", unreact.status_code == 200, unreact.text[:140])

    # Search
    search = requests.get(
        f"{API}/messaging/conversations/{conv_id}/messages/search?q=Reply&limit=10",
        headers=auth_headers(ct),
        timeout=30,
    )
    ok("search messages", search.status_code == 200, search.text[:140])
    if search.status_code == 200:
        found = any("Reply" in (m.get("content") or "") for m in search.json())
        ok("search returns matching content", found, "no matching message")

    # Presence
    presence = requests.get(
        f"{API}/messaging/conversations/{conv_id}/presence",
        headers=auth_headers(ct),
        timeout=30,
    )
    ok("presence endpoint", presence.status_code == 200, presence.text[:140])

    # Edge: unsupported upload mime
    bad_upload = upload_bytes(ct, "malicious.bin", b"\x00\x01\x02", "application/octet-stream", purpose="document")
    ok("reject unsupported upload type", bad_upload["status"] in (400, 422), str(bad_upload["body"]))

    # Edge: empty message
    empty_msg = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(ct),
        json={"content": "", "message_type": "text", "attachments": []},
        timeout=30,
    )
    ok("reject empty message", empty_msg.status_code in (400, 422), empty_msg.text[:140])

    # Edge: invalid reply target
    bad_reply = requests.post(
        f"{API}/messaging/conversations/{conv_id}/messages",
        headers=auth_headers(bt),
        json={"content": "invalid reply", "message_type": "text", "metadata": {"reply_to_message_id": "f1f2f3f4-0000-0000-0000-000000000000"}},
        timeout=30,
    )
    ok("reject invalid reply target", bad_reply.status_code in (400, 404), bad_reply.text[:140])

    print("\n" + "=" * 72)
    print(f"RESULT: passed={PASSED} failed={FAILED}")
    if FAILURES:
        print("Failures:")
        for f in FAILURES:
            print(f" - {f}")
    print("=" * 72)

    return 0 if FAILED == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
