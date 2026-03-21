from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_customer
from app.feed.service import get_personalized_feed, get_dynamic_hook

router = APIRouter(prefix="/api/v1/feed", tags=["feed"])


@router.get("/home")
async def home_feed(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Personalised product feed based on proximity."""
    items = await get_personalized_feed(
        db, current_user.id, lat, lng, page, per_page
    )
    return {"items": items, "page": page, "per_page": per_page}


@router.get("/hook")
async def dynamic_hook(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    """Contextual hook message for the home screen."""
    return await get_dynamic_hook(db, current_user.id, lat, lng)
