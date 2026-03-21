import random

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import within_radius
from app.products.models import Product, ProductEmbedding
from app.shops.models import Shop


async def generate_image_embedding(image_url: str) -> list[float]:
    """Generate a 512-dim embedding using Open CLIP. Stub for now -- returns placeholder."""
    # In production, load CLIP model and process image
    # For MVP, return a placeholder embedding
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

    NOTE: With JSONB embeddings, vector similarity search is not supported
    at the database level. This returns nearby products that have embeddings
    as a placeholder until a proper vector search solution is integrated.
    """
    stmt = (
        select(Product)
        .join(ProductEmbedding, ProductEmbedding.product_id == Product.id)
        .join(Shop, Shop.id == Product.shop_id)
        .where(Product.is_available == True)  # noqa: E712
        .where(Shop.is_active == True)  # noqa: E712
        .where(ProductEmbedding.image_embedding.isnot(None))
        .where(within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km))
        .order_by(Product.view_count.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    products = list(result.scalars().all())
    return [{"product": p, "similarity": 0.0} for p in products]
