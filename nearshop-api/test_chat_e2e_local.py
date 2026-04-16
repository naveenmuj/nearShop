import asyncio
import json
import os
from uuid import UUID

import httpx
import websockets
from sqlalchemy import select

import app.products.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.stories.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.delivery.models  # noqa: F401
import app.shops.models  # noqa: F401
import app.messaging.models  # noqa: F401
from app.auth.models import User
from app.core.database import async_session_factory
from app.core.security import create_access_token

BASE_URL = os.getenv("NEARSHOP_BASE_URL", "http://127.0.0.1:8000/api/v1")
WS_BASE = os.getenv("NEARSHOP_WS_BASE", "ws://127.0.0.1:8000/api/v1")

CUSTOMER_ID = UUID("11111111-1111-1111-1111-111111111111")
BUSINESS_ID = UUID("22222222-2222-2222-2222-222222222222")


def report(step: str, ok: bool, detail: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {step}: {detail}")


async def ensure_user(user_id: UUID, name: str, role: str, phone: str) -> None:
    async with async_session_factory() as db:
        existing = await db.execute(select(User).where(User.id == user_id))
        user = existing.scalar_one_or_none()
        roles = ["customer", "business"]
        if user is None:
            user = User(
                id=user_id,
                name=name,
                phone=phone,
                active_role=role,
                roles=roles,
                is_active=True,
            )
            db.add(user)
        else:
            user.name = name
            user.phone = phone
            user.active_role = role
            user.roles = roles
            user.is_active = True
        await db.commit()


async def main() -> None:
    await ensure_user(CUSTOMER_ID, "E2E Customer", "customer", "+919900000001")
    await ensure_user(BUSINESS_ID, "E2E Business", "business", "+919900000002")

    customer_token = create_access_token({"sub": str(CUSTOMER_ID), "role": "customer"})
    business_token = create_access_token({"sub": str(BUSINESS_ID), "role": "business"})

    h_cust = {"Authorization": f"Bearer {customer_token}"}
    h_biz = {"Authorization": f"Bearer {business_token}"}

    conversation_id = None
    shop_id = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{BASE_URL}/health")
        report("Health endpoint", r.status_code == 200, f"status={r.status_code}, body={r.text}")
        if r.status_code != 200:
            return

        shop_payload = {
            "name": "E2E Shop",
            "description": "E2E test shop",
            "category": "Grocery",
            "address": "123 Test Street",
            "latitude": 12.9716,
            "longitude": 77.5946,
        }
        r = await client.post(f"{BASE_URL}/shops", json=shop_payload, headers=h_biz)
        report("Create shop", r.status_code in (200, 201), f"status={r.status_code}, body={r.text[:220]}")
        if r.status_code not in (200, 201):
            return
        shop_id = r.json()["id"]

        conv_payload = {
            "shop_id": shop_id,
            "initial_message": "Hi shop, do you have this in stock?",
        }
        r = await client.post(f"{BASE_URL}/messaging/conversations", json=conv_payload, headers=h_cust)
        report("Customer starts conversation", r.status_code in (200, 201), f"status={r.status_code}, body={r.text[:220]}")
        if r.status_code not in (200, 201):
            return
        conversation_id = r.json()["id"]

        r = await client.get(f"{BASE_URL}/messaging/conversations", headers=h_biz)
        ok = r.status_code == 200 and any(item["id"] == conversation_id for item in r.json().get("items", []))
        report("Business sees conversation in list", ok, f"status={r.status_code}, total={len(r.json().get('items', [])) if r.status_code == 200 else 'n/a'}")

        r = await client.get(f"{BASE_URL}/messaging/conversations/{conversation_id}", headers=h_biz)
        has_initial = False
        if r.status_code == 200:
            msgs = r.json().get("messages", [])
            has_initial = any((m.get("content") or "").startswith("Hi shop") for m in msgs)
        report("Business sees initial customer message", r.status_code == 200 and has_initial, f"status={r.status_code}, messages={(len(r.json().get('messages', [])) if r.status_code == 200 else 'n/a')}")

        reply_payload = {"content": "Yes, it is available.", "message_type": "text"}
        r = await client.post(f"{BASE_URL}/messaging/conversations/{conversation_id}/messages", json=reply_payload, headers=h_biz)
        report("Business replies", r.status_code in (200, 201), f"status={r.status_code}, body={r.text[:220]}")

        r = await client.get(f"{BASE_URL}/messaging/conversations/{conversation_id}", headers=h_cust)
        has_reply = False
        if r.status_code == 200:
            msgs = r.json().get("messages", [])
            has_reply = any((m.get("content") or "") == "Yes, it is available." for m in msgs)
        report("Customer sees business reply", r.status_code == 200 and has_reply, f"status={r.status_code}, messages={(len(r.json().get('messages', [])) if r.status_code == 200 else 'n/a')}")

        r1 = await client.post(f"{BASE_URL}/messaging/conversations/{conversation_id}/read", headers=h_cust)
        r2 = await client.post(f"{BASE_URL}/messaging/conversations/{conversation_id}/read", headers=h_biz)
        report("Mark read by both roles", r1.status_code == 200 and r2.status_code == 200, f"customer={r1.status_code}, business={r2.status_code}")

        assign_payload = {"assigned_to_user_id": str(BUSINESS_ID)}
        r = await client.post(f"{BASE_URL}/messaging/conversations/{conversation_id}/assign", json=assign_payload, headers=h_biz)
        assignee = None
        if r.status_code == 200:
            assignee = r.json().get("assigned_staff_name")
        # We only require that the assignment resolves to assignee user display, not caller leakage.
        name_ok = assignee is not None and assignee != "Unassigned"
        report("Assign conversation returns assignee name", r.status_code == 200 and name_ok, f"status={r.status_code}, assigned_staff_name={assignee}")

    # WebSocket broadcast test for messaging
    ws_ok = False
    ws_detail = "not attempted"
    if conversation_id is not None:
        ws_c = f"{WS_BASE}/messaging/ws/{conversation_id}?token={customer_token}"
        ws_b = f"{WS_BASE}/messaging/ws/{conversation_id}?token={business_token}"
        try:
            async with websockets.connect(ws_c) as cws, websockets.connect(ws_b) as bws:
                # send from customer side
                await cws.send(json.dumps({"type": "message", "content": "ws-ping-from-customer", "message_type": "text"}))
                # read a few frames from business side and look for the customer message broadcast
                got = False
                for _ in range(5):
                    msg = await asyncio.wait_for(bws.recv(), timeout=3)
                    data = json.loads(msg)
                    if (
                        data.get("type") == "new_message"
                        and (data.get("message") or {}).get("content") == "ws-ping-from-customer"
                    ):
                        got = True
                        break
                ws_ok = got
                ws_detail = "broadcast received" if got else "connected but no expected broadcast"
        except Exception as exc:
            ws_ok = False
            ws_detail = f"websocket error: {type(exc).__name__}: {exc}"

    report("Messaging WebSocket broadcast", ws_ok, ws_detail)

    # Haggle endpoint smoke (auth + route existence)
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{BASE_URL}/haggle/my", headers=h_cust)
        report("Haggle authenticated list endpoint", r.status_code == 200, f"status={r.status_code}, body={r.text[:220]}")


if __name__ == "__main__":
    asyncio.run(main())
