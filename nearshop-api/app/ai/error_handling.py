"""Helpers for classifying OpenAI failures and providing safe fallbacks."""

from __future__ import annotations

from typing import Any

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError as OpenAIBadRequestError,
    PermissionDeniedError,
    RateLimitError as OpenAIRateLimitError,
)


def classify_openai_error(exc: Exception) -> dict[str, Any]:
    """Convert OpenAI SDK exceptions into a stable app-level error payload."""
    if isinstance(exc, AuthenticationError):
        return {
            "status_code": 503,
            "code": "ai_auth_error",
            "message": "AI service authentication failed. Check the OpenAI configuration.",
            "retryable": False,
        }
    if isinstance(exc, PermissionDeniedError):
        return {
            "status_code": 503,
            "code": "ai_permission_error",
            "message": "AI service permissions are not sufficient for this request.",
            "retryable": False,
        }
    if isinstance(exc, OpenAIRateLimitError):
        message = str(exc).lower()
        quota_hit = any(token in message for token in ("quota", "billing", "insufficient_quota", "credits"))
        return {
            "status_code": 429 if not quota_hit else 503,
            "code": "ai_quota_exceeded" if quota_hit else "ai_rate_limited",
            "message": (
                "AI quota is exhausted for the current OpenAI account."
                if quota_hit
                else "AI service is temporarily rate limited. Please try again shortly."
            ),
            "retryable": not quota_hit,
        }
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return {
            "status_code": 503,
            "code": "ai_unreachable",
            "message": "AI service is temporarily unreachable. Please try again.",
            "retryable": True,
        }
    if isinstance(exc, OpenAIBadRequestError):
        raw_message = str(exc).lower()
        image_error = "image" in raw_message and any(
            token in raw_message for token in ("unsupported", "parse", "invalid image", "corrupt")
        )
        return {
            "status_code": 400 if image_error else 502,
            "code": "invalid_image" if image_error else "ai_bad_request",
            "message": (
                "The selected image could not be analysed. Try another clear product photo."
                if image_error
                else "AI request was rejected by the provider."
            ),
            "retryable": False,
        }
    if isinstance(exc, APIError):
        return {
            "status_code": 502,
            "code": "ai_provider_error",
            "message": "AI service returned an unexpected provider error.",
            "retryable": True,
        }
    return {
        "status_code": 500,
        "code": "ai_unknown_error",
        "message": "AI service failed unexpectedly.",
        "retryable": False,
    }


def build_shop_description_fallback(shop_name: str, category: str, keywords: str) -> str:
    """Generate a deterministic description when AI is unavailable."""
    safe_name = (shop_name or "This shop").strip()
    safe_category = (category or "local").strip().lower()
    extra = (keywords or "").strip()

    first = f"{safe_name} is a trusted {safe_category} shop serving nearby customers with quality products and friendly service."
    second = "Browse the latest items, discover everyday essentials, and shop locally with confidence."
    if extra:
        second = f"Known for {extra[:120]}, it offers a convenient local shopping experience for the community."
    return f"{first} {second}"
