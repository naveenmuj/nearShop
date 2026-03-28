from uuid import UUID

from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError
from app.products.models import Product, Wishlist
from app.shops.models import Shop


async def add_to_wishlist(
    db: AsyncSession,
    user_id: UUID,
    product_id: UUID,
) -> Wishlist:
    """Add a product to the user's wishlist."""
    # Verify product exists
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    # Check if already in wishlist
    existing = await db.execute(
        select(Wishlist).where(
            and_(Wishlist.user_id == user_id, Wishlist.product_id == product_id)
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestError("Product already in wishlist")

    wishlist_entry = Wishlist(
        user_id=user_id,
        product_id=product_id,
        price_at_save=product.price,
    )
    db.add(wishlist_entry)

    # Increment product wishlist count
    product.wishlist_count = (product.wishlist_count or 0) + 1

    await db.flush()
    await db.refresh(wishlist_entry)
    return wishlist_entry


async def remove_from_wishlist(
    db: AsyncSession,
    user_id: UUID,
    product_id: UUID,
) -> None:
    """Remove a product from the user's wishlist."""
    result = await db.execute(
        select(Wishlist).where(
            and_(Wishlist.user_id == user_id, Wishlist.product_id == product_id)
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise NotFoundError("Product not in wishlist")

    await db.execute(
        delete(Wishlist).where(
            and_(Wishlist.user_id == user_id, Wishlist.product_id == product_id)
        )
    )

    # Decrement product wishlist count
    product_result = await db.execute(select(Product).where(Product.id == product_id))
    product = product_result.scalar_one_or_none()
    if product and product.wishlist_count and product.wishlist_count > 0:
        product.wishlist_count -= 1

    await db.flush()


async def get_wishlist(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Get user's wishlist with product info and price drop detection."""
    base_query = (
        select(Wishlist, Product, Shop)
        .join(Product, Wishlist.product_id == Product.id)
        .join(Shop, Product.shop_id == Shop.id)
        .where(Wishlist.user_id == user_id)
    )

    # Count
    count_query = select(func.count()).select_from(
        select(Wishlist).where(Wishlist.user_id == user_id).subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    base_query = base_query.order_by(Wishlist.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(base_query)
    rows = result.all()

    items = []
    for wishlist_entry, product, shop in rows:
        # Skip if product was deleted (shouldn't happen with join, but safe guard)
        if not product:
            continue
            
        # Use current price, or saved price if current is 0/None
        display_price = product.price if product.price and product.price > 0 else wishlist_entry.price_at_save
        
        price_dropped = False
        if wishlist_entry.price_at_save is not None and product.price is not None and product.price > 0:
            price_dropped = product.price < wishlist_entry.price_at_save

        items.append({
            "id": wishlist_entry.id,
            "product_id": product.id,
            "product_name": product.name,
            "product_price": display_price,
            "product_images": product.images if product.images and len(product.images) > 0 else [],
            "shop_name": shop.name if shop else "Unknown Shop",
            "shop_id": str(shop.id) if shop else None,
            "price_at_save": wishlist_entry.price_at_save,
            "price_dropped": price_dropped,
            "created_at": wishlist_entry.created_at,
        })

    return items, total


async def check_price_drops(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict]:
    """Return wishlist items where the current price dropped >= 5% or >= Rs.50 compared to price_at_save."""
    result = await db.execute(
        select(Wishlist, Product, Shop)
        .join(Product, Wishlist.product_id == Product.id)
        .join(Shop, Product.shop_id == Shop.id)
        .where(
            and_(
                Wishlist.user_id == user_id,
                Wishlist.price_at_save.isnot(None),
                Product.price.isnot(None),
                Product.price > 0,  # Only active products
            )
        )
    )
    rows = result.all()

    # Collect products with price drops
    drops = []
    for wishlist_entry, product, shop in rows:
        saved_price = float(wishlist_entry.price_at_save)
        current_price = float(product.price)
        if saved_price <= 0:
            continue

        drop_amount = saved_price - current_price
        drop_percentage = (drop_amount / saved_price) * 100

        # Only include if price actually dropped (by at least 5% or Rs.50)
        if drop_amount >= 50 or drop_percentage >= 5:
            drops.append({
                "id": wishlist_entry.id,
                "product_id": str(product.id),
                "product_name": product.name,
                "image": (product.images or [None])[0],
                "images": product.images or [],
                "old_price": saved_price,
                "price": current_price,
                "product_price": current_price,  # For consistency
                "drop_amount": round(drop_amount, 2),
                "drop_percentage": round(drop_percentage, 2),
                "shop_id": str(product.shop_id),
                "shop_name": shop.name if shop else "Unknown Shop",
                "price_at_save": wishlist_entry.price_at_save,
                "price_dropped": True,
            })

    return drops
