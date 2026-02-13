from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "life_print",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
)

celery_app.autodiscover_tasks(["app.tasks"])

celery_app.conf.beat_schedule = {
    "generate-monthly-reports": {
        "task": "app.tasks.report.generate_all_monthly_reports",
        "schedule": crontab(day_of_month="1", hour="2", minute="0"),
    },
}
