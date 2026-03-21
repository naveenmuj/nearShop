from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserEvent, SearchLog


async def track_event(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    entity_type: str,
    entity_id: UUID,
    metadata: dict | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> UserEvent:
    """Create a UserEvent record for behavioural tracking."""
    event = UserEvent(
        user_id=user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
        latitude=lat,
        longitude=lng,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def track_search(
    db: AsyncSession,
    user_id: UUID,
    query_text: str,
    search_type: str,
    lat: float | None = None,
    lng: float | None = None,
    results_count: int = 0,
    clicked_ids: list[UUID] | None = None,
) -> SearchLog:
    """Create a SearchLog record for search analytics."""
    log = SearchLog(
        user_id=user_id,
        query_text=query_text,
        search_type=search_type,
        latitude=lat,
        longitude=lng,
        results_count=results_count,
        clicked_ids=clicked_ids,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log
