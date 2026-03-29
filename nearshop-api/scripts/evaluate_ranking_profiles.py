import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.auth.models  # noqa: F401
import app.deals.models  # noqa: F401
import app.orders.models  # noqa: F401
import app.reviews.models  # noqa: F401
import app.stories.models  # noqa: F401

from app.ai.recommendations import get_recommendation_payloads
from app.auth.models import User
from app.core.database import async_session_factory
from app.ranking.demo_fixtures import ensure_recommendation_fixtures
from app.search.service import search_unified
REPORT_PATH = Path(__file__).resolve().parents[2] / "docs" / "ranking_profile_comparison_report.json"
PROFILE_IDS = ["balanced_v1", "query_focus_v1", "conversion_focus_v1"]

PERSONAS = {
    "ml.c1.1774488839@example.com": {
        "expected_terms": {"gaming", "mouse", "keyboard", "headset", "mousepad"},
        "query": "gaming audio streaming",
    },
    "ml.c4@example.com": {
        "expected_terms": {"audio", "earbuds", "speaker", "headphones", "bluetooth"},
        "query": "audio earbuds bluetooth speaker",
    },
    "ml.c5@example.com": {
        "expected_terms": {"streaming", "webcam", "microphone", "ring", "usb"},
        "query": "streaming webcam microphone ring usb",
    },
}


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


def _avg(values: list[float]) -> float:
    return round(mean(values), 3) if values else 0.0


def _combined_score(content_precision: float, unified_precision: float) -> float:
    return round(content_precision * 0.45 + unified_precision * 0.55, 3)


async def main() -> None:
    async with async_session_factory() as db:
        fixture_state = await ensure_recommendation_fixtures(db)
        user_rows = (
            await db.execute(
                select(User.id, User.email).where(User.email.in_(list(PERSONAS.keys())))
            )
        ).all()
        user_ids = {email: user_id for user_id, email in user_rows}
        lat = fixture_state["anchor_lat"]
        lng = fixture_state["anchor_lng"]

        report = {
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "profiles": {},
        }

        for profile_id in PROFILE_IDS:
            profile_report = {"personas": {}, "summary": {}}
            content_scores = []
            unified_scores = []
            combined_scores = []
            shop_coverages = []

            for email, config in PERSONAS.items():
                user_id = user_ids[email]
                content = await get_recommendation_payloads(
                    db,
                    user_id,
                    lat,
                    lng,
                    5,
                    profile_id=profile_id,
                )
                unified = await search_unified(
                    db,
                    config["query"],
                    lat,
                    lng,
                    product_limit=10,
                    shop_limit=8,
                    user_id=user_id,
                    profile_id=profile_id,
                    include_debug=True,
                )

                content_metrics = metric_for_products(content, config["expected_terms"])
                unified_metrics = metric_for_products(unified.get("products", []), config["expected_terms"])
                combined = _combined_score(
                    content_metrics["precision_at_5"],
                    unified_metrics["precision_at_5"],
                )

                content_scores.append(content_metrics["precision_at_5"])
                unified_scores.append(unified_metrics["precision_at_5"])
                combined_scores.append(combined)
                shop_coverages.append(len(unified.get("shops", [])))

                profile_report["personas"][email] = {
                    "content": content_metrics,
                    "unified_products": unified_metrics,
                    "unified_shops_count": len(unified.get("shops", [])),
                    "combined_score": combined,
                }

            profile_report["summary"] = {
                "content_avg_precision_at_5": _avg(content_scores),
                "unified_avg_precision_at_5": _avg(unified_scores),
                "avg_unified_shop_coverage": round(mean(shop_coverages), 2) if shop_coverages else 0.0,
                "combined_score": _avg(combined_scores),
            }
            report["profiles"][profile_id] = profile_report

    best_profile = max(
        report["profiles"].items(),
        key=lambda item: item[1]["summary"]["combined_score"],
    )[0]
    report["winner"] = {
        "profile_id": best_profile,
        "combined_score": report["profiles"][best_profile]["summary"]["combined_score"],
    }

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
