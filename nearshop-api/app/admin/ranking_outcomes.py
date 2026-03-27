from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.service import _period_start
from app.auth.models import UserEvent

SURFACE_LABELS = {
    "content_recommendations": "Content Recommendations",
    "collaborative_recommendations": "Collaborative Recommendations",
    "home_feed": "Home Feed Ranking",
    "deals_ranking": "Deals Ranking",
    "unified_search": "Unified Search Ranking",
}

OUTCOME_EVENT_TYPES = {
    "ranking_impression",
    "product_click",
    "wishlist_add",
    "add_to_cart",
    "purchase",
}


def _safe_pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def summarize_ranking_outcomes(events: list[dict], *, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    per_surface: dict[str, dict] = {}
    reason_counter: defaultdict[str, Counter] = defaultdict(Counter)
    daily_counter: defaultdict[str, Counter] = defaultdict(Counter)

    for row in events:
        metadata = row.get("metadata") or {}
        surface = metadata.get("ranking_surface")
        if not surface:
            continue
        surface_row = per_surface.setdefault(
            surface,
            {
                "surface": surface,
                "label": SURFACE_LABELS.get(surface, surface.replace("_", " ").title()),
                "impressions": 0,
                "clicks": 0,
                "wishlists": 0,
                "add_to_carts": 0,
                "purchases": 0,
            },
        )
        event_type = row.get("event_type")
        created_at = row.get("created_at")
        day_key = created_at.date().isoformat() if created_at else now.date().isoformat()

        if event_type == "ranking_impression":
            surface_row["impressions"] += 1
            daily_counter[day_key]["impressions"] += 1
        elif event_type == "product_click":
            surface_row["clicks"] += 1
            daily_counter[day_key]["clicks"] += 1
        elif event_type == "wishlist_add":
            surface_row["wishlists"] += 1
            daily_counter[day_key]["wishlists"] += 1
        elif event_type == "add_to_cart":
            surface_row["add_to_carts"] += 1
            daily_counter[day_key]["add_to_carts"] += 1
        elif event_type == "purchase":
            surface_row["purchases"] += 1
            daily_counter[day_key]["purchases"] += 1

        ranking_reason = metadata.get("ranking_reason")
        if ranking_reason:
            reason_counter[surface][ranking_reason] += 1

    surfaces = []
    totals = {
        "impressions": 0,
        "clicks": 0,
        "wishlists": 0,
        "add_to_carts": 0,
        "purchases": 0,
    }
    for surface, row in per_surface.items():
        impressions = row["impressions"]
        clicks = row["clicks"]
        add_to_carts = row["add_to_carts"]
        purchases = row["purchases"]
        row["ctr"] = _safe_pct(clicks, impressions)
        row["wishlist_rate"] = _safe_pct(row["wishlists"], impressions)
        row["add_to_cart_rate"] = _safe_pct(add_to_carts, impressions)
        row["purchase_rate"] = _safe_pct(purchases, impressions)
        row["click_to_cart_rate"] = _safe_pct(add_to_carts, clicks)
        row["cart_to_purchase_rate"] = _safe_pct(purchases, add_to_carts)
        row["top_reasons"] = [
            {"reason": reason, "count": count}
            for reason, count in reason_counter[surface].most_common(3)
        ]
        surfaces.append(row)
        for key in totals:
            totals[key] += row[key]

    surfaces.sort(key=lambda item: (item["purchase_rate"], item["ctr"], item["impressions"]), reverse=True)
    best_surface = surfaces[0]["surface"] if surfaces else None
    trend = [
        {
            "date": day,
            "impressions": counts.get("impressions", 0),
            "clicks": counts.get("clicks", 0),
            "add_to_carts": counts.get("add_to_carts", 0),
            "purchases": counts.get("purchases", 0),
        }
        for day, counts in sorted(daily_counter.items())
    ]

    return {
        "summary": {
            **totals,
            "ctr": _safe_pct(totals["clicks"], totals["impressions"]),
            "add_to_cart_rate": _safe_pct(totals["add_to_carts"], totals["impressions"]),
            "purchase_rate": _safe_pct(totals["purchases"], totals["impressions"]),
            "best_surface": best_surface,
            "surface_count": len(surfaces),
        },
        "surfaces": surfaces,
        "trend": trend,
    }


async def get_ranking_outcomes(db: AsyncSession, period: str = "30d") -> dict:
    since = _period_start(period)
    rows = (
        await db.execute(
            select(UserEvent.event_type, UserEvent.metadata_, UserEvent.created_at)
            .where(
                UserEvent.created_at >= since,
                UserEvent.event_type.in_(OUTCOME_EVENT_TYPES),
            )
            .order_by(desc(UserEvent.created_at))
        )
    ).all()

    payload = [
        {
            "event_type": event_type,
            "metadata": metadata or {},
            "created_at": created_at,
        }
        for event_type, metadata, created_at in rows
        if isinstance(metadata, dict) and metadata.get("ranking_surface")
    ]
    summary = summarize_ranking_outcomes(payload)
    return {
        "period": period,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **summary,
    }
