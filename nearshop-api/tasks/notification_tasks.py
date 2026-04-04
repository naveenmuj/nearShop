import logging
import asyncio
from typing import Optional
from uuid import UUID

from sqlalchemy import select

from tasks.celery_app import celery_app
from app.auth.models import User
from app.core.database import async_session_factory
from app.core.firebase import send_push_notification as _send_push, send_push_to_multiple as _send_push_bulk

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_user_token(user_uuid: UUID) -> str | None:
    async with async_session_factory() as db:
        result = await db.execute(select(User.fcm_token).where(User.id == user_uuid))
        return result.scalar_one_or_none()


async def _get_tokens_for_users(user_ids: list[UUID]) -> list[str]:
    async with async_session_factory() as db:
        result = await db.execute(
            select(User.fcm_token).where(User.id.in_(user_ids), User.fcm_token.isnot(None))
        )
        return [row[0] for row in result.all() if row[0]]


@celery_app.task(name="tasks.send_push_notification", bind=True, max_retries=3)
def send_push_notification(
    self,
    user_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """Send a push notification to a user's device.
    """
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return {"status": "invalid_user_id", "user_id": user_id}

    token = _run_async(_get_user_token(user_uuid))

    if not token:
        return {"status": "skipped", "reason": "no_fcm_token", "user_id": user_id}

    message_id = _send_push(
        token=token,
        title=title,
        body=body,
        data=data or {"type": "background_notification", "user_id": user_id},
    )
    if not message_id:
        return {"status": "failed", "user_id": user_id}

    return {"status": "sent", "user_id": user_id, "message_id": message_id}


@celery_app.task(name="tasks.send_sms", bind=True, max_retries=3)
def send_sms(self, phone: str, message: str) -> dict:
    """Send an SMS to the given phone number.

    SMS provider integration point.
    Kept as a safe no-op until a provider (Twilio/Gupshup/etc.) is wired.
    """
    logger.info("send_sms skipped: phone=%s message_len=%d", phone, len(message or ""))
    return {
        "status": "skipped",
        "reason": "sms_provider_not_configured",
        "phone": phone,
        "message_length": len(message),
    }


@celery_app.task(name="tasks.send_bulk_push", bind=True, max_retries=2)
def send_bulk_push(
    self,
    user_ids: list[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """Send push notifications to multiple users.
    """
    valid_user_ids: list[UUID] = []
    for uid in user_ids:
        try:
            valid_user_ids.append(UUID(uid))
        except ValueError:
            continue

    if not valid_user_ids:
        return {"status": "invalid_input", "user_count": 0, "title": title}

    tokens = _run_async(_get_tokens_for_users(valid_user_ids))

    if not tokens:
        return {
            "status": "skipped",
            "reason": "no_fcm_tokens",
            "user_count": len(valid_user_ids),
            "title": title,
        }

    push_result = _send_push_bulk(
        tokens=tokens,
        title=title,
        body=body,
        data=data or {"type": "background_bulk_notification"},
    )
    return {
        "status": "completed",
        "user_count": len(valid_user_ids),
        "token_count": len(tokens),
        "title": title,
        **push_result,
    }
