"""Run an end-to-end API smoke test for media storage and retrieval."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv
from jose import jwt
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT.parent / "docs" / "storage_api_smoke_report.json"


def load_settings() -> dict[str, str]:
    load_dotenv(ROOT / ".env")
    return {
        "base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8010/api/v1").rstrip("/"),
        "database_url": os.environ["DATABASE_URL"],
        "jwt_secret": os.environ["JWT_SECRET_KEY"],
        "jwt_algorithm": os.getenv("JWT_ALGORITHM", "HS256"),
        "bucket_public_base": os.environ["DO_SPACES_CDN_ENDPOINT"].rstrip("/"),
    }


def db_connect(database_url: str):
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://").replace("ssl=require", "sslmode=require")
    return psycopg2.connect(dsn)


def build_token(user_id: str, secret: str, algorithm: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def build_test_image_bytes(label: str) -> bytes:
    image = Image.new("RGB", (640, 640), "#f8fafc")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((24, 24, 616, 616), radius=48, fill="#ffffff", outline="#cbd5e1", width=4)
    draw.rounded_rectangle((64, 64, 576, 248), radius=32, fill="#0ea5e9")
    draw.text((110, 120), "NearShop", fill="#ffffff")
    draw.text((110, 180), label[:36], fill="#e0f2fe")
    draw.text((110, 340), "Storage smoke test", fill="#111827")
    draw.text((110, 390), "DigitalOcean Spaces", fill="#6b7280")
    import io
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=90)
    return out.getvalue()


def fetch_sample_entities(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("select id::text from users order by created_at asc limit 1")
        user_id = cur.fetchone()[0]
        cur.execute(
            """
            select p.id::text, p.shop_id::text
            from products p
            where p.shop_id is not null
            order by p.created_at desc nulls last
            limit 1
            """
        )
        product_id, shop_id = cur.fetchone()
        cur.execute(
            """
            select images[1]
            from products
            where images is not null and array_length(images, 1) > 0
            order by created_at desc nulls last
            limit 1
            """
        )
        product_image = cur.fetchone()[0]
    return {
        "user_id": user_id,
        "product_id": product_id,
        "shop_id": shop_id,
        "product_image": product_image,
    }


def call_json(session: requests.Session, method: str, url: str, **kwargs):
    response = session.request(method, url, timeout=60, **kwargs)
    payload = None
    try:
        payload = response.json()
    except Exception:
        payload = response.text[:500]
    return response, payload


def main() -> None:
    settings = load_settings()
    conn = db_connect(settings["database_url"])
    entities = fetch_sample_entities(conn)
    token = build_token(entities["user_id"], settings["jwt_secret"], settings["jwt_algorithm"])

    session = requests.Session()
    auth_headers = {"Authorization": f"Bearer {token}"}
    report: dict[str, object] = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "base_url": settings["base_url"],
        "bucket_public_base": settings["bucket_public_base"],
        "entities": entities,
        "checks": [],
        "summary": {"passed": 0, "failed": 0},
    }

    def add_check(name: str, passed: bool, details: dict):
        report["checks"].append({"name": name, "passed": passed, **details})
        report["summary"]["passed" if passed else "failed"] += 1

    r, payload = call_json(session, "GET", f"{settings['base_url']}/health")
    add_check("health", r.status_code == 200, {"status_code": r.status_code, "body": payload})

    r, payload = call_json(session, "GET", f"{settings['base_url']}/features")
    add_check("features", r.status_code == 200, {"status_code": r.status_code, "body": payload})

    r, payload = call_json(session, "GET", f"{settings['base_url']}/auth/me", headers=auth_headers)
    add_check("auth_me", r.status_code == 200 and payload.get("id") == entities["user_id"], {"status_code": r.status_code, "body": payload})

    r, payload = call_json(session, "GET", f"{settings['base_url']}/products/search?q=iphone")
    image_urls = []
    if isinstance(payload, dict) and payload.get("items"):
        image_urls = payload["items"][0].get("images") or []
    add_check(
        "products_search",
        r.status_code == 200 and bool(image_urls) and str(image_urls[0]).startswith(settings["bucket_public_base"] + "/"),
        {"status_code": r.status_code, "sample_images": image_urls[:2], "body_keys": list(payload.keys()) if isinstance(payload, dict) else None},
    )

    direct_image_url = entities["product_image"]
    direct_image_response = session.get(direct_image_url, timeout=60)
    add_check(
        "fetch_existing_bucket_image",
        direct_image_response.status_code == 200 and direct_image_response.headers.get("Content-Type", "").startswith("image/"),
        {
            "status_code": direct_image_response.status_code,
            "content_type": direct_image_response.headers.get("Content-Type"),
            "url": direct_image_url,
            "size_bytes": len(direct_image_response.content),
        },
    )

    files = {"file": ("storage-smoke-user.jpg", build_test_image_bytes("User avatar upload"), "image/jpeg")}
    data = {
        "folder": "avatars",
        "entity_type": "user",
        "entity_id": entities["user_id"],
        "purpose": "avatar",
    }
    r, payload = call_json(session, "POST", f"{settings['base_url']}/upload", headers=auth_headers, files=files, data=data)
    uploaded_user_url = payload.get("url") if isinstance(payload, dict) else None
    add_check(
        "upload_user_avatar",
        r.status_code == 200 and payload.get("provider") == "digitalocean_spaces" and str(uploaded_user_url).startswith(settings["bucket_public_base"] + "/"),
        {"status_code": r.status_code, "body": payload},
    )

    if uploaded_user_url:
        uploaded_response = session.get(uploaded_user_url, timeout=60)
        add_check(
            "fetch_uploaded_user_avatar",
            uploaded_response.status_code == 200 and uploaded_response.headers.get("Content-Type", "").startswith("image/"),
            {
                "status_code": uploaded_response.status_code,
                "content_type": uploaded_response.headers.get("Content-Type"),
                "url": uploaded_user_url,
                "size_bytes": len(uploaded_response.content),
            },
        )

    files = {"file": ("storage-smoke-product.jpg", build_test_image_bytes("Product image upload"), "image/jpeg")}
    data = {
        "folder": "products",
        "entity_type": "product",
        "entity_id": entities["product_id"],
        "purpose": "image",
        "shop_id": entities["shop_id"],
        "product_id": entities["product_id"],
    }
    r, payload = call_json(session, "POST", f"{settings['base_url']}/upload", headers=auth_headers, files=files, data=data)
    uploaded_product_url = payload.get("url") if isinstance(payload, dict) else None
    add_check(
        "upload_product_image",
        r.status_code == 200 and payload.get("provider") == "digitalocean_spaces" and str(uploaded_product_url).startswith(settings["bucket_public_base"] + "/"),
        {"status_code": r.status_code, "body": payload},
    )

    if uploaded_product_url:
        uploaded_response = session.get(uploaded_product_url, timeout=60)
        add_check(
            "fetch_uploaded_product_image",
            uploaded_response.status_code == 200 and uploaded_response.headers.get("Content-Type", "").startswith("image/"),
            {
                "status_code": uploaded_response.status_code,
                "content_type": uploaded_response.headers.get("Content-Type"),
                "url": uploaded_product_url,
                "size_bytes": len(uploaded_response.content),
            },
        )

    with conn.cursor() as cur:
        cur.execute("select count(*) from users where avatar_url like %s", (settings["bucket_public_base"] + "/%",))
        users_spaces = cur.fetchone()[0]
        cur.execute(
            """
            select count(*)
            from products
            where exists (
                select 1 from unnest(images) v
                where v like %s
            )
            """,
            (settings["bucket_public_base"] + "/%",),
        )
        products_spaces = cur.fetchone()[0]
        cur.execute(
            """
            select count(*)
            from products
            where exists (
                select 1 from unnest(images) v
                where v like '/static/uploads/%'
                   or v like 'http://example.com%%'
                   or v like 'https://example.com%%'
            )
            """
        )
        products_legacy = cur.fetchone()[0]

    add_check(
        "database_media_references",
        users_spaces >= 1 and products_spaces >= 1 and products_legacy == 0,
        {
            "users_spaces": users_spaces,
            "products_spaces": products_spaces,
            "products_legacy": products_legacy,
        },
    )

    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    main()
