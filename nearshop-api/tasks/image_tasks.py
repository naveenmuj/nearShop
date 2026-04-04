import logging
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.storage import store_bytes
from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.resize_image", bind=True, max_retries=3)
def resize_image(self, image_path: str, width: int, height: int) -> dict:
    """Resize an image to the given dimensions.
    """
    src = Path(image_path)
    if not src.exists():
        return {"status": "missing_source", "image_path": image_path}

    with Image.open(src) as img:
        resized = img.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        suffix = src.suffix or ".jpg"
        out_path = src.with_name(f"{src.stem}_{width}x{height}{suffix}")
        resized.save(out_path, quality=90, optimize=True)

    return {
        "status": "completed",
        "image_path": image_path,
        "output_path": str(out_path),
        "width": width,
        "height": height,
    }


@celery_app.task(name="tasks.generate_thumbnail", bind=True, max_retries=3)
def generate_thumbnail(self, image_path: str, size: int = 200) -> dict:
    """Generate a square thumbnail for the given image.
    """
    src = Path(image_path)
    if not src.exists():
        return {"status": "missing_source", "image_path": image_path}

    with Image.open(src) as img:
        thumb = img.convert("RGB")
        thumb.thumbnail((size, size), Image.Resampling.LANCZOS)
        out_path = src.with_name(f"{src.stem}_thumb_{size}.jpg")
        thumb.save(out_path, format="JPEG", quality=88, optimize=True)

    return {
        "status": "completed",
        "image_path": image_path,
        "thumbnail_path": str(out_path),
        "thumbnail_size": size,
    }


@celery_app.task(name="tasks.upload_to_r2", bind=True, max_retries=3)
def upload_to_r2(self, local_path: str, r2_key: str) -> dict:
    """Upload a local file to Cloudflare R2.
    """
    src = Path(local_path)
    if not src.exists():
        return {"status": "missing_source", "local_path": local_path, "r2_key": r2_key}

    data = src.read_bytes()
    content_type = "image/jpeg"
    if src.suffix.lower() == ".png":
        content_type = "image/png"
    elif src.suffix.lower() == ".webp":
        content_type = "image/webp"

    stored = store_bytes(
        data=data,
        content_type=content_type,
        filename=src.name,
        object_key=r2_key,
    )

    return {
        "status": "completed",
        "local_path": local_path,
        "r2_key": r2_key,
        "url": stored.url,
        "provider": stored.provider,
    }
