import logging
import asyncio
import hashlib
import json
from typing import Optional
from uuid import UUID

from openai import OpenAI
from sqlalchemy import select

from tasks.celery_app import celery_app
from app.config import get_settings
from app.core.database import async_session_factory
from app.products.models import Product

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _local_embedding(text: str, dim: int = 256) -> list[float]:
    """Deterministic fallback embedding for offline/background resilience."""
    seed = hashlib.sha256((text or "").encode("utf-8")).digest()
    values: list[float] = []
    counter = 0
    while len(values) < dim:
        block = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        for b in block:
            values.append((b / 127.5) - 1.0)
            if len(values) >= dim:
                break
        counter += 1
    return values


def _openai_client() -> OpenAI | None:
    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


async def _get_product(product_id: UUID) -> Product | None:
    async with async_session_factory() as db:
        result = await db.execute(select(Product).where(Product.id == product_id))
        return result.scalar_one_or_none()


async def _update_product_ai_fields(product_id: UUID, *, description: str | None = None, tags: list[str] | None = None):
    async with async_session_factory() as db:
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
        if not product:
            return False
        if description:
            product.description = description
        if tags is not None:
            product.tags = tags[:20]
        product.ai_generated = True
        await db.commit()
        return True


@celery_app.task(name="tasks.generate_embeddings", bind=True, max_retries=3)
def generate_embeddings(self, text: str, model: str = "default") -> dict:
    """Generate vector embeddings for the given text.
    """
    text = text or ""
    client = _openai_client()
    if client is None:
        emb = _local_embedding(text)
        return {
            "status": "completed",
            "source": "local_fallback",
            "text_length": len(text),
            "model": "deterministic-hash-v1",
            "embedding_dim": len(emb),
        }

    requested_model = "text-embedding-3-small" if model == "default" else model
    response = client.embeddings.create(model=requested_model, input=text)
    emb = response.data[0].embedding if response.data else []
    return {
        "status": "completed",
        "source": "openai",
        "text_length": len(text),
        "model": requested_model,
        "embedding_dim": len(emb),
    }


@celery_app.task(name="tasks.catalog_product", bind=True, max_retries=3)
def catalog_product(self, product_id: str, image_url: Optional[str] = None) -> dict:
    """Use AI to enrich a product listing (categorise, tag, describe).
    """
    try:
        product_uuid = UUID(product_id)
    except ValueError:
        return {"status": "invalid_product_id", "product_id": product_id}

    product = _run_async(_get_product(product_uuid))
    if not product:
        return {"status": "not_found", "product_id": product_id}

    base_tokens = [
        *(product.name or "").lower().replace("/", " ").split(),
        *((product.category or "").lower().split()),
    ]
    tags = sorted({t.strip(" ,.-") for t in base_tokens if len(t.strip(" ,.-")) >= 3})[:8]

    description = product.description
    client = _openai_client()
    if client:
        prompt = (
            "Generate compact e-commerce metadata JSON with keys: description, tags. "
            f"Product name: {product.name}. Category: {product.category or 'general'}. "
            f"Current description: {product.description or 'none'}."
        )
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            payload = response.choices[0].message.content or "{}"
            parsed = json.loads(payload)
            description = parsed.get("description") or description
            ai_tags = parsed.get("tags") or []
            if isinstance(ai_tags, list):
                tags = [str(t).strip().lower() for t in ai_tags if str(t).strip()][:12] or tags
        except Exception as exc:
            logger.warning("catalog_product AI enrichment failed for %s: %s", product_id, exc)

    _run_async(_update_product_ai_fields(product_uuid, description=description, tags=tags))
    return {
        "status": "completed",
        "product_id": product_id,
        "image_url": image_url,
        "tags": tags,
        "description_updated": bool(description),
    }


@celery_app.task(name="tasks.generate_product_description", bind=True, max_retries=3)
def generate_product_description(
    self, product_id: str, product_name: str, category: Optional[str] = None
) -> dict:
    """Generate an AI-powered product description.
    """
    client = _openai_client()
    if client:
        prompt = (
            "Write a concise, conversion-focused product description in 2-3 lines. "
            f"Product: {product_name}. Category: {category or 'general'}"
        )
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
            )
            description = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning("generate_product_description AI failed for %s: %s", product_id, exc)
            description = ""
    else:
        description = (
            f"{product_name} is a quality {category or 'everyday'} product from a trusted local seller. "
            "Fast local delivery and great value for daily use."
        )

    updated = False
    try:
        updated = _run_async(_update_product_ai_fields(UUID(product_id), description=description))
    except Exception:
        updated = False

    return {
        "status": "completed",
        "product_id": product_id,
        "product_name": product_name,
        "description": description,
        "updated": updated,
    }
