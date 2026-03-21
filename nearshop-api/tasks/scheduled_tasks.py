"""Scheduled Celery Beat tasks for NearShop."""
import asyncio
import logging
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select, update, and_

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery worker threads)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(name="tasks.scheduled_tasks.expire_reservations")
def expire_reservations():
    """Expire active reservations that have passed their expires_at timestamp."""
    _run_async(_expire_reservations())


async def _expire_reservations():
    from app.core.database import async_session_factory
    from app.reservations.models import Reservation

    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            stmt = (
                update(Reservation)
                .where(
                    and_(
                        Reservation.status == "active",
                        Reservation.expires_at <= now,
                    )
                )
                .values(status="expired")
            )
            result = await db.execute(stmt)
            await db.commit()
            logger.info("expire_reservations: expired %d reservations", result.rowcount)
        except Exception as exc:
            await db.rollback()
            logger.error("expire_reservations failed: %s", exc)
            raise


@shared_task(name="tasks.scheduled_tasks.expire_stories")
def expire_stories():
    """Delete or mark stories that have passed their expires_at timestamp."""
    _run_async(_expire_stories())


async def _expire_stories():
    from app.core.database import async_session_factory
    from app.stories.models import Story
    from sqlalchemy import delete

    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            stmt = delete(Story).where(
                and_(
                    Story.expires_at.isnot(None),
                    Story.expires_at <= now,
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            logger.info("expire_stories: deleted %d expired stories", result.rowcount)
        except Exception as exc:
            await db.rollback()
            logger.error("expire_stories failed: %s", exc)
            raise


@shared_task(name="tasks.scheduled_tasks.expire_deals")
def expire_deals():
    """Deactivate deals that have passed their expires_at timestamp."""
    _run_async(_expire_deals())


async def _expire_deals():
    from app.core.database import async_session_factory
    from app.deals.models import Deal

    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            stmt = (
                update(Deal)
                .where(
                    and_(
                        Deal.is_active == True,
                        Deal.expires_at <= now,
                    )
                )
                .values(is_active=False)
            )
            result = await db.execute(stmt)
            await db.commit()
            logger.info("expire_deals: deactivated %d deals", result.rowcount)
        except Exception as exc:
            await db.rollback()
            logger.error("expire_deals failed: %s", exc)
            raise


@shared_task(name="tasks.scheduled_tasks.clean_expired_otps")
def clean_expired_otps():
    """Delete OTP codes that have expired."""
    _run_async(_clean_expired_otps())


async def _clean_expired_otps():
    from app.core.database import async_session_factory
    from app.auth.models import OTPCode
    from sqlalchemy import delete

    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            stmt = delete(OTPCode).where(OTPCode.expires_at <= now)
            result = await db.execute(stmt)
            await db.commit()
            logger.info("clean_expired_otps: deleted %d expired OTPs", result.rowcount)
        except Exception as exc:
            await db.rollback()
            logger.error("clean_expired_otps failed: %s", exc)
            raise


@shared_task(name="tasks.scheduled_tasks.recalculate_shop_scores")
def recalculate_shop_scores():
    """Recalculate relevance scores for all active shops."""
    _run_async(_recalculate_shop_scores())


async def _recalculate_shop_scores():
    from app.core.database import async_session_factory
    from app.shops.models import Shop
    from app.shops.service import recalculate_shop_score

    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Shop.id).where(Shop.is_active == True)
            )
            shop_ids = list(result.scalars().all())
            logger.info("recalculate_shop_scores: processing %d shops", len(shop_ids))
            for sid in shop_ids:
                try:
                    await recalculate_shop_score(db, sid)
                except Exception as exc:
                    logger.warning("recalculate_shop_score failed for %s: %s", sid, exc)
            await db.commit()
            logger.info("recalculate_shop_scores: done")
        except Exception as exc:
            await db.rollback()
            logger.error("recalculate_shop_scores failed: %s", exc)
            raise
