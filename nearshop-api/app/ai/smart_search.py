"""Natural language search query parser using OpenAI GPT-4o-mini."""
import json
import logging
from typing import Optional
from uuid import UUID

from app.ai.tracker import tracked_chat

logger = logging.getLogger(__name__)

_TEXT_MODEL = "gpt-4o-mini"

_PARSE_PROMPT = (
    "Parse this Indian marketplace product search query into structured filters. "
    "Return ONLY a valid JSON object with these fields: "
    "keywords (str), category (str or null), min_price (number or null), "
    "max_price (number or null), color (str or null), material (str or null), "
    "brand (str or null), sort_by (one of: 'relevance', 'price_low', 'price_high', or null). "
    "Return only JSON, no markdown. Query: "
)


async def parse_search_query(query: str, user_id: Optional[UUID] = None) -> dict:
    """Parse a natural language search query into structured filters."""
    try:
        response = await tracked_chat(
            messages=[{"role": "user", "content": f'{_PARSE_PROMPT}"{query}"'}],
            model=_TEXT_MODEL,
            max_tokens=256,
            temperature=0.7,
            response_format={"type": "json_object"},
            feature="smart_search",
            endpoint="/ai/search/conversational",
            user_id=user_id,
            request_metadata={"query_length": len(query)},
        )
        raw = response.choices[0].message.content or ""
        return json.loads(raw) if raw else {"keywords": query}
    except Exception as exc:
        logger.error("OpenAI smart search error: %s", exc)
        return {"keywords": query}
