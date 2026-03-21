from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.products.models import Category


async def get_categories(db: AsyncSession) -> list[Category]:
    """List all active categories."""
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)
        .order_by(Category.display_order.asc().nulls_last(), Category.name.asc())
    )
    return list(result.scalars().all())


async def get_category(db: AsyncSession, slug: str) -> Category:
    """Get a category by slug."""
    result = await db.execute(
        select(Category).where(Category.slug == slug, Category.is_active == True)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category not found")
    return category
