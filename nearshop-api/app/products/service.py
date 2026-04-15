from typing import Optional
from uuid import UUID

from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.geo import within_radius
from app.products.models import PriceHistory, Product
from app.products.schemas import ProductCreate, ProductUpdate
from app.ranking.service import RankingContext, build_user_preference_profile, rank_products
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
    radius_km: Optional[float] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    user_id: UUID | None = None,
) -> tuple[list[Product], int]:
    """Search products with FTS, geo filtering, and shared ranking."""
    from app.core.geo import haversine_distance_km as _haversine

    base_query = (
        select(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .options(
            joinedload(Product.shop).load_only(
                Shop.id,
                Shop.name,
                Shop.slug,
                Shop.logo_url,
                Shop.latitude,
                Shop.longitude,
                Shop.avg_rating,
                Shop.score,
            )
        )
        .where(
            and_(
                Product.is_available == True,
                Shop.is_active == True,
            )
        )
    )

    if query:
        ts_query = func.plainto_tsquery("english", query)
        ts_vector = func.to_tsvector(
            "english",
            func.concat(
                Product.name,
                " ",
                func.coalesce(Product.description, ""),
                " ",
                func.coalesce(Product.category, ""),
                " ",
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

    if lat is not None and lng is not None and radius_km is not None:
        base_query = base_query.where(
            within_radius(Shop.latitude, Shop.longitude, lat, lng, radius_km)
        )

    if category:
        base_query = base_query.where(func.lower(Product.category) == category.lower())
    if min_price is not None:
        base_query = base_query.where(Product.price >= min_price)
    if max_price is not None:
        base_query = base_query.where(Product.price <= max_price)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    should_rank = sort_by not in {"price_asc", "price_desc", "popular"} and (
        bool(query) or user_id is not None or (lat is not None and lng is not None)
    )

    if sort_by == "price_asc":
        base_query = base_query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        base_query = base_query.order_by(Product.price.desc())
    elif sort_by == "popular":
        base_query = base_query.order_by(
            Product.view_count.desc(),
            Product.wishlist_count.desc(),
        )
    elif not should_rank and lat is not None and lng is not None:
        distance = _haversine(lat, lng, Shop.latitude, Shop.longitude)
        base_query = base_query.order_by(distance, Product.created_at.desc())
    elif not should_rank:
        base_query = base_query.order_by(Product.created_at.desc())

    if should_rank:
        candidate_limit = min(max(per_page * 5, 80), 250)
        result = await db.execute(base_query.limit(candidate_limit))
        candidates = list(result.unique().scalars().all())
        profile = await build_user_preference_profile(db, user_id)
        ranked = rank_products(
            candidates,
            profile,
            RankingContext(
                lat=lat,
                lng=lng,
                query=query,
                radius_km=radius_km,
                surface="product_search",
            ),
        )
        products = ranked[offset : offset + per_page]
    else:
        paged_query = base_query.offset(offset).limit(per_page)
        result = await db.execute(paged_query)
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
    include_hidden: bool = False,
) -> tuple[list[Product], int]:
    """Get products for a shop with pagination.

    include_hidden=True returns both live and hidden products.
    """
    filters = [Product.shop_id == shop_id]
    if not include_hidden:
        filters.append(Product.is_available == True)

    base_query = select(Product).where(and_(*filters))

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    paged_query = base_query.order_by(Product.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(paged_query)
    products = list(result.scalars().all())

    return products, total
