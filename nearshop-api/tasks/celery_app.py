from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "nearshop",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)

celery_app.conf.timezone = "Asia/Kolkata"

celery_app.conf.beat_schedule = {
    "expire-reservations-every-5-min": {
        "task": "tasks.scheduled_tasks.expire_reservations",
        "schedule": 300,  # every 5 minutes
    },
    "expire-stories-every-15-min": {
        "task": "tasks.scheduled_tasks.expire_stories",
        "schedule": 900,  # every 15 minutes
    },
    "expire-deals-every-5-min": {
        "task": "tasks.scheduled_tasks.expire_deals",
        "schedule": 300,  # every 5 minutes
    },
    "clean-expired-otps-hourly": {
        "task": "tasks.scheduled_tasks.clean_expired_otps",
        "schedule": 3600,  # every hour
    },
    "recalculate-shop-scores-daily": {
        "task": "tasks.scheduled_tasks.recalculate_shop_scores",
        "schedule": crontab(hour=3, minute=0),  # daily at 3am IST
    },
}

# Auto-discover task modules
celery_app.autodiscover_tasks(["tasks"])
