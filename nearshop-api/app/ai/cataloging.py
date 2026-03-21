"""AI-powered product cataloging using OpenAI GPT-4o Vision."""
import base64
import io
import json
import logging

from PIL import Image

from app.ai.client import get_openai_client

logger = logging.getLogger(__name__)

_VISION_MODEL = "gpt-4o"
_MAX_IMAGE_PX = 1024   # resize to this before sending — keeps cost/latency low
_CALL_TIMEOUT = 60     # seconds

_SINGLE_PRODUCT_PROMPT = (
    "You are a product catalog assistant for a local Indian marketplace. "
    "Analyze this product image and return ONLY a valid JSON object with these exact fields: "
    "\"name\" (string), \"description\" (string, 2-3 sentences), \"category\" (string), "
    "\"subcategory\" (string), "
    "\"estimated_price_range\" (object with integer fields \"min\" and \"max\" in INR), "
    "\"attributes\" (object of key-value pairs for color, size, material, brand if visible), "
    "\"tags\" (array of strings), \"confidence\" (float 0-1). "
    "Return ONLY the JSON object. No explanation, no markdown, no code fences."
)

_SHELF_PROMPT = (
    "You are a product catalog assistant for a local Indian marketplace. "
    "Identify ALL individual products visible on this shelf or display. "
    "Return ONLY a valid JSON object in this exact format: "
    "{\"products\": [{\"name\": string, \"description\": string, \"category\": string, "
    "\"estimated_price_range\": {\"min\": int, \"max\": int}, "
    "\"attributes\": {}, \"tags\": [string]}]}. "
    "Be thorough — list every distinct product visible. No markdown, no code fences."
)

_FALLBACK_SINGLE = {
    "error": "AI analysis failed",
    "fallback": True,
    "name": "",
    "description": "",
    "category": "general",
    "attributes": {},
    "tags": [],
    "confidence": 0.0,
}


def _resize_and_encode(image_bytes: bytes, media_type: str = "image/jpeg") -> tuple[str, str]:
    """Resize image to max _MAX_IMAGE_PX on longest side, convert to JPEG, return (data_url, media_type)."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")  # strip alpha, handle WebP/HEIC

        # Resize if larger than limit
        w, h = img.size
        if max(w, h) > _MAX_IMAGE_PX:
            ratio = _MAX_IMAGE_PX / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        buf.seek(0)
        data = buf.read()
        b64 = base64.standard_b64encode(data).decode()
        logger.debug("Image resized to %dx%d, %d KB", img.width, img.height, len(data) // 1024)
        return f"data:image/jpeg;base64,{b64}", "image/jpeg"
    except Exception as exc:
        logger.warning("Image resize failed (%s), using original", exc)
        b64 = base64.standard_b64encode(image_bytes).decode()
        return f"data:{media_type};base64,{b64}", media_type


def _parse_json(text: str):
    """Strip markdown fences and parse JSON."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


async def _call_vision(image_data_url: str, prompt: str, max_tokens: int = 1024) -> str:
    """Call GPT-4o with an image and return the raw text response."""
    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=_VISION_MODEL,
            max_tokens=max_tokens,
            timeout=_CALL_TIMEOUT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data_url, "detail": "auto"},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        choice = response.choices[0]
        finish = choice.finish_reason
        content = choice.message.content or ""

        if finish == "content_filter":
            logger.warning("OpenAI content filter triggered for image")
            return ""
        if finish == "length":
            logger.warning("OpenAI response truncated (max_tokens=%d) — trying to parse partial", max_tokens)

        return content
    except Exception as exc:
        logger.error("OpenAI vision API error: %s: %s", type(exc).__name__, exc)
        return ""


async def analyze_product_image_bytes(
    image_bytes: bytes, media_type: str = "image/jpeg"
) -> dict:
    """Analyze a single product image uploaded as raw bytes."""
    if not image_bytes:
        return {**_FALLBACK_SINGLE, "error": "Empty image received"}

    data_url, _ = _resize_and_encode(image_bytes, media_type)
    raw = await _call_vision(data_url, _SINGLE_PRODUCT_PROMPT, max_tokens=1024)

    if not raw:
        return _FALLBACK_SINGLE

    try:
        return _parse_json(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Could not parse GPT-4o response: %s | raw: %.200s", exc, raw)
        return {**_FALLBACK_SINGLE, "error": "Could not parse AI response"}


async def analyze_shelf_image_bytes(
    image_bytes: bytes, media_type: str = "image/jpeg"
) -> list[dict]:
    """Analyze a shelf image and identify all individual products."""
    if not image_bytes:
        return []

    data_url, _ = _resize_and_encode(image_bytes, media_type)
    raw = await _call_vision(data_url, _SHELF_PROMPT, max_tokens=4096)

    if not raw:
        return []

    try:
        parsed = _parse_json(raw)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return parsed.get("products", [])
        return []
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Could not parse shelf response: %s | raw: %.200s", exc, raw)
        return []


# ── URL-based variants kept for any internal use ─────────────────────────────

async def analyze_product_image(image_url: str) -> dict:
    """Analyze a product image from a public URL."""
    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=_VISION_MODEL,
            max_tokens=1024,
            timeout=_CALL_TIMEOUT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url, "detail": "auto"}},
                        {"type": "text", "text": _SINGLE_PRODUCT_PROMPT},
                    ],
                }
            ],
        )
        raw = response.choices[0].message.content or ""
        return _parse_json(raw) if raw else _FALLBACK_SINGLE
    except Exception as exc:
        logger.error("OpenAI vision API error: %s: %s", type(exc).__name__, exc)
        return _FALLBACK_SINGLE


async def analyze_shelf_image(image_url: str) -> list[dict]:
    """Analyze a shelf image from a public URL."""
    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=_VISION_MODEL,
            max_tokens=4096,
            timeout=_CALL_TIMEOUT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url, "detail": "auto"}},
                        {"type": "text", "text": _SHELF_PROMPT},
                    ],
                }
            ],
        )
        raw = response.choices[0].message.content or ""
        if not raw:
            return []
        parsed = _parse_json(raw)
        if isinstance(parsed, list):
            return parsed
        return parsed.get("products", []) if isinstance(parsed, dict) else []
    except Exception as exc:
        logger.error("OpenAI vision API error: %s: %s", type(exc).__name__, exc)
        return []
