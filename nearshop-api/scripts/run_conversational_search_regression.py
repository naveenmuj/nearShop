"""Run conversational-search regression checks locally and against a live API.

Usage:
    python scripts/run_conversational_search_regression.py
    API_BASE_URL=http://165.232.182.130/api/v1 python scripts/run_conversational_search_regression.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import requests
from dotenv import load_dotenv
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = ROOT.parent / "docs"
REPORT_PATH = DOCS_ROOT / "conversational_search_report.json"

sys.path.insert(0, str(ROOT))

from app.main import create_app  # noqa: E402


def run_local_mocked_checks() -> list[dict]:
    app = create_app()
    client = TestClient(app)
    sample_results = {
        "products": [
            {"id": "1", "name": "Black Headphones", "price": 1999, "category": "Electronics", "subcategory": "Audio"},
            {"id": "2", "name": "Premium Headphones", "price": 5999, "category": "Electronics", "subcategory": "Audio"},
            {"id": "3", "name": "Rice Bag", "price": 499, "category": "Grocery", "subcategory": "Staples"},
        ],
        "shops": [
            {"id": "s1", "name": "Sound Hub", "category": "Electronics"},
            {"id": "s2", "name": "Daily Needs", "category": "Grocery"},
        ],
    }
    checks: list[dict] = []

    def add(name: str, passed: bool, body: dict):
        checks.append({"name": name, "passed": passed, "body_preview": body})

    with patch("app.ai.router.parse_search_query", return_value={
        "keywords": "black headphones",
        "category": "Electronics",
        "min_price": 1000,
        "max_price": 3000,
        "color": "Black",
        "material": None,
        "brand": None,
        "sort_by": "price_low",
    }):
        response = client.post(
            "/api/v1/ai/search/conversational",
            json={"query": "cheap black headphones under 3000", "latitude": 12.9, "longitude": 77.6},
        )
        body = response.json()
        add(
            "parse_success",
            response.status_code == 200 and body.get("ai_used") is True and body.get("fallback_used") is False,
            body,
        )

    with patch("app.ai.router.parse_search_query", side_effect=RuntimeError("boom")):
        response = client.post(
            "/api/v1/ai/search/conversational",
            json={"query": "cheap black headphones under 3000", "latitude": 12.9, "longitude": 77.6},
        )
        body = response.json()
        add(
            "parse_fallback",
            response.status_code == 200 and body.get("fallback_used") is True and body["filters"]["keywords"] == "cheap black headphones under 3000",
            body,
        )

    with patch("app.ai.router.parse_search_query", return_value={
        "keywords": "black headphones",
        "category": "Electronics",
        "min_price": 1000,
        "max_price": 3000,
        "color": "Black",
        "material": None,
        "brand": None,
        "sort_by": "price_low",
    }), patch("app.search.service.search_unified", return_value=sample_results):
        response = client.post(
            "/api/v1/ai/search/conversational/run",
            json={"query": "cheap black headphones under 3000", "latitude": 12.9, "longitude": 77.6},
        )
        body = response.json()
        add(
            "run_success_filtered",
            response.status_code == 200 and len(body.get("products", [])) == 1 and body["products"][0]["name"] == "Black Headphones",
            body,
        )

    with patch("app.ai.router.parse_search_query", return_value={
        "keywords": "black headphones",
        "category": "Electronics",
        "min_price": None,
        "max_price": None,
        "color": "Blue",
        "material": None,
        "brand": None,
        "sort_by": None,
    }), patch("app.search.service.search_unified", return_value=sample_results):
        response = client.post(
            "/api/v1/ai/search/conversational/run",
            json={"query": "black headphones", "latitude": 12.9, "longitude": 77.6},
        )
        body = response.json()
        add(
            "run_relaxes_sparse_color_filter",
            response.status_code == 200 and body.get("filter_relaxed") is True and len(body.get("products", [])) == 2,
            body,
        )

    with patch("app.ai.router.parse_search_query", side_effect=RuntimeError("boom")), patch("app.search.service.search_unified", return_value=sample_results):
        response = client.post(
            "/api/v1/ai/search/conversational/run",
            json={"query": "headphones", "latitude": 12.9, "longitude": 77.6},
        )
        body = response.json()
        add(
            "run_fallback_to_unified",
            response.status_code == 200 and body.get("fallback_used") is True and len(body.get("products", [])) == 3,
            body,
        )

    return checks


def run_live_checks(base_url: str) -> list[dict]:
    checks: list[dict] = []

    def add(name: str, response: requests.Response, body):
        checks.append(
            {
                "name": name,
                "passed": response.status_code == 200,
                "status_code": response.status_code,
                "body_preview": body,
            }
        )

    cases = [
        ("health", "GET", "/health", None),
        ("parse_natural", "POST", "/ai/search/conversational", {"query": "cheap black headphones under 3000 near me", "latitude": 12.9352, "longitude": 77.6245}),
        ("run_natural", "POST", "/ai/search/conversational/run", {"query": "cheap black headphones under 3000 near me", "latitude": 12.9352, "longitude": 77.6245}),
        ("run_simple", "POST", "/ai/search/conversational/run", {"query": "rice", "latitude": 12.9352, "longitude": 77.6245}),
        ("run_no_location", "POST", "/ai/search/conversational/run", {"query": "electronics"}),
    ]

    for name, method, path, payload in cases:
        response = requests.request(method, f"{base_url}{path}", json=payload, timeout=60)
        try:
            body = response.json()
        except Exception:
            body = response.text[:500]
        add(name, response, body)

    return checks


def main() -> None:
    load_dotenv(ROOT / ".env")
    DOCS_ROOT.mkdir(exist_ok=True)
    base_url = os.getenv("API_BASE_URL", "http://165.232.182.130/api/v1").rstrip("/")

    report = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "local_mocked_checks": run_local_mocked_checks(),
        "live_checks": run_live_checks(base_url),
    }
    report["summary"] = {
        "local_passed": sum(1 for item in report["local_mocked_checks"] if item["passed"]),
        "local_total": len(report["local_mocked_checks"]),
        "live_passed": sum(1 for item in report["live_checks"] if item["passed"]),
        "live_total": len(report["live_checks"]),
    }

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    main()
