import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

import psycopg2
import requests
from jose import jwt


BASE_URL = "http://127.0.0.1:8010"
MAIN_SHOP_ID = "52dc729a-5934-4507-8bf9-5c3aa8ccf873"
REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "ranking_quality_report.json"

PERSONAS = {
    "ml.c1.1774488839@example.com": {
        "expected_terms": {"gaming", "mouse", "keyboard", "headset", "mousepad"},
    },
    "ml.c4@example.com": {
        "expected_terms": {"audio", "earbuds", "speaker", "headphones", "bluetooth"},
    },
    "ml.c5@example.com": {
        "expected_terms": {"streaming", "webcam", "microphone", "ring", "usb"},
    },
}


def load_env() -> dict[str, str]:
    env = {}
    for line in Path(__file__).resolve().parents[1].joinpath(".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def make_token(env: dict[str, str], user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=120),
    }
    return jwt.encode(payload, env["JWT_SECRET_KEY"], algorithm=env["JWT_ALGORITHM"])


def metric_for_products(products: list[dict], expected_terms: set[str]) -> dict:
    matches = 0
    shops = set()
    covered_terms = set()
    detail = []

    for product in products[:5]:
        text = " ".join(
            [
                product.get("name", ""),
                product.get("subcategory", ""),
                " ".join(product.get("tags", []) or []),
                product.get("reason", ""),
            ]
        ).lower()
        hits = sorted(term for term in expected_terms if term in text)
        if hits:
            matches += 1
            covered_terms.update(hits)
        if product.get("shop_id"):
            shops.add(product["shop_id"])
        detail.append({"name": product.get("name"), "hits": hits, "shop_id": product.get("shop_id")})

    return {
        "precision_at_5": round(matches / 5, 2),
        "shop_diversity_at_5": len(shops),
        "term_coverage": round(len(covered_terms) / max(len(expected_terms), 1), 2),
        "top_5": detail,
    }


def get_json(session: requests.Session, base_url: str, token: str, path: str, params: dict | None = None) -> dict:
    url = f"{base_url}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    response = session.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    response.raise_for_status()
    return response.json()


def main() -> None:
    env = load_env()
    dsn = env["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://").replace("ssl=require", "sslmode=require")

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id::text, email
        FROM users
        WHERE email = ANY(%s)
        """,
        (list(PERSONAS.keys()) + ["ml.biz.1774488839@example.com"],),
    )
    user_ids = {email: user_id for user_id, email in cur.fetchall()}
    cur.execute("SELECT latitude, longitude FROM shops WHERE id=%s", (MAIN_SHOP_ID,))
    lat, lng = cur.fetchone()
    cur.close()
    conn.close()

    session = requests.Session()
    report = {
        "base_url": BASE_URL,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "personas": {},
    }

    for email, config in PERSONAS.items():
        token = make_token(env, user_ids[email])
        content = get_json(
            session,
            BASE_URL,
            token,
            "/api/v1/ai/recommendations",
            {"lat": lat, "lng": lng, "limit": 5},
        )
        collaborative = get_json(
            session,
            BASE_URL,
            token,
            "/api/v1/ai/recommendations/collaborative",
            {"lat": lat, "lng": lng, "limit": 5},
        )
        unified = get_json(
            session,
            BASE_URL,
            token,
            "/api/v1/search/unified",
            {"q": "gaming audio streaming", "lat": lat, "lng": lng, "include_debug": "true"},
        )
        report["personas"][email] = {
            "content": metric_for_products(content.get("products", []), config["expected_terms"]),
            "collaborative": metric_for_products(collaborative.get("products", []), config["expected_terms"]),
            "unified_products": metric_for_products(unified.get("products", []), config["expected_terms"]),
            "unified_shops_count": len(unified.get("shops", [])),
        }

    business_token = make_token(env, user_ids["ml.biz.1774488839@example.com"])
    report["merchant_views"] = {
        "pricing": get_json(
            session,
            BASE_URL,
            business_token,
            "/api/v1/ai/pricing/suggest/057ddbe8-9713-4b33-87b8-e5e04c322ac4",
            {"shop_id": MAIN_SHOP_ID},
        ),
        "demand_gaps": get_json(
            session,
            BASE_URL,
            business_token,
            "/api/v1/ai/demand-gaps",
            {"shop_id": MAIN_SHOP_ID, "lat": lat, "lng": lng},
        ),
        "operational_insights": get_json(
            session,
            BASE_URL,
            business_token,
            f"/api/v1/analytics/shop/{MAIN_SHOP_ID}/operational-insights",
        ),
    }

    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    main()
