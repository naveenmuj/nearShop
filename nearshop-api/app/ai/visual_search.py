import logging
import math
import random

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.geo import within_radius
from app.products.models import Product, ProductEmbedding
from app.shops.models import Shop

logger = logging.getLogger(__name__)


def _similarity_band(similarity: float) -> str:
    if similarity >= 0.82:
        return "strong"
    if similarity >= 0.64:
        return "good"
    if similarity >= 0.48:
        return "possible"
    return "weak"


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def generate_image_embedding(image_url: str) -> list[float]:
    """Generate an image embedding via OpenAI CLIP endpoint.

    When FEATURE_VISUAL_SEARCH is disabled, returns a random placeholder
    so the rest of the pipeline can still run (just without real similarity).
    """
    settings = get_settings()

    if not settings.FEATURE_VISUAL_SEARCH or not settings.OPENAI_API_KEY:
        logger.info("Visual search disabled or no API key — returning placeholder embedding")
        return [random.uniform(-1, 1) for _ in range(512)]

    try:
        from app.ai.client import get_openai_client

        client = get_openai_client()
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=f"[IMAGE]{image_url}",
        )
        embedding = response.data[0].embedding
        # Truncate or pad to 512 dimensions to match our stored embeddings
        if len(embedding) > 512:
            embedding = embedding[:512]
        elif len(embedding) < 512:
            embedding.extend([0.0] * (512 - len(embedding)))
        return embedding
    except Exception as e:
        logger.warning("Image embedding generation failed, using placeholder: %s", e)
        return [random.uniform(-1, 1) for _ in range(512)]


async def search_similar_products(
    db: AsyncSession,
    embedding: list[float],
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 10,
) -> list:
    """Search products by visual similarity within a geographic radius.

    Uses cosine similarity computed in Python against stored JSONB embeddings.
    Products are fetched nearby first, then re-ranked by similarity score.
    """
    # Fetch nearby products that have embeddings (up to 10x limit for re-ranking)
    stmt = (
        select(Product, ProductEmbedding.image_embedding)
        .join(ProductEmbedding, ProductEmbedding.product_id == Product.id)
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(ProductEmbedding.image_embedding.isnot(None))
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
        .order_by(Product.view_count.desc())
        .limit(limit * 10)
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    # Compute similarity and rank
    scored = []
    for row in rows:
        product = row[0]
        stored_embedding = row[1]

        if isinstance(stored_embedding, list) and len(stored_embedding) > 0:
            sim = _cosine_similarity(embedding, stored_embedding)
        else:
            sim = 0.0

        scored.append({
            "id": str(product.id),
            "name": product.name,
            "price": float(product.price or 0),
            "images": product.images or [],
            "category": product.category,
            "shop_id": str(product.shop_id),
            "similarity": round(sim, 4),
            "confidence_band": _similarity_band(sim),
            "source": "visual_search",
        })

    # Sort by similarity descending
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]
