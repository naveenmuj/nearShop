from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.advisor import service

router = APIRouter(prefix="/api/v1/advisor", tags=["advisor"])


async def _get_shop_id(user: User, db: AsyncSession):
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


@router.get("/suggestions")
async def get_suggestions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_smart_suggestions(db, shop_id)
