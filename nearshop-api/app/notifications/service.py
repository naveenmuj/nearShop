from uuid import UUID

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BadRequestError
from app.notifications.models import Notification
from app.notifications.templates import TEMPLATES


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    reference_type: str | None = None,
    reference_id: UUID | None = None,
    **kwargs: str,
) -> Notification:
    """Create a notification from a template, formatting title/body with kwargs."""
    template = TEMPLATES.get(notification_type)
    if template is None:
        raise BadRequestError(f"Unknown notification type: {notification_type}")

    title = template["title"]
    body = template["body"].format(**kwargs)

    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def get_notifications(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> list[Notification]:
    """Paginated notifications for a user, newest first."""
    offset = (page - 1) * per_page
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def mark_read(
    db: AsyncSession,
    notification_id: UUID,
    user_id: UUID,
) -> Notification:
    """Mark a single notification as read after verifying ownership."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if notification is None:
        raise NotFoundError("Notification not found")
    if notification.user_id != user_id:
        raise NotFoundError("Notification not found")

    notification.is_read = True
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_all_read(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Mark all unread notifications as read for a user. Returns count updated."""
    stmt = (
        update(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount  # type: ignore[return-value]


async def get_unread_count(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Count unread notifications for a user."""
    query = (
        select(func.count())
        .select_from(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
    )
    result = await db.execute(query)
    return result.scalar() or 0
