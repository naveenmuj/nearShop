"""Natural language search query parser using a low-cost OpenAI model."""
import json
import logging
from typing import Optional
from uuid import UUID

from app.config import get_settings
from app.ai.tracker import tracked_chat

logger = logging.getLogger(__name__)

_PARSE_PROMPT = (
    "Parse this Indian marketplace product search query into structured filters. "
    "Return ONLY a valid JSON object with these fields: "
    "keywords (str), category (str or null), min_price (number or null), "
    "max_price (number or null), color (str or null), material (str or null), "
    "brand (str or null), sort_by (one of: 'relevance', 'price_low', 'price_high', or null). "
    "Return only JSON, no markdown. Query: "
)


def build_search_fallback(query: str) -> dict:
    normalized = (query or "").strip()
    return {
        "keywords": normalized,
        "category": None,
        "min_price": None,
        "max_price": None,
        "color": None,
        "material": None,
        "brand": None,
        "sort_by": None,
    }


def _sanitize_filters(payload: dict | None, query: str) -> dict:
    filters = build_search_fallback(query)
    if not isinstance(payload, dict):
        return filters

    for key in ("keywords", "category", "color", "material", "brand", "sort_by"):
        value = payload.get(key)
        if isinstance(value, str):
            value = value.strip()
            filters[key] = value or None
        elif value is None:
            filters[key] = None

    for key in ("min_price", "max_price"):
        value = payload.get(key)
        if value in (None, "", False):
            filters[key] = None
            continue
        try:
            filters[key] = float(value)
        except (TypeError, ValueError):
            filters[key] = None

    if filters["sort_by"] not in {"relevance", "price_low", "price_high", None}:
        filters["sort_by"] = None
    if filters["min_price"] is not None and filters["max_price"] is not None:
        if filters["min_price"] > filters["max_price"]:
            filters["min_price"], filters["max_price"] = filters["max_price"], filters["min_price"]
    if not filters["keywords"]:
        filters["keywords"] = (query or "").strip()
    return filters


async def parse_search_query(query: str, user_id: Optional[UUID] = None) -> dict:
    """Parse a natural language search query into structured filters."""
    response = await tracked_chat(
        messages=[{"role": "user", "content": f'{_PARSE_PROMPT}"{query}"'}],
        model=get_settings().AI_CONVERSATIONAL_SEARCH_MODEL,
        max_tokens=256,
        temperature=0.2,
        response_format={"type": "json_object"},
        feature="smart_search",
        endpoint="/ai/search/conversational",
        user_id=user_id,
        request_metadata={"query_length": len(query)},
    )
    raw = response.choices[0].message.content or ""
    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        logger.warning("Smart search returned invalid JSON: %s", exc)
        parsed = {}
    return _sanitize_filters(parsed, query)
