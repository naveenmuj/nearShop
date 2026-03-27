"""Run a broader live API regression pass against the local backend."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
import requests
from dotenv import load_dotenv
from jose import jwt


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT.parent / "docs" / "live_api_regression_report.json"


def load_settings() -> dict[str, str]:
    load_dotenv(ROOT / ".env")
    return {
        "base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8010/api/v1").rstrip("/"),
        "database_url": os.environ["DATABASE_URL"],
        "jwt_secret": os.environ["JWT_SECRET_KEY"],
        "jwt_algorithm": os.getenv("JWT_ALGORITHM", "HS256"),
    }


def db_connect(database_url: str):
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://").replace("ssl=require", "sslmode=require")
    return psycopg2.connect(dsn)


def build_token(user_id: str, secret: str, algorithm: str, role: str | None = None) -> str:
    payload: dict[str, Any] = {
        "sub": user_id,
        "type": "access",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
    }
    if role:
        payload["role"] = role
    return jwt.encode(payload, secret, algorithm=algorithm)


def sample_entities(conn) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("select id::text from users order by created_at asc limit 1")
        user_id = cur.fetchone()[0]

        cur.execute(
            """
            select s.id::text, s.latitude, s.longitude
            from shops s
            where s.is_active = true
            order by s.created_at asc
            limit 1
            """
        )
        shop_id, shop_lat, shop_lng = cur.fetchone()

        cur.execute(
            """
            select p.id::text
            from products p
            where p.shop_id = %s::uuid
            order by p.created_at desc nulls last
            limit 1
            """,
            (shop_id,),
        )
        product_id = cur.fetchone()[0]
    return {
        "user_id": user_id,
        "shop_id": shop_id,
        "shop_lat": float(shop_lat or 12.935),
        "shop_lng": float(shop_lng or 77.624),
        "product_id": product_id,
    }


def call_json(session: requests.Session, method: str, url: str, **kwargs):
    response = session.request(method, url, timeout=60, **kwargs)
    try:
        body = response.json()
    except Exception:
        body = response.text[:500]
    return response, body


def body_has_items(body: Any, key: str) -> bool:
    value = body.get(key) if isinstance(body, dict) else None
    return isinstance(value, list) and len(value) >= 0


def main() -> None:
    settings = load_settings()
    conn = db_connect(settings["database_url"])
    entities = sample_entities(conn)
    customer_token = build_token(entities["user_id"], settings["jwt_secret"], settings["jwt_algorithm"], role="customer")
    business_token = build_token(entities["user_id"], settings["jwt_secret"], settings["jwt_algorithm"], role="business")
    session = requests.Session()

    report: dict[str, Any] = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "base_url": settings["base_url"],
        "entities": entities,
        "checks": [],
        "summary": {"passed": 0, "failed": 0},
    }

    def add(name: str, passed: bool, response: requests.Response | None = None, body: Any = None, note: str | None = None):
        item = {"name": name, "passed": passed}
        if response is not None:
            item["status_code"] = response.status_code
        if body is not None:
            if isinstance(body, dict):
                item["body_keys"] = list(body.keys())[:12]
            else:
                item["body_preview"] = str(body)[:300]
        if note:
            item["note"] = note
        report["checks"].append(item)
        report["summary"]["passed" if passed else "failed"] += 1

    lat = entities["shop_lat"]
    lng = entities["shop_lng"]
    shop_id = entities["shop_id"]

    checks = [
        ("health", "GET", f"{settings['base_url']}/health", {}, lambda r, b: r.status_code == 200),
        ("features", "GET", f"{settings['base_url']}/features", {}, lambda r, b: r.status_code == 200),
        ("auth_me_customer", "GET", f"{settings['base_url']}/auth/me", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict) and b.get("id") == entities["user_id"]),
        ("search_history", "GET", f"{settings['base_url']}/search/history?limit=5", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict) and "history" in b),
        ("recently_viewed", "GET", f"{settings['base_url']}/users/recently-viewed?limit=20", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, (list, dict))),
        ("feed_home", "GET", f"{settings['base_url']}/feed/home?lat={lat}&lng={lng}&page=1&per_page=20", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("feed_hook", "GET", f"{settings['base_url']}/feed/hook?lat={lat}&lng={lng}", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("products_search", "GET", f"{settings['base_url']}/products/search?q=iphone", {}, lambda r, b: r.status_code == 200 and isinstance(b, dict) and "items" in b),
        ("search_suggestions", "GET", f"{settings['base_url']}/search/suggestions?q=air&lat={lat}&lng={lng}", {}, lambda r, b: r.status_code == 200 and isinstance(b, dict) and "suggestions" in b),
        ("search_unified", "GET", f"{settings['base_url']}/search/unified?q=electronics&lat={lat}&lng={lng}", {}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("shops_nearby", "GET", f"{settings['base_url']}/shops/nearby?lat={lat}&lng={lng}&radius_km=5", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("deals_nearby", "GET", f"{settings['base_url']}/deals/nearby?lat={lat}&lng={lng}", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("ai_trending", "GET", f"{settings['base_url']}/ai/trending?lat={lat}&lng={lng}&limit=10", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("ai_recommendations", "GET", f"{settings['base_url']}/ai/recommendations?lat={lat}&lng={lng}&limit=10", {"headers": {"Authorization": f"Bearer {customer_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("analytics_stats", "GET", f"{settings['base_url']}/analytics/shop/{shop_id}/stats?period=30d", {"headers": {"Authorization": f"Bearer {business_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
        ("analytics_products", "GET", f"{settings['base_url']}/analytics/shop/{shop_id}/products", {"headers": {"Authorization": f"Bearer {business_token}"}}, lambda r, b: r.status_code == 200),
        ("analytics_demand", "GET", f"{settings['base_url']}/analytics/shop/{shop_id}/demand?lat={lat}&lng={lng}", {"headers": {"Authorization": f"Bearer {business_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, (list, dict))),
        ("analytics_operational_insights", "GET", f"{settings['base_url']}/analytics/shop/{shop_id}/operational-insights?lat={lat}&lng={lng}", {"headers": {"Authorization": f"Bearer {business_token}"}}, lambda r, b: r.status_code == 200 and isinstance(b, dict)),
    ]

    for name, method, url, kwargs, validator in checks:
        response, body = call_json(session, method, url, **kwargs)
        add(name, validator(response, body), response, body)

    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    main()
