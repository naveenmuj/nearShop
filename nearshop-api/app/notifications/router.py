from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.auth.models import User
from app.auth.permissions import get_current_user
from app.notifications.service import (
    get_notifications,
    mark_read,
    mark_all_read,
    get_unread_count,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated notifications for the authenticated user."""
    items = await get_notifications(db, current_user.id, page, per_page)
    return {
        "items": [
            {
                "id": str(n.id),
                "title": n.title,
                "body": n.body,
                "notification_type": n.notification_type,
                "reference_type": n.reference_type,
                "reference_id": str(n.reference_id) if n.reference_id else None,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
        "page": page,
        "per_page": per_page,
    }


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    notification = await mark_read(db, notification_id, current_user.id)
    return {
        "id": str(notification.id),
        "is_read": notification.is_read,
    }


@router.put("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications as read."""
    count = await mark_all_read(db, current_user.id)
    return {"marked_read": count}


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications."""
    count = await get_unread_count(db, current_user.id)
    return {"unread_count": count}
