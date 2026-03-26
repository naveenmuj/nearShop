"""Tracked OpenAI wrapper — automatically logs every API call to the database.

Usage:
    from app.ai.tracker import tracked_completion, tracked_chat
    result = await tracked_chat(messages=[...], model="gpt-4o-mini", feature="sentiment")
"""
import logging
import time
from typing import Optional
from uuid import UUID

from app.ai.client import get_openai_client
from app.core.database import get_async_session

logger = logging.getLogger(__name__)

# ── Pricing per 1M tokens (as of March 2026) ────────────────────────────────
_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    # fallback
    "default": {"input": 1.00, "output": 3.00},
}


def _calc_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost in USD from token counts."""
    pricing = _PRICING.get(model, _PRICING["default"])
    cost = (prompt_tokens * pricing["input"] + completion_tokens * pricing["output"]) / 1_000_000
    return round(cost, 6)


async def _log_usage(
    feature: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    cost_usd: float,
    response_time_ms: int,
    status: str = "success",
    error_message: Optional[str] = None,
    user_id: Optional[UUID] = None,
    shop_id: Optional[UUID] = None,
    endpoint: Optional[str] = None,
    has_image: bool = False,
    request_metadata: Optional[dict] = None,
):
    """Persist usage record to DB in background — never blocks the caller."""
    try:
        from app.ai.models import AIUsageLog
        async with get_async_session() as session:
            log = AIUsageLog(
                user_id=user_id,
                shop_id=shop_id,
                feature=feature,
                endpoint=endpoint,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
                response_time_ms=response_time_ms,
                status=status,
                error_message=error_message,
                has_image=has_image,
                request_metadata=request_metadata,
            )
            session.add(log)
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to log AI usage: %s", exc)


async def tracked_chat(
    *,
    messages: list,
    model: str = "gpt-4o-mini",
    feature: str,
    max_tokens: int = 500,
    temperature: float = 0.7,
    response_format: Optional[dict] = None,
    timeout: Optional[int] = None,
    user_id: Optional[UUID] = None,
    shop_id: Optional[UUID] = None,
    endpoint: Optional[str] = None,
    has_image: bool = False,
    request_metadata: Optional[dict] = None,
):
    """Drop-in replacement for client.chat.completions.create() that logs usage."""
    client = get_openai_client()
    start = time.perf_counter()
    status = "success"
    error_msg = None
    prompt_tokens = completion_tokens = total_tokens = 0

    kwargs = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    if timeout:
        kwargs["timeout"] = timeout

    try:
        response = await client.chat.completions.create(**kwargs)
        usage = response.usage
        if usage:
            prompt_tokens = usage.prompt_tokens or 0
            completion_tokens = usage.completion_tokens or 0
            total_tokens = usage.total_tokens or 0
        return response
    except Exception as exc:
        status = "error"
        error_msg = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        cost = _calc_cost(model, prompt_tokens, completion_tokens)
        # Fire-and-forget logging
        try:
            await _log_usage(
                feature=feature,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost,
                response_time_ms=elapsed_ms,
                status=status,
                error_message=error_msg,
                user_id=user_id,
                shop_id=shop_id,
                endpoint=endpoint,
                has_image=has_image,
                request_metadata=request_metadata,
            )
        except Exception:
            pass
