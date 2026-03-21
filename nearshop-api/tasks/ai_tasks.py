import logging
from typing import Optional

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.generate_embeddings", bind=True, max_retries=3)
def generate_embeddings(self, text: str, model: str = "default") -> dict:
    """Generate vector embeddings for the given text.

    Stub implementation -- logs the intended operation and returns a
    placeholder vector.
    """
    logger.info(
        "generate_embeddings: text=%r (len=%d) model=%s",
        text[:80],
        len(text),
        model,
    )
    return {
        "status": "stub",
        "text_length": len(text),
        "model": model,
        "embedding_dim": 1536,
    }


@celery_app.task(name="tasks.catalog_product", bind=True, max_retries=3)
def catalog_product(self, product_id: str, image_url: Optional[str] = None) -> dict:
    """Use AI to enrich a product listing (categorise, tag, describe).

    Stub implementation -- logs the intended operation.
    """
    logger.info(
        "catalog_product: product_id=%s image_url=%s", product_id, image_url
    )
    return {
        "status": "stub",
        "product_id": product_id,
        "image_url": image_url,
    }


@celery_app.task(name="tasks.generate_product_description", bind=True, max_retries=3)
def generate_product_description(
    self, product_id: str, product_name: str, category: Optional[str] = None
) -> dict:
    """Generate an AI-powered product description.

    Stub implementation -- logs the intended operation.
    """
    logger.info(
        "generate_product_description: product_id=%s name=%r category=%s",
        product_id,
        product_name,
        category,
    )
    return {
        "status": "stub",
        "product_id": product_id,
        "product_name": product_name,
    }
