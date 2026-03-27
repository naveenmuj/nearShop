from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import require_business, get_current_user
from app.analytics.schemas import OperationalInsightsResponse
from app.analytics.service import (
    get_shop_stats,
    get_product_analytics,
    get_demand_insights,
    get_operational_insights,
)
from app.analytics.events import track_event, track_events_batch

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


class TrackEventRequest(BaseModel):
    event_type: str
    entity_type: str
    entity_id: UUID
    metadata: Optional[dict] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TrackEventBatchRequest(BaseModel):
    events: list[TrackEventRequest]


@router.post("/events", status_code=201)
async def track_event_endpoint(
    body: TrackEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a behavioural event (view, click, add-to-cart, etc.)."""
    event = await track_event(
        db,
        user_id=current_user.id,
        event_type=body.event_type,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        metadata=body.metadata,
        lat=body.lat,
        lng=body.lng,
    )
    await db.commit()
    return {"id": str(event.id), "recorded": True}


@router.post("/events/batch", status_code=201)
async def track_events_batch_endpoint(
    body: TrackEventBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record multiple behavioural events in a single request."""
    events = await track_events_batch(
        db,
        user_id=current_user.id,
        events=[
            {
                "event_type": item.event_type,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "metadata": item.metadata,
                "lat": item.lat,
                "lng": item.lng,
            }
            for item in body.events
        ],
    )
    await db.commit()
    return {
        "count": len(events),
        "ids": [str(event.id) for event in events],
        "recorded": True,
    }


@router.get("/shop/{shop_id}/stats")
async def shop_stats_endpoint(
    shop_id: UUID,
    period: str = Query("7d", regex=r"^(7d|30d|90d)$"),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Shop-level aggregated stats for the given period."""
    return await get_shop_stats(db, shop_id, period)


@router.get("/shop/{shop_id}/products")
async def product_analytics_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Per-product analytics for a shop."""
    return await get_product_analytics(db, shop_id)


@router.get("/shop/{shop_id}/demand")
async def demand_insights_endpoint(
    shop_id: UUID,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Top search queries near the shop location."""
    return await get_demand_insights(db, shop_id, lat, lng)


@router.get("/shop/{shop_id}/operational-insights", response_model=OperationalInsightsResponse)
async def operational_insights_endpoint(
    shop_id: UUID,
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    """Operational insights for merchant decision support using low-cost statistical methods."""
    return await get_operational_insights(db, shop_id, lat, lng)
