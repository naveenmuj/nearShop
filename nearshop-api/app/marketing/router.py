from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.marketing import service

router = APIRouter(prefix="/api/v1/marketing", tags=["marketing"])


async def _get_shop_id(user: User, db: AsyncSession):
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


class CatalogRequest(BaseModel):
    product_ids: Optional[List[str]] = None
    template: str = "catalog"


@router.post("/whatsapp-text")
async def generate_text(
    req: CatalogRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    text = await service.generate_whatsapp_text(db, shop_id, req.template, req.product_ids)
    return {"text": text, "template": req.template}


@router.get("/catalog-data")
async def get_catalog_data(
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    return await service.generate_catalog_data(db, shop_id, limit=limit)


@router.get("/festivals")
async def get_festivals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = await _get_shop_id(user, db)
    festivals = await service.get_festival_suggestions()

    # Get shop's product categories to suggest festival-relevant products
    from app.products.models import Product
    from sqlalchemy import func, desc
    products_result = await db.execute(
        select(Product.name, Product.price, Product.category, Product.id)
        .where(Product.shop_id == shop_id, Product.is_available == True)
        .order_by(desc(Product.view_count))
        .limit(20)
    )
    products = products_result.all()
    categories = set(p[2] for p in products if p[2])

    # Festival category mapping for suggestions
    FESTIVAL_CATEGORIES = {
        "Ugadi / Gudi Padwa": ["Food", "Grocery", "Home", "Beauty"],
        "Ramadan / Eid": ["Food", "Clothing", "Beauty", "Grocery"],
        "Akshaya Tritiya": ["Beauty", "Electronics", "Clothing"],
        "Mother's Day": ["Beauty", "Clothing", "Home", "Food"],
        "Independence Day": ["Clothing", "Food", "Electronics", "Home"],
        "Raksha Bandhan": ["Beauty", "Clothing", "Food", "Grocery"],
        "Ganesh Chaturthi": ["Grocery", "Food", "Home"],
        "Navratri / Dussehra": ["Clothing", "Beauty", "Food"],
        "Diwali": ["Electronics", "Clothing", "Home", "Beauty", "Food", "Grocery"],
        "Christmas": ["Electronics", "Clothing", "Food", "Home", "Beauty"],
    }

    for fest in festivals:
        relevant_cats = FESTIVAL_CATEGORIES.get(fest["name"], [])
        matching_products = [
            {"id": str(p[3]), "name": p[0], "price": float(p[1]), "category": p[2]}
            for p in products if p[2] in relevant_cats
        ][:5]

        missing_cats = [c for c in relevant_cats if c not in categories]

        fest["suggested_products"] = matching_products
        fest["suggested_categories"] = relevant_cats
        fest["missing_categories"] = missing_cats
        fest["deal_suggestion"] = (
            f"Create deals on your {', '.join(c for c in relevant_cats if c in categories)} products"
            if any(c in categories for c in relevant_cats)
            else f"Consider adding {', '.join(relevant_cats[:2])} products for {fest['name']}"
        )

    return {"festivals": festivals}
