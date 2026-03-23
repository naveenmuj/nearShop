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
async def get_festivals(user: User = Depends(get_current_user)):
    return await service.get_festival_suggestions()
