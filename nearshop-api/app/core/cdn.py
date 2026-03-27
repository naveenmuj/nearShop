"""CDN URL rewriting helper.

When FEATURE_CDN_IMAGES is enabled and CDN_BASE_URL is configured, rewrites
storage origin URLs to CDN edge URLs for faster image delivery.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.config import get_settings


# Matches legacy R2 URLs in both formats:
#   https://<account>.r2.cloudflarestorage.com/<bucket>/<path>
#   <R2_ENDPOINT_URL>/<bucket>/<path>
_R2_HOST_RE = re.compile(r"^[a-f0-9]+\.r2\.cloudflarestorage\.com$")


def cdn_url(original_url: str | None) -> str | None:
    """Rewrite a single storage origin URL to a CDN URL.

    Returns *None* when *original_url* is ``None``.  When the CDN feature is
    disabled or the URL does not look like an R2 URL the original value is
    returned unchanged.
    """
    if original_url is None:
        return None

    settings = get_settings()

    if not settings.FEATURE_CDN_IMAGES or not settings.CDN_BASE_URL:
        return original_url

    cdn_base = settings.CDN_BASE_URL.rstrip("/")

    # --- DigitalOcean Spaces public endpoint ---
    if settings.DO_SPACES_CDN_ENDPOINT:
        spaces_prefix = settings.DO_SPACES_CDN_ENDPOINT.rstrip("/") + "/"
        if original_url.startswith(spaces_prefix):
            remainder = original_url[len(spaces_prefix):]
            return f"{cdn_base}/{remainder}"

    # --- Try matching the endpoint-style URL first ---
    # e.g. https://abc123.r2.cloudflarestorage.com/nearshop-media/shops/42/img.jpg
    #  or  R2_ENDPOINT_URL/nearshop-media/shops/42/img.jpg
    if settings.R2_ENDPOINT_URL:
        r2_prefix = settings.R2_ENDPOINT_URL.rstrip("/") + "/"
        if original_url.startswith(r2_prefix):
            remainder = original_url[len(r2_prefix):]
            # Strip the bucket name prefix if present
            bucket = settings.R2_BUCKET_NAME
            if remainder.startswith(bucket + "/"):
                remainder = remainder[len(bucket) + 1:]
            return f"{cdn_base}/{remainder}"

    # --- Try matching the canonical <account>.r2.cloudflarestorage.com host ---
    parsed = urlparse(original_url)
    if _R2_HOST_RE.match(parsed.hostname or ""):
        # Path is /<bucket>/<object-key>
        path = parsed.path.lstrip("/")
        bucket = settings.R2_BUCKET_NAME
        if path.startswith(bucket + "/"):
            path = path[len(bucket) + 1:]
        return f"{cdn_base}/{path}"

    # URL doesn't look like a known storage origin — return as-is.
    return original_url


def cdn_urls(images: list[str] | None) -> list[str]:
    """Rewrite a list of image URLs through :func:`cdn_url`.

    Returns an empty list when *images* is ``None``.
    """
    if images is None:
        return []
    return [url for url in (cdn_url(u) for u in images) if url is not None]
