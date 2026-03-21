"""Natural language search query parser using OpenAI GPT-4o-mini."""
import json
import logging

from app.ai.client import get_openai_client

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


async def parse_search_query(query: str) -> dict:
    """Parse a natural language search query into structured filters."""
    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=_TEXT_MODEL,
            max_tokens=256,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": f'{_PARSE_PROMPT}"{query}"'},
            ],
        )
        raw = response.choices[0].message.content or ""
        return json.loads(raw) if raw else {"keywords": query}
    except Exception as exc:
        logger.error("OpenAI smart search error: %s", exc)
        return {"keywords": query}
