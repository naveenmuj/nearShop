from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

from app.ranking.service import (
    get_ranking_profile,
    get_surface_experiments,
    get_surface_profile_overrides,
    list_ranking_profiles,
)

REPORT_PATH = Path(__file__).resolve().parents[3] / "docs" / "ranking_quality_report.json"
RANKING_VERSION = "ranking-v1.2"

RANKING_SURFACES = [
    {"id": "content_recommendations", "label": "Content Recommendations", "status": "active"},
    {"id": "collaborative_recommendations", "label": "Collaborative Recommendations", "status": "active"},
    {"id": "home_feed", "label": "Home Feed Ranking", "status": "active"},
    {"id": "deals_ranking", "label": "Deals Ranking", "status": "active"},
    {"id": "unified_search", "label": "Unified Search Ranking", "status": "active"},
]

PRODUCT_SIGNALS = [
    {"id": "category_match", "description": "Boost when product category matches user affinity."},
    {"id": "subcategory_match", "description": "Boost when subcategory aligns with repeat demand."},
    {"id": "tag_match", "description": "Boost for overlapping descriptive tags."},
    {"id": "shop_affinity", "description": "Boost for followed or recently visited shops."},
    {"id": "query_overlap", "description": "Boost for overlap with live query terms and recent searches."},
    {"id": "locality", "description": "Prefer nearby shops when location is available."},
    {"id": "quality", "description": "Boost well-rated and higher-quality shops."},
    {"id": "freshness", "description": "Slightly favor newer catalogue additions."},
    {"id": "intent_suppression", "description": "Down-rank recently purchased products to avoid repetition."},
]

SHOP_SIGNALS = [
    {"id": "query_overlap", "description": "Boost shops that match query text or product inventory."},
    {"id": "follow_affinity", "description": "Boost followed or previously visited shops."},
    {"id": "locality", "description": "Prefer closer shops within the active radius."},
    {"id": "quality", "description": "Boost verified, higher-rated, stronger-score shops."},
    {"id": "inventory_match", "description": "Boost shops whose products match the active query."},
]


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _avg(values: list[float]) -> float:
    return round(mean(values), 3) if values else 0.0


def summarize_ranking_report(report: dict[str, Any], *, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    personas = report.get("personas", {}) or {}

    persona_rows: list[dict[str, Any]] = []
    content_scores: list[float] = []
    collaborative_scores: list[float] = []
    unified_scores: list[float] = []
    unified_shop_counts: list[int] = []

    for persona, metrics in personas.items():
        content_precision = float(metrics.get("content", {}).get("precision_at_5", 0.0) or 0.0)
        collaborative_precision = float(metrics.get("collaborative", {}).get("precision_at_5", 0.0) or 0.0)
        unified_precision = float(metrics.get("unified_products", {}).get("precision_at_5", 0.0) or 0.0)
        unified_shop_count = int(metrics.get("unified_shops_count", 0) or 0)

        content_scores.append(content_precision)
        collaborative_scores.append(collaborative_precision)
        unified_scores.append(unified_precision)
        unified_shop_counts.append(unified_shop_count)

        persona_rows.append(
            {
                "persona": persona,
                "content_precision_at_5": round(content_precision, 2),
                "collaborative_precision_at_5": round(collaborative_precision, 2),
                "unified_precision_at_5": round(unified_precision, 2),
                "unified_shop_count": unified_shop_count,
                "content_term_coverage": float(metrics.get("content", {}).get("term_coverage", 0.0) or 0.0),
                "unified_term_coverage": float(metrics.get("unified_products", {}).get("term_coverage", 0.0) or 0.0),
            }
        )

    best_surface = "content_recommendations"
    surface_scores = {
        "content_recommendations": _avg(content_scores),
        "collaborative_recommendations": _avg(collaborative_scores),
        "unified_search": _avg(unified_scores),
    }
    if surface_scores:
        best_surface = max(surface_scores, key=surface_scores.get)

    evaluated_at = _parse_iso(report.get("evaluated_at"))
    age_hours = round((now - evaluated_at).total_seconds() / 3600, 1) if evaluated_at else None
    freshness_status = "fresh"
    if age_hours is None:
        freshness_status = "unknown"
    elif age_hours > 72:
        freshness_status = "stale"
    elif age_hours > 24:
        freshness_status = "aging"

    return {
        "version": RANKING_VERSION,
        "active_profile": {
            "id": get_ranking_profile().id,
            "label": get_ranking_profile().label,
        },
        "available_profiles": list_ranking_profiles(),
        "surface_profiles": get_surface_profile_overrides(),
        "surface_experiments": get_surface_experiments(),
        "evaluated_at": report.get("evaluated_at"),
        "freshness": {
            "status": freshness_status,
            "age_hours": age_hours,
        },
        "surfaces": RANKING_SURFACES,
        "signals": {
            "products": PRODUCT_SIGNALS,
            "shops": SHOP_SIGNALS,
        },
        "summary": {
            "content_avg_precision_at_5": _avg(content_scores),
            "collaborative_avg_precision_at_5": _avg(collaborative_scores),
            "unified_avg_precision_at_5": _avg(unified_scores),
            "avg_unified_shop_coverage": round(mean(unified_shop_counts), 2) if unified_shop_counts else 0.0,
            "best_surface": best_surface,
            "persona_count": len(persona_rows),
        },
        "personas": persona_rows,
        "report_meta": {
            "base_url": report.get("base_url"),
            "merchant_views_available": bool(report.get("merchant_views")),
        },
        "next_actions": [
            "Tune mixed-intent unified search precision for audio-only and lifestyle queries.",
            "Track click-through and add-to-cart outcomes per ranking surface before weight changes.",
            "Refresh this evaluation report after major ranking or catalog changes.",
        ],
    }


async def get_ranking_diagnostics() -> dict[str, Any]:
    if not REPORT_PATH.exists():
        return {
            "version": RANKING_VERSION,
            "active_profile": {
                "id": get_ranking_profile().id,
                "label": get_ranking_profile().label,
            },
            "available_profiles": list_ranking_profiles(),
            "surface_profiles": get_surface_profile_overrides(),
            "surface_experiments": get_surface_experiments(),
            "report_available": False,
            "surfaces": RANKING_SURFACES,
            "signals": {
                "products": PRODUCT_SIGNALS,
                "shops": SHOP_SIGNALS,
            },
            "summary": {
                "content_avg_precision_at_5": 0.0,
                "collaborative_avg_precision_at_5": 0.0,
                "unified_avg_precision_at_5": 0.0,
                "avg_unified_shop_coverage": 0.0,
                "best_surface": "content_recommendations",
                "persona_count": 0,
            },
            "personas": [],
            "freshness": {"status": "missing", "age_hours": None},
            "next_actions": [
                "Run scripts/evaluate_recommendations.py to generate the ranking diagnostics report.",
            ],
        }

    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    summary = summarize_ranking_report(report)
    summary["report_available"] = True
    return summary
