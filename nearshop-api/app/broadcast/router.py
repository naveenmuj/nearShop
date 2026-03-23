from typing import Optional, Dict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.shops.models import Shop
from app.broadcast import service

router = APIRouter(prefix="/api/v1/broadcast", tags=["broadcast"])


async def _get_shop_id(user: User, db: AsyncSession):
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id).limit(1))
    shop = result.scalar_one_or_none()
    if not shop:
        raise NotFoundError("No shop found")
    return shop.id


class BroadcastRequest(BaseModel):
    title: str
    body: str
    segment: str = "all"
    filters: Optional[Dict] = None


@router.post("/send")
async def send(req: BroadcastRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    result = await service.send_broadcast(db, shop_id, req.title, req.body, req.segment, req.filters)
    await db.commit()
    return result


@router.get("/segments")
async def segments(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_segment_counts(db, shop_id)


@router.get("/history")
async def history(limit: int = Query(20, ge=1, le=100), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    shop_id = await _get_shop_id(user, db)
    return await service.get_broadcast_history(db, shop_id, limit)
