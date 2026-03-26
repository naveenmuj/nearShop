"""
Redis-based caching for AI recommendations.

Keys follow the pattern:
    nearshop:recs:{rec_type}:{user_id}:{lat_round}:{lng_round}

Lat/lng are rounded to 2 decimal places so that locations within ~1 km share
the same cache entry.
"""

import json
import logging
from typing import Any, Optional

import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    """Return a lazily-initialised async Redis client."""
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
    return _redis_client


def _build_key(rec_type: str, user_id: str, lat: float, lng: float) -> str:
    lat_round = f"{lat:.2f}"
    lng_round = f"{lng:.2f}"
    return f"nearshop:recs:{rec_type}:{user_id}:{lat_round}:{lng_round}"


async def get_cached_recommendations(
    user_id: str,
    rec_type: str,
    lat: float,
    lng: float,
) -> Optional[Any]:
    """Return cached recommendation data, or ``None`` on miss / error."""
    settings = get_settings()
    if not settings.FEATURE_REDIS_CACHE:
        return None

    try:
        client = _get_redis()
        key = _build_key(rec_type, user_id, lat, lng)
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.warning("Redis cache read failed for user %s", user_id, exc_info=True)
        return None


async def set_cached_recommendations(
    user_id: str,
    rec_type: str,
    lat: float,
    lng: float,
    data: Any,
    ttl: Optional[int] = None,
) -> bool:
    """Store recommendation data in Redis.  Returns ``True`` on success."""
    settings = get_settings()
    if not settings.FEATURE_REDIS_CACHE:
        return False

    if ttl is None:
        ttl = settings.RECOMMENDATION_CACHE_TTL

    try:
        client = _get_redis()
        key = _build_key(rec_type, user_id, lat, lng)
        await client.set(key, json.dumps(data), ex=ttl)
        return True
    except Exception:
        logger.warning("Redis cache write failed for user %s", user_id, exc_info=True)
        return False


async def invalidate_recommendations(user_id: Optional[str] = None) -> bool:
    """Delete cached recommendations.

    If *user_id* is given only that user's entries are removed; otherwise the
    entire ``nearshop:recs:*`` keyspace is flushed.

    Returns ``True`` when at least one key was deleted (or the operation
    completed without error).
    """
    settings = get_settings()
    if not settings.FEATURE_REDIS_CACHE:
        return False

    try:
        client = _get_redis()
        if user_id is not None:
            pattern = f"nearshop:recs:*:{user_id}:*"
        else:
            pattern = "nearshop:recs:*"

        cursor: int = 0
        deleted = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match=pattern, count=200)
            if keys:
                deleted += await client.delete(*keys)
            if cursor == 0:
                break

        logger.info("Invalidated %d recommendation cache entries", deleted)
        return True
    except Exception:
        logger.warning("Redis cache invalidation failed", exc_info=True)
        return False
