from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager

from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.core.geo import within_radius
from app.products.models import Product, PriceHistory
from app.products.schemas import ProductCreate, ProductUpdate
from app.shops.models import Shop


async def _verify_shop_ownership(
    db: AsyncSession, shop_id: UUID, owner_id: UUID
) -> Shop:
    """Verify that the user owns the shop."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("Shop not found")
    if shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this shop")
    return shop


async def create_product(
    db: AsyncSession,
    shop_id: UUID,
    owner_id: UUID,
    data: ProductCreate,
) -> Product:
    """Create a new product, verifying shop ownership."""
    shop = await _verify_shop_ownership(db, shop_id, owner_id)

    product = Product(
        shop_id=shop_id,
        name=data.name,
        description=data.description,
        price=data.price,
        compare_price=data.compare_price,
        category=data.category,
        subcategory=data.subcategory,
        attributes=data.attributes,
        tags=data.tags,
        images=data.images,
        is_featured=data.is_featured or False,
        barcode=data.barcode,
    )
    db.add(product)

    # Increment shop product count
    shop.total_products = (shop.total_products or 0) + 1

    await db.flush()
    await db.refresh(product)
    return product


async def update_product(
    db: AsyncSession,
    product_id: UUID,
    owner_id: UUID,
    data: ProductUpdate,
) -> Product:
    """Update a product, verifying ownership chain (product -> shop -> owner)."""
    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    if product.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this product")

    if data.price is not None and data.price != float(product.price):
        history = PriceHistory(
            product_id=product.id,
            old_price=product.price,
            new_price=data.price,
            changed_by=owner_id,
        )
        db.add(history)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    await db.flush()
    await db.refresh(product)
    return product


async def delete_product(
    db: AsyncSession,
    product_id: UUID,
    owner_id: UUID,
) -> Product:
    """Soft delete a product by setting is_available to false."""
    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    if product.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this product")

    product.is_available = False
    await db.flush()
    await db.refresh(product)
    return product


async def get_product(db: AsyncSession, product_id: UUID) -> Product:
    """Get a product by ID with shop info."""
    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    return product


async def search_products(
    db: AsyncSession,
    query: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 10.0,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Product], int]:
    """Search products with FTS, geo filtering, and price range."""
    base_query = (
        select(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .options(contains_eager(Product.shop))
        .where(
            and_(
                Product.is_available == True,
                Shop.is_active == True,
            )
        )
    )

    # Full-text search + ILIKE fallback for partial/prefix queries
    if query:
        ts_query = func.plainto_tsquery("english", query)
        ts_vector = func.to_tsvector(
            "english",
            func.concat(
                Product.name, " ",
                func.coalesce(Product.description, ""), " ",
                func.coalesce(Product.category, ""), " ",
                func.coalesce(cast(Product.tags, String), ""),
            ),
        )
        like_pattern = f"%{query}%"
        base_query = base_query.where(
            or_(
                ts_vector.op("@@")(ts_query),
                Product.name.ilike(like_pattern),
                Product.category.ilike(like_pattern),
                Product.description.ilike(like_pattern),
            )
        )

    # Geo filter
    if lat is not None and lng is not None:
        base_query = base_query.where(
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km)
        )

    # Category filter (case-insensitive)
    if category:
        base_query = base_query.where(func.lower(Product.category) == category.lower())

    # Price range filters
    if min_price is not None:
        base_query = base_query.where(Product.price >= min_price)
    if max_price is not None:
        base_query = base_query.where(Product.price <= max_price)

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sorting
    if sort_by == "price_asc":
        base_query = base_query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        base_query = base_query.order_by(Product.price.desc())
    elif sort_by == "newest":
        base_query = base_query.order_by(Product.created_at.desc())
    elif sort_by == "popular":
        base_query = base_query.order_by(Product.view_count.desc())
    else:
        base_query = base_query.order_by(Product.created_at.desc())

    # Pagination
    offset = (page - 1) * per_page
    base_query = base_query.offset(offset).limit(per_page)

    result = await db.execute(base_query)
    products = list(result.unique().scalars().all())

    return products, total


async def toggle_availability(
    db: AsyncSession,
    product_id: UUID,
    owner_id: UUID,
) -> Product:
    """Toggle product availability."""
    result = await db.execute(
        select(Product).options(joinedload(Product.shop)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    if product.shop.owner_id != owner_id:
        raise ForbiddenError("You do not own this product")

    product.is_available = not product.is_available
    await db.flush()
    await db.refresh(product)
    return product


async def get_shop_products(
    db: AsyncSession,
    shop_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Product], int]:
    """Get all available products for a shop with pagination."""
    base_query = select(Product).where(
        and_(
            Product.shop_id == shop_id,
            Product.is_available == True,
        )
    )

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    base_query = base_query.order_by(Product.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(base_query)
    products = list(result.scalars().all())

    return products, total
