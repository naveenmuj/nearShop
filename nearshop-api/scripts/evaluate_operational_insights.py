import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

import psycopg2
import requests
from jose import jwt


BASE_URL = "http://127.0.0.1:8010"
MAX_SHOPS = 5


def load_env() -> dict[str, str]:
    env = {}
    env_path = Path(__file__).resolve().parents[1] / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def make_token(env: dict[str, str], user_id: str, role: str = "business") -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=120),
    }
    return jwt.encode(payload, env["JWT_SECRET_KEY"], algorithm=env["JWT_ALGORITHM"])


def get_json(session: requests.Session, base_url: str, token: str, path: str, params: dict | None = None) -> dict:
    url = f"{base_url}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    response = session.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if response.status_code == 404:
        raise RuntimeError(
            f"{url} returned 404. Restart the API service so the operational-insights route is loaded."
        )
    response.raise_for_status()
    return response.json()


def main() -> None:
    env = load_env()
    dsn = env["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://").replace("ssl=require", "sslmode=require")
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.id::text, s.name, s.latitude, s.longitude, s.owner_id::text,
               COUNT(o.id) AS order_count
        FROM shops s
        LEFT JOIN orders o ON o.shop_id = s.id
        WHERE s.is_active = TRUE
        GROUP BY s.id, s.name, s.latitude, s.longitude, s.owner_id
        ORDER BY COUNT(o.id) DESC, s.created_at ASC
        LIMIT %s
        """,
        (MAX_SHOPS,),
    )
    shops = cur.fetchall()
    cur.close()
    conn.close()

    session = requests.Session()
    report = {
        "base_url": BASE_URL,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "shops": [],
    }

    for shop_id, shop_name, lat, lng, owner_id, order_count in shops:
        token = make_token(env, owner_id, role="business")
        insights = get_json(
            session,
            BASE_URL,
            token,
            f"/api/v1/analytics/shop/{shop_id}/operational-insights",
            {"lat": lat, "lng": lng} if lat is not None and lng is not None else None,
        )

        report["shops"].append(
            {
                "shop_id": shop_id,
                "shop_name": shop_name,
                "order_count_db": order_count,
                "confidence": insights.get("meta", {}).get("confidence", {}),
                "warnings": insights.get("meta", {}).get("warnings", []),
                "sample_sizes": insights.get("meta", {}).get("sample_sizes", {}),
                "recommended_actions": [
                    {
                        "id": action.get("id"),
                        "priority": action.get("priority"),
                        "title": action.get("title"),
                        "target": action.get("target"),
                    }
                    for action in insights.get("recommended_actions", [])
                ],
            }
        )

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
