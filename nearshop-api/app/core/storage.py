"""File storage — Cloudflare R2 in production, local filesystem in development."""
import logging
import uuid
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointResolutionError, NoCredentialsError

from app.config import get_settings

logger = logging.getLogger(__name__)

# Absolute path to the local uploads directory (served as static files)
_LOCAL_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads"


def _r2_configured() -> bool:
    s = get_settings()
    return bool(
        s.R2_ENDPOINT_URL
        and s.R2_ACCESS_KEY_ID
        and s.R2_SECRET_ACCESS_KEY
        and s.R2_ACCESS_KEY_ID not in ("", "dev-placeholder")
        and s.R2_SECRET_ACCESS_KEY not in ("", "dev-placeholder")
    )


def _get_s3_client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.R2_ENDPOINT_URL,
        aws_access_key_id=s.R2_ACCESS_KEY_ID,
        aws_secret_access_key=s.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


async def upload_file(file: BinaryIO, folder: str, content_type: str = "image/jpeg") -> str:
    """Upload a file and return its public URL.

    Uses Cloudflare R2 when credentials are configured; falls back to local
    filesystem otherwise (development mode).
    """
    file_ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
    filename = f"{uuid.uuid4()}.{file_ext}"
    key = f"{folder}/{filename}"

    if _r2_configured():
        s = get_settings()
        try:
            client = _get_s3_client()
            client.upload_fileobj(
                file,
                s.R2_BUCKET_NAME,
                key,
                ExtraArgs={"ContentType": content_type},
            )
            return f"{s.R2_ENDPOINT_URL}/{s.R2_BUCKET_NAME}/{key}"
        except (ClientError, NoCredentialsError, EndpointResolutionError) as exc:
            logger.error("R2 upload failed, falling back to local storage: %s", exc)

    # ── Local fallback ────────────────────────────────────────────────────────
    dest_dir = _LOCAL_UPLOADS_DIR / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    read_fn = getattr(file, "read", None)
    if callable(read_fn):
        import inspect
        if inspect.iscoroutinefunction(read_fn):
            data = await read_fn()
        else:
            data = read_fn()
    else:
        data = file

    dest_path.write_bytes(data)
    logger.info("Saved file locally: %s", dest_path)
    return f"/static/uploads/{key}"


async def delete_file(url: str) -> None:
    if url.startswith("/static/uploads/"):
        rel = url.removeprefix("/static/uploads/")
        path = _LOCAL_UPLOADS_DIR / rel
        path.unlink(missing_ok=True)
        return

    if _r2_configured():
        s = get_settings()
        try:
            client = _get_s3_client()
            key = url.split(f"{s.R2_BUCKET_NAME}/")[-1]
            client.delete_object(Bucket=s.R2_BUCKET_NAME, Key=key)
        except Exception as exc:
            logger.warning("R2 delete failed: %s", exc)
