import asyncio
import logging
from datetime import datetime

from app.celery_app import celery_app
from app.database import async_session_factory
from app.models.analysis import AnalysisTask

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def analyze_media(self, media_id: str, preprocess_result: dict):
    """
    Celery 任务：AI 深度分析（行为识别 + 情感分析）。
    由预处理任务完成后自动触发。
    """
    logger.info("开始 AI 深度分析: %s", media_id)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(_run_analysis(media_id, preprocess_result))
        logger.info("AI 深度分析完成: %s", media_id)
    except Exception as error:
        logger.error("AI 深度分析失败: %s, 错误: %s", media_id, error)
        try:
            self.retry(exc=error)
        except self.MaxRetriesExceededError:
            loop.run_until_complete(_mark_task_failed(media_id, str(error)))
    finally:
        loop.close()


async def _run_analysis(media_id: str, preprocess_result: dict):
    """执行异步 AI 分析流水线"""
    from app.ai.pipeline import run_analysis_pipeline

    async with async_session_factory() as session:
        async with session.begin():
            from sqlalchemy import select
            task_result = await session.execute(
                select(AnalysisTask).where(
                    AnalysisTask.media_id == media_id,
                    AnalysisTask.task_type == "analyze",
                )
            )
            task = task_result.scalar_one_or_none()

            if not task:
                task = AnalysisTask(
                    media_id=media_id,
                    task_type="analyze",
                    status="running",
                    started_at=datetime.utcnow(),
                )
                session.add(task)
            else:
                task.status = "running"
                task.started_at = datetime.utcnow()

            await run_analysis_pipeline(session, media_id, preprocess_result)

            task.status = "completed"
            task.completed_at = datetime.utcnow()


async def _mark_task_failed(media_id: str, error_message: str):
    """标记分析任务为失败"""
    async with async_session_factory() as session:
        async with session.begin():
            from sqlalchemy import select
            task_result = await session.execute(
                select(AnalysisTask).where(
                    AnalysisTask.media_id == media_id,
                    AnalysisTask.task_type == "analyze",
                )
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.status = "failed"
                task.error_message = error_message
                task.completed_at = datetime.utcnow()
