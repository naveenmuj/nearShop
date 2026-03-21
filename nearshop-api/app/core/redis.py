import redis.asyncio as aioredis
from typing import AsyncGenerator

from app.config import get_settings

settings = get_settings()

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL, decode_responses=True
)


def get_redis_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=redis_pool)


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()
