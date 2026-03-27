from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.service import _period_start
from app.auth.models import UserEvent
from app.config import get_settings

settings = get_settings()

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


def _window_range(period: str, *, now: datetime | None = None) -> tuple[datetime, datetime, datetime]:
    now = now or datetime.now(timezone.utc)
    current_start = _period_start(period)
    window = now - current_start
    previous_start = current_start - window
    return previous_start, current_start, now


def _recommend_experiment_winner(experiment: dict) -> dict:
    variants = experiment.get("variants", []) or []
    if len(variants) < 2:
        return {
            "status": "insufficient_variants",
            "winner_variant_id": None,
            "reason": "At least two variants are required",
        }

    sorted_variants = sorted(
        variants,
        key=lambda item: (
            float(item.get("purchase_rate", 0) or 0),
            float(item.get("ctr", 0) or 0),
            int(item.get("impressions", 0) or 0),
        ),
        reverse=True,
    )
    winner = sorted_variants[0]
    runner_up = sorted_variants[1]
    min_impressions = settings.RANKING_EXPERIMENT_MIN_IMPRESSIONS_PER_VARIANT

    if any(int(item.get("impressions", 0) or 0) < min_impressions for item in sorted_variants[:2]):
        return {
            "status": "collecting_data",
            "winner_variant_id": winner.get("variant_id"),
            "reason": f"Need at least {min_impressions} impressions per leading variant",
        }

    purchase_delta = round(
        float(winner.get("purchase_rate", 0) or 0) - float(runner_up.get("purchase_rate", 0) or 0),
        2,
    )
    ctr_delta = round(
        float(winner.get("ctr", 0) or 0) - float(runner_up.get("ctr", 0) or 0),
        2,
    )
    if purchase_delta >= settings.RANKING_EXPERIMENT_MIN_PURCHASE_RATE_DELTA:
        return {
            "status": "ready_to_promote",
            "winner_variant_id": winner.get("variant_id"),
            "reason": f"Purchase rate leads by {purchase_delta} points",
            "purchase_rate_delta": purchase_delta,
            "ctr_delta": ctr_delta,
        }
    if ctr_delta >= settings.RANKING_EXPERIMENT_MIN_CTR_DELTA:
        return {
            "status": "ready_to_promote",
            "winner_variant_id": winner.get("variant_id"),
            "reason": f"CTR leads by {ctr_delta} points",
            "purchase_rate_delta": purchase_delta,
            "ctr_delta": ctr_delta,
        }
    return {
        "status": "inconclusive",
        "winner_variant_id": winner.get("variant_id"),
        "reason": "Leading variant does not beat thresholds yet",
        "purchase_rate_delta": purchase_delta,
        "ctr_delta": ctr_delta,
    }


def summarize_ranking_outcomes(events: list[dict], *, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    per_surface: dict[str, dict] = {}
    per_profile: dict[str, dict] = {}
    per_experiment: dict[str, dict] = {}
    reason_counter: defaultdict[str, Counter] = defaultdict(Counter)
    daily_counter: defaultdict[str, Counter] = defaultdict(Counter)

    for row in events:
        metadata = row.get("metadata") or {}
        surface = metadata.get("ranking_surface")
        profile_id = metadata.get("ranking_profile") or "unknown"
        experiment_id = metadata.get("ranking_experiment")
        variant_id = metadata.get("ranking_variant") or profile_id
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
        profile_row = per_profile.setdefault(
            profile_id,
            {
                "profile_id": profile_id,
                "impressions": 0,
                "clicks": 0,
                "wishlists": 0,
                "add_to_carts": 0,
                "purchases": 0,
                "surfaces": Counter(),
            },
        )
        experiment_row = None
        if experiment_id:
            experiment_row = per_experiment.setdefault(
                experiment_id,
                {
                    "experiment_id": experiment_id,
                    "surface": surface,
                    "impressions": 0,
                    "clicks": 0,
                    "wishlists": 0,
                    "add_to_carts": 0,
                    "purchases": 0,
                    "variants": defaultdict(
                        lambda: {
                            "variant_id": "",
                            "impressions": 0,
                            "clicks": 0,
                            "wishlists": 0,
                            "add_to_carts": 0,
                            "purchases": 0,
                        }
                    ),
                },
            )
            experiment_row["surface"] = surface
            variant_row = experiment_row["variants"][variant_id]
            variant_row["variant_id"] = variant_id
        else:
            variant_row = None
        event_type = row.get("event_type")
        created_at = row.get("created_at")
        day_key = created_at.date().isoformat() if created_at else now.date().isoformat()

        if event_type == "ranking_impression":
            surface_row["impressions"] += 1
            profile_row["impressions"] += 1
            if experiment_row:
                experiment_row["impressions"] += 1
                variant_row["impressions"] += 1
            daily_counter[day_key]["impressions"] += 1
        elif event_type == "product_click":
            surface_row["clicks"] += 1
            profile_row["clicks"] += 1
            if experiment_row:
                experiment_row["clicks"] += 1
                variant_row["clicks"] += 1
            daily_counter[day_key]["clicks"] += 1
        elif event_type == "wishlist_add":
            surface_row["wishlists"] += 1
            profile_row["wishlists"] += 1
            if experiment_row:
                experiment_row["wishlists"] += 1
                variant_row["wishlists"] += 1
            daily_counter[day_key]["wishlists"] += 1
        elif event_type == "add_to_cart":
            surface_row["add_to_carts"] += 1
            profile_row["add_to_carts"] += 1
            if experiment_row:
                experiment_row["add_to_carts"] += 1
                variant_row["add_to_carts"] += 1
            daily_counter[day_key]["add_to_carts"] += 1
        elif event_type == "purchase":
            surface_row["purchases"] += 1
            profile_row["purchases"] += 1
            if experiment_row:
                experiment_row["purchases"] += 1
                variant_row["purchases"] += 1
            daily_counter[day_key]["purchases"] += 1
        profile_row["surfaces"][surface] += 1

        ranking_reason = metadata.get("ranking_reason")
        if ranking_reason:
            reason_counter[surface][ranking_reason] += 1

    surfaces = []
    profiles = []
    experiments = []
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
    for profile_id, row in per_profile.items():
        row["ctr"] = _safe_pct(row["clicks"], row["impressions"])
        row["add_to_cart_rate"] = _safe_pct(row["add_to_carts"], row["impressions"])
        row["purchase_rate"] = _safe_pct(row["purchases"], row["impressions"])
        row["top_surfaces"] = [
            {"surface": surface, "count": count}
            for surface, count in row["surfaces"].most_common(3)
        ]
        row.pop("surfaces", None)
        profiles.append(row)
    profiles.sort(key=lambda item: (item["purchase_rate"], item["ctr"], item["impressions"]), reverse=True)
    for experiment_id, row in per_experiment.items():
        row["ctr"] = _safe_pct(row["clicks"], row["impressions"])
        row["add_to_cart_rate"] = _safe_pct(row["add_to_carts"], row["impressions"])
        row["purchase_rate"] = _safe_pct(row["purchases"], row["impressions"])
        variants = []
        for variant in row["variants"].values():
            variants.append(
                {
                    **variant,
                    "ctr": _safe_pct(variant["clicks"], variant["impressions"]),
                    "add_to_cart_rate": _safe_pct(variant["add_to_carts"], variant["impressions"]),
                    "purchase_rate": _safe_pct(variant["purchases"], variant["impressions"]),
                }
            )
        variants.sort(key=lambda item: (item["purchase_rate"], item["ctr"], item["impressions"]), reverse=True)
        row["variants"] = variants
        row["recommendation"] = _recommend_experiment_winner(row)
        experiments.append(row)
    experiments.sort(key=lambda item: (item["purchase_rate"], item["ctr"], item["impressions"]), reverse=True)
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
            "profile_count": len(profiles),
            "experiment_count": len(experiments),
        },
        "surfaces": surfaces,
        "profiles": profiles,
        "experiments": experiments,
        "trend": trend,
    }


async def get_ranking_outcomes(db: AsyncSession, period: str = "30d") -> dict:
    previous_start, current_start, now = _window_range(period)
    rows = (
        await db.execute(
            select(UserEvent.event_type, UserEvent.metadata_, UserEvent.created_at)
            .where(
                UserEvent.created_at >= previous_start,
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
    current_events = [row for row in payload if row["created_at"] and row["created_at"] >= current_start]
    previous_events = [row for row in payload if row["created_at"] and previous_start <= row["created_at"] < current_start]
    summary = summarize_ranking_outcomes(current_events, now=now)
    previous = summarize_ranking_outcomes(previous_events, now=current_start)
    current_summary = summary["summary"]
    previous_summary = previous["summary"]
    return {
        "period": period,
        "generated_at": now.isoformat(),
        "comparison": {
            "current_period_start": current_start.isoformat(),
            "previous_period_start": previous_start.isoformat(),
            "previous_period_end": current_start.isoformat(),
            "summary_delta": {
                "ctr": round(current_summary["ctr"] - previous_summary["ctr"], 2),
                "add_to_cart_rate": round(current_summary["add_to_cart_rate"] - previous_summary["add_to_cart_rate"], 2),
                "purchase_rate": round(current_summary["purchase_rate"] - previous_summary["purchase_rate"], 2),
                "impressions": current_summary["impressions"] - previous_summary["impressions"],
            },
        },
        "previous_summary": previous_summary,
        **summary,
    }
