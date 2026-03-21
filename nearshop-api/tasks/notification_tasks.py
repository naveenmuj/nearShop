import logging
from typing import Optional

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.send_push_notification", bind=True, max_retries=3)
def send_push_notification(
    self,
    user_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """Send a push notification to a user's device.

    Stub implementation -- logs the intended operation.
    """
    logger.info(
        "send_push_notification: user=%s title=%r body=%r data=%s",
        user_id,
        title,
        body,
        data,
    )
    return {
        "status": "stub",
        "user_id": user_id,
        "title": title,
    }


@celery_app.task(name="tasks.send_sms", bind=True, max_retries=3)
def send_sms(self, phone: str, message: str) -> dict:
    """Send an SMS to the given phone number.

    Stub implementation -- logs the intended operation.
    """
    logger.info("send_sms: phone=%s message=%r", phone, message)
    return {
        "status": "stub",
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

    Stub implementation -- logs the intended operation.
    """
    logger.info(
        "send_bulk_push: %d users, title=%r", len(user_ids), title
    )
    return {
        "status": "stub",
        "user_count": len(user_ids),
        "title": title,
    }
