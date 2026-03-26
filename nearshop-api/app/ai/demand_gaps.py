"""Feature 2: Unfulfilled Demand Alerts – SearchLog gap analysis.

Finds searches near a shop that returned few/no results, revealing products
the shop could add to capture existing local demand.
"""
import re
from collections import Counter

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import SearchLog
from app.core.geo import within_radius
from app.shops.models import Shop


_STOP_WORDS = {
    "a", "an", "the", "is", "in", "on", "at", "for", "of", "to", "and",
    "or", "i", "me", "my", "near", "nearby", "shop", "store", "buy",
    "get", "want", "need", "best", "good", "cheap",
}


def _clean_query(text: str) -> str:
    """Normalize a search query to a canonical keyword phrase."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = [t for t in text.split() if t not in _STOP_WORDS and len(t) > 2]
    return " ".join(tokens[:4])  # max 4 words


async def get_demand_gaps(
    db: AsyncSession,
    shop_id,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    days: int = 30,
    limit: int = 10,
) -> list[dict]:
    """
    Return the top unfulfilled demand signals near a shop.

    Aggregates SearchLog entries within *radius_km* that had ≤ 3 results
    (meaning no shop nearby sells that product), groups by cleaned keyword,
    and returns the most-searched gaps with metadata.
    """
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Fetch low-result searches within radius in the last N days
    stmt = (
        select(
            SearchLog.query_text,
            SearchLog.results_count,
            SearchLog.latitude,
            SearchLog.longitude,
        )
        .where(
            and_(
                SearchLog.query_text.isnot(None),
                SearchLog.query_text != "",
                SearchLog.results_count <= 3,
                SearchLog.latitude.isnot(None),
                SearchLog.longitude.isnot(None),
                SearchLog.created_at >= since,
                within_radius(
                    SearchLog.latitude,
                    SearchLog.longitude,
                    lat,
                    lng,
                    radius_km,
                ),
            )
        )
        .limit(2000)  # safety cap – we aggregate in Python
    )

    rows = (await db.execute(stmt)).fetchall()

    if not rows:
        return []

    # Aggregate by cleaned keyword
    keyword_counts: Counter = Counter()
    keyword_zero_results: Counter = Counter()  # subset with 0 results

    for row in rows:
        kw = _clean_query(row.query_text or "")
        if not kw:
            continue
        keyword_counts[kw] += 1
        if row.results_count == 0:
            keyword_zero_results[kw] += 1

    if not keyword_counts:
        return []

    # Build result list sorted by search volume
    top_keywords = keyword_counts.most_common(limit * 2)  # over-fetch to filter

    gaps = []
    seen = set()
    for keyword, count in top_keywords:
        if len(gaps) >= limit:
            break
        if not keyword or keyword in seen:
            continue
        seen.add(keyword)
        zero_count = keyword_zero_results.get(keyword, 0)
        opportunity_score = count + zero_count * 2  # zero-result searches worth more
        gaps.append(
            {
                "keyword": keyword,
                "search_volume": count,
                "zero_result_searches": zero_count,
                "opportunity_score": opportunity_score,
                "suggested_action": _suggest_action(keyword, count),
            }
        )

    # Sort by opportunity_score descending
    gaps.sort(key=lambda x: x["opportunity_score"], reverse=True)
    return gaps[:limit]


def _suggest_action(keyword: str, volume: int) -> str:
    """Generate a human-readable suggestion for a demand gap keyword."""
    if volume >= 10:
        return f"High demand! Add '{keyword}' products to capture {volume}+ monthly searches."
    elif volume >= 5:
        return f"Moderate demand for '{keyword}' — worth adding to your catalog."
    else:
        return f"Some customers searched for '{keyword}' — consider stocking it."
