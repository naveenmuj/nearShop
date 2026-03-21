"""Shared async OpenAI client factory.

All AI modules import get_openai_client() from here so the API key
is read exactly once from settings and never hardcoded.
"""
import logging

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    """Return a cached AsyncOpenAI client initialised from settings."""
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    api_key = settings.OPENAI_API_KEY

    if not api_key or api_key in ("", "dev-placeholder", "your-openai-api-key"):
        logger.error(
            "OPENAI_API_KEY is not configured. "
            "Add it to nearshop-api/.env and restart the server."
        )

    _client = AsyncOpenAI(api_key=api_key)
    return _client
