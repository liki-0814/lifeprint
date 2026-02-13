import asyncio
import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import async_session_factory
from app.models.analysis import AnalysisTask

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def preprocess_video(self, media_id: str):
    """
    Celery 任务：视频预处理（关键帧提取 + 语音转写 + 人脸识别）。
    完成后自动触发 AI 深度分析任务。
    """
    logger.info("开始预处理视频: %s", media_id)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(_run_preprocess(media_id))
        from app.tasks.analyze import analyze_media
        analyze_media.delay(media_id, result)
        logger.info("预处理完成，已触发深度分析: %s", media_id)
    except Exception as error:
        logger.error("预处理失败: %s, 错误: %s", media_id, error)
        try:
            self.retry(exc=error)
        except self.MaxRetriesExceededError:
            loop.run_until_complete(_mark_task_failed(media_id, str(error)))
    finally:
        loop.close()


async def _run_preprocess(media_id: str) -> dict:
    """执行异步预处理流水线"""
    from app.ai.pipeline import run_preprocess_pipeline

    async with async_session_factory() as session:
        async with session.begin():
            from sqlalchemy import select
            task_result = await session.execute(
                select(AnalysisTask).where(
                    AnalysisTask.media_id == media_id,
                    AnalysisTask.task_type == "preprocess",
                    AnalysisTask.status == "queued",
                )
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.status = "running"
                task.started_at = datetime.utcnow()

            result = await run_preprocess_pipeline(session, media_id)

            if task:
                task.status = "completed"
                task.completed_at = datetime.utcnow()

            return result


async def _mark_task_failed(media_id: str, error_message: str):
    """标记任务为失败"""
    async with async_session_factory() as session:
        async with session.begin():
            from sqlalchemy import select
            task_result = await session.execute(
                select(AnalysisTask).where(
                    AnalysisTask.media_id == media_id,
                    AnalysisTask.task_type == "preprocess",
                )
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.error_message = error_message
                task.completed_at = datetime.utcnow()
