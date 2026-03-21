import logging

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.resize_image", bind=True, max_retries=3)
def resize_image(self, image_path: str, width: int, height: int) -> dict:
    """Resize an image to the given dimensions.

    Stub implementation -- logs the intended operation and returns metadata.
    """
    logger.info(
        "resize_image: would resize %s to %dx%d", image_path, width, height
    )
    return {
        "status": "stub",
        "image_path": image_path,
        "width": width,
        "height": height,
    }


@celery_app.task(name="tasks.generate_thumbnail", bind=True, max_retries=3)
def generate_thumbnail(self, image_path: str, size: int = 200) -> dict:
    """Generate a square thumbnail for the given image.

    Stub implementation -- logs the intended operation and returns metadata.
    """
    logger.info(
        "generate_thumbnail: would create %dx%d thumbnail for %s",
        size,
        size,
        image_path,
    )
    return {
        "status": "stub",
        "image_path": image_path,
        "thumbnail_size": size,
    }


@celery_app.task(name="tasks.upload_to_r2", bind=True, max_retries=3)
def upload_to_r2(self, local_path: str, r2_key: str) -> dict:
    """Upload a local file to Cloudflare R2.

    Stub implementation -- logs the intended operation and returns the
    destination key.
    """
    logger.info(
        "upload_to_r2: would upload %s -> R2 key %s", local_path, r2_key
    )
    return {
        "status": "stub",
        "local_path": local_path,
        "r2_key": r2_key,
    }
