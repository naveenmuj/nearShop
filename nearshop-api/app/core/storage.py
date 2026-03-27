"""Primary media storage for NearShop.

Uses DigitalOcean Spaces as the default object store and falls back to the
local filesystem only when Spaces credentials are unavailable.
"""

from __future__ import annotations

import logging
import mimetypes
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO
from urllib.parse import urlparse

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointResolutionError, NoCredentialsError

from app.config import get_settings

logger = logging.getLogger(__name__)

_LOCAL_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads"
_SEGMENT_RE = re.compile(r"[^a-zA-Z0-9._-]+")
_PLACEHOLDER_VALUES = {"", "dev-placeholder", "change-me"}


@dataclass(slots=True)
class StoredObject:
    key: str
    url: str
    bucket: str
    provider: str


def _safe_segment(value: str | None, fallback: str) -> str:
    raw = (value or fallback).strip().strip("/")
    sanitized = _SEGMENT_RE.sub("-", raw).strip("-._")
    return sanitized or fallback


def _file_extension(content_type: str | None, filename: str | None = None) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext:
            return ext
    guessed = mimetypes.guess_extension(content_type or "") or ".jpg"
    return guessed.lstrip(".")


def _env_prefix() -> str:
    env = get_settings().APP_ENV.lower()
    if env.startswith("prod"):
        return "prod"
    if env.startswith("stag"):
        return "staging"
    return "dev"


def _spaces_settings() -> dict[str, str]:
    s = get_settings()
    endpoint = s.DO_SPACES_ENDPOINT or s.R2_ENDPOINT_URL
    access_key = s.DO_SPACES_ACCESS_KEY or s.R2_ACCESS_KEY_ID
    secret_key = s.DO_SPACES_SECRET_KEY or s.R2_SECRET_ACCESS_KEY
    bucket = s.DO_SPACES_BUCKET or s.R2_BUCKET_NAME
    region = s.DO_SPACES_REGION or "sfo3"

    public_base = (s.DO_SPACES_CDN_ENDPOINT or "").rstrip("/")
    if not public_base and endpoint and bucket:
        parsed = urlparse(endpoint)
        if parsed.netloc:
            public_base = f"{parsed.scheme or 'https'}://{bucket}.{parsed.netloc}"

    return {
        "endpoint": endpoint.rstrip("/") if endpoint else "",
        "access_key": access_key,
        "secret_key": secret_key,
        "bucket": bucket,
        "region": region,
        "public_base": public_base,
    }


def _spaces_configured() -> bool:
    cfg = _spaces_settings()
    required = [cfg["endpoint"], cfg["access_key"], cfg["secret_key"], cfg["bucket"], cfg["public_base"]]
    return all(value not in _PLACEHOLDER_VALUES for value in required)


def _get_s3_client():
    cfg = _spaces_settings()
    return boto3.client(
        "s3",
        endpoint_url=cfg["endpoint"],
        region_name=cfg["region"],
        aws_access_key_id=cfg["access_key"],
        aws_secret_access_key=cfg["secret_key"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def _public_url_for_key(key: str) -> str:
    cfg = _spaces_settings()
    return f"{cfg['public_base']}/{key.lstrip('/')}"


def _infer_entity(folder: str | None, entity_type: str | None, purpose: str | None) -> tuple[str, str]:
    if entity_type:
        return entity_type, purpose or "asset"

    folder_value = (folder or "general").lower()
    mapping = {
        "avatars": ("user", "avatar"),
        "shops": ("shop", "logo"),
        "products": ("product", "image"),
        "stories": ("story", "media"),
        "verification": ("verification", "document"),
        "documents": ("verification", "document"),
    }
    return mapping.get(folder_value, ("general", folder_value))


def _build_object_key(
    *,
    content_type: str | None,
    filename: str | None,
    folder: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    purpose: str | None = None,
    shop_id: str | None = None,
    product_id: str | None = None,
    document_type: str | None = None,
) -> str:
    env_prefix = _env_prefix()
    inferred_entity, inferred_purpose = _infer_entity(folder, entity_type, purpose)
    ext = _file_extension(content_type, filename)
    object_id = uuid.uuid4().hex

    if inferred_entity == "user":
        subject_id = _safe_segment(entity_id or user_id, "anonymous")
        subfolder = _safe_segment(inferred_purpose, "avatar")
        return f"{env_prefix}/users/{subject_id}/{subfolder}/{object_id}.{ext}"

    if inferred_entity == "shop":
        owner_segment = _safe_segment(user_id, "unassigned")
        shop_segment = _safe_segment(entity_id or shop_id, "draft")
        asset_segment = _safe_segment(inferred_purpose, "asset")
        if shop_segment == "draft":
            return f"{env_prefix}/users/{owner_segment}/shops/{shop_segment}/{asset_segment}/{object_id}.{ext}"
        return f"{env_prefix}/shops/{shop_segment}/branding/{asset_segment}/{object_id}.{ext}"

    if inferred_entity == "product":
        shop_segment = _safe_segment(shop_id, "draft-shop")
        product_segment = _safe_segment(entity_id or product_id, "draft")
        asset_segment = _safe_segment(inferred_purpose, "image")
        return f"{env_prefix}/shops/{shop_segment}/products/{product_segment}/{asset_segment}/{object_id}.{ext}"

    if inferred_entity == "story":
        shop_segment = _safe_segment(shop_id, "draft-shop")
        story_segment = _safe_segment(entity_id, "draft")
        return f"{env_prefix}/shops/{shop_segment}/stories/{story_segment}/{object_id}.{ext}"

    if inferred_entity == "verification":
        shop_segment = _safe_segment(shop_id or entity_id, "draft-shop")
        doc_segment = _safe_segment(document_type or inferred_purpose, "document")
        return f"{env_prefix}/shops/{shop_segment}/verification/{doc_segment}/{object_id}.{ext}"

    general_segment = _safe_segment(folder or inferred_purpose, "general")
    return f"{env_prefix}/general/{general_segment}/{object_id}.{ext}"


def store_bytes(
    data: bytes,
    *,
    content_type: str = "application/octet-stream",
    filename: str | None = None,
    folder: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    purpose: str | None = None,
    shop_id: str | None = None,
    product_id: str | None = None,
    document_type: str | None = None,
    object_key: str | None = None,
) -> StoredObject:
    key = object_key or _build_object_key(
        content_type=content_type,
        filename=filename,
        folder=folder,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        shop_id=shop_id,
        product_id=product_id,
        document_type=document_type,
    )

    if _spaces_configured():
        cfg = _spaces_settings()
        try:
            client = _get_s3_client()
            client.put_object(
                Bucket=cfg["bucket"],
                Key=key,
                Body=data,
                ContentType=content_type,
                ACL="public-read",
            )
            return StoredObject(
                key=key,
                url=_public_url_for_key(key),
                bucket=cfg["bucket"],
                provider="digitalocean_spaces",
            )
        except (ClientError, NoCredentialsError, EndpointResolutionError) as exc:
            logger.error("Spaces upload failed, falling back to local storage: %s", exc)

    dest_path = _LOCAL_UPLOADS_DIR / key
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(data)
    return StoredObject(
        key=key,
        url=f"/static/uploads/{key}",
        bucket="local",
        provider="local_filesystem",
    )


async def upload_file(
    file: BinaryIO,
    folder: str = "general",
    content_type: str = "image/jpeg",
    *,
    filename: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    purpose: str | None = None,
    shop_id: str | None = None,
    product_id: str | None = None,
    document_type: str | None = None,
) -> StoredObject:
    read_fn = getattr(file, "read", None)
    if callable(read_fn):
        import inspect

        if inspect.iscoroutinefunction(read_fn):
            data = await read_fn()
        else:
            data = read_fn()
    else:
        data = file

    return store_bytes(
        data,
        content_type=content_type,
        filename=filename,
        folder=folder,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        shop_id=shop_id,
        product_id=product_id,
        document_type=document_type,
    )


def upload_remote_file(
    source_url: str,
    *,
    timeout: int = 30,
    filename: str | None = None,
    folder: str | None = None,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    purpose: str | None = None,
    shop_id: str | None = None,
    product_id: str | None = None,
    document_type: str | None = None,
) -> StoredObject:
    response = requests.get(source_url, timeout=timeout)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "application/octet-stream").split(";")[0]
    remote_name = filename or Path(urlparse(source_url).path).name or None
    return store_bytes(
        response.content,
        content_type=content_type,
        filename=remote_name,
        folder=folder,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        shop_id=shop_id,
        product_id=product_id,
        document_type=document_type,
    )


def _extract_object_key(url: str) -> str | None:
    if url.startswith("/static/uploads/"):
        return url.removeprefix("/static/uploads/")

    cfg = _spaces_settings()
    public_base = cfg["public_base"].rstrip("/")
    if public_base and url.startswith(public_base + "/"):
        return url[len(public_base) + 1 :]

    endpoint = cfg["endpoint"].rstrip("/")
    if endpoint and cfg["bucket"]:
        endpoint_style_prefix = f"{endpoint}/{cfg['bucket']}/"
        if url.startswith(endpoint_style_prefix):
            return url[len(endpoint_style_prefix) :]

    parsed = urlparse(url)
    if parsed.netloc and cfg["bucket"] and parsed.netloc.startswith(f"{cfg['bucket']}."):
        return parsed.path.lstrip("/")

    return None


async def delete_file(url: str) -> None:
    key = _extract_object_key(url)
    if not key:
        return

    if url.startswith("/static/uploads/"):
        (_LOCAL_UPLOADS_DIR / key).unlink(missing_ok=True)
        return

    if _spaces_configured():
        cfg = _spaces_settings()
        try:
            client = _get_s3_client()
            client.delete_object(Bucket=cfg["bucket"], Key=key)
        except Exception as exc:  # pragma: no cover - best effort cleanup
            logger.warning("Spaces delete failed: %s", exc)
