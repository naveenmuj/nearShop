from uuid import UUID
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.broadcast.models import BroadcastMessage
from app.orders.models import Order
from app.auth.models import Follow

logger = logging.getLogger(__name__)


async def get_target_customers(db: AsyncSession, shop_id: UUID, segment: str, filters: dict = None) -> list:
    now = datetime.now(timezone.utc)

    if segment == "all":
        order_cust = await db.execute(select(distinct(Order.customer_id)).where(Order.shop_id == shop_id))
        ids = {r[0] for r in order_cust.all()}
        try:
            follow_cust = await db.execute(select(distinct(Follow.user_id)).where(Follow.shop_id == shop_id))
            ids |= {r[0] for r in follow_cust.all()}
        except Exception:
            pass
        return list(ids)

    elif segment == "recent":
        result = await db.execute(
            select(distinct(Order.customer_id)).where(Order.shop_id == shop_id, Order.created_at >= now - timedelta(days=30))
        )
        return [r[0] for r in result.all()]

    elif segment == "inactive":
        days = (filters or {}).get("days_inactive", 30)
        cutoff = now - timedelta(days=days)
        old = await db.execute(select(distinct(Order.customer_id)).where(Order.shop_id == shop_id, Order.created_at < cutoff))
        recent = await db.execute(select(distinct(Order.customer_id)).where(Order.shop_id == shop_id, Order.created_at >= cutoff))
        return list({r[0] for r in old.all()} - {r[0] for r in recent.all()})

    elif segment == "followers":
        try:
            result = await db.execute(select(distinct(Follow.user_id)).where(Follow.shop_id == shop_id))
            return [r[0] for r in result.all()]
        except Exception:
            return []

    return []


async def send_broadcast(db: AsyncSession, shop_id: UUID, title: str, body: str, segment: str, filters: dict = None) -> dict:
    from app.notifications.service import create_notification

    customer_ids = await get_target_customers(db, shop_id, segment, filters)
    sent = 0
    failed = 0
    for uid in customer_ids:
        try:
            await create_notification(
                db, user_id=uid, title=title, body=body,
                notification_type="broadcast", reference_type="shop", reference_id=str(shop_id),
            )
            sent += 1
        except Exception as exc:
            failed += 1
            # Best effort fanout: keep processing recipients while capturing failures.
            logger.warning("broadcast delivery failed for user %s: %s", uid, exc)

    msg = BroadcastMessage(
        shop_id=shop_id, title=title, body=body,
        target_segment=segment, target_filter=filters, recipients_count=sent,
    )
    db.add(msg)
    await db.flush()
    return {
        "sent": sent,
        "failed": failed,
        "total_targets": len(customer_ids),
        "message_id": str(msg.id),
    }


async def get_broadcast_history(db: AsyncSession, shop_id: UUID, limit: int = 20) -> list:
    result = await db.execute(
        select(BroadcastMessage).where(BroadcastMessage.shop_id == shop_id)
        .order_by(BroadcastMessage.created_at.desc()).limit(limit)
    )
    return [
        {"id": str(m.id), "title": m.title, "body": m.body, "segment": m.target_segment,
         "recipients": m.recipients_count, "sent_at": str(m.sent_at)}
        for m in result.scalars().all()
    ]


async def get_segment_counts(db: AsyncSession, shop_id: UUID) -> dict:
    return {
        "all": len(await get_target_customers(db, shop_id, "all")),
        "recent_30d": len(await get_target_customers(db, shop_id, "recent")),
        "inactive_30d": len(await get_target_customers(db, shop_id, "inactive")),
        "followers": len(await get_target_customers(db, shop_id, "followers")),
    }
