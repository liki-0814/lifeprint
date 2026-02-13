import asyncio
import logging
from datetime import date, datetime

from app.celery_app import celery_app
from app.database import async_session_factory

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300)
def generate_child_monthly_report(self, child_id: str):
    """
    Celery 任务：为指定孩子生成月度报告。
    可由 API 手动触发，也可由 beat_schedule 定时触发。
    """
    logger.info("开始生成月度报告: child_id=%s", child_id)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(_generate_report(child_id))
        logger.info("月度报告生成完成: child_id=%s", child_id)
    except Exception as error:
        logger.error("月度报告生成失败: child_id=%s, 错误: %s", child_id, error)
        try:
            self.retry(exc=error)
        except self.MaxRetriesExceededError:
            logger.error("月度报告生成重试次数已用尽: child_id=%s", child_id)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=1, default_retry_delay=60)
def generate_all_monthly_reports(self):
    """
    Celery 定时任务：为所有孩子生成月度报告。
    由 celery beat 每月 1 号触发。
    """
    logger.info("开始批量生成月度报告")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(_generate_all_reports())
        logger.info("批量月度报告生成完成")
    except Exception as error:
        logger.error("批量月度报告生成失败: %s", error)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def generate_export_package(self, child_id: str, export_id: str):
    """
    Celery 任务：生成数字遗产导出包。
    包含所有媒体文件、分析结果、月度报告的 ZIP 压缩包。
    """
    logger.info("开始生成导出包: child_id=%s, export_id=%s", child_id, export_id)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(_generate_export(child_id, export_id))
        logger.info("导出包生成完成: export_id=%s", export_id)
    except Exception as error:
        logger.error("导出包生成失败: export_id=%s, 错误: %s", export_id, error)
        try:
            self.retry(exc=error)
        except self.MaxRetriesExceededError:
            logger.error("导出包生成重试次数已用尽: export_id=%s", export_id)
    finally:
        loop.close()


async def _generate_report(child_id: str):
    """为单个孩子生成月度报告"""
    from sqlalchemy import select
    from app.models.child import Child
    from app.models.report import MonthlyReport
    from app.services.report_service import (
        calculate_radar_data,
        detect_spark_cards,
        generate_monthly_summary,
    )
    from app.ai.remote.report_generator import generate_growth_narrative

    report_month = date.today().replace(day=1)

    async with async_session_factory() as session:
        async with session.begin():
            child_result = await session.execute(
                select(Child).where(Child.id == child_id)
            )
            child = child_result.scalar_one_or_none()
            if not child:
                logger.warning("孩子不存在: %s", child_id)
                return

            existing = await session.execute(
                select(MonthlyReport).where(
                    MonthlyReport.child_id == child_id,
                    MonthlyReport.report_month == report_month,
                )
            )
            if existing.scalar_one_or_none():
                logger.info("本月报告已存在: child_id=%s", child_id)
                return

            radar_data = await calculate_radar_data(session, child_id, report_month)
            spark_cards = await detect_spark_cards(session, child_id)

            age_months = (
                (report_month.year - child.birth_date.year) * 12
                + report_month.month - child.birth_date.month
            )

            narrative = await generate_growth_narrative(
                child_name=child.name,
                age_months=age_months,
                radar_data=radar_data,
                spark_cards=spark_cards,
                behavior_summary=[],
                emotion_summary={},
            )

            summary = await generate_monthly_summary(radar_data, spark_cards)

            report = MonthlyReport(
                child_id=child_id,
                report_month=report_month,
                summary_text=summary,
                radar_data=radar_data,
                spark_cards=spark_cards,
                narrative=narrative,
            )
            session.add(report)


async def _generate_all_reports():
    """为所有孩子生成月度报告"""
    from sqlalchemy import select
    from app.models.child import Child

    async with async_session_factory() as session:
        result = await session.execute(select(Child))
        children = list(result.scalars().all())

    for child in children:
        generate_child_monthly_report.delay(child.id)


async def _generate_export(child_id: str, export_id: str):
    """生成数字遗产导出包"""
    import io
    import json
    import zipfile
    from sqlalchemy import select
    from app.models.child import Child
    from app.models.media import MediaFile, MediaChild
    from app.models.analysis import AnalysisResult
    from app.models.report import MonthlyReport
    from app.services.media_service import minio_service

    async with async_session_factory() as session:
        child_result = await session.execute(
            select(Child).where(Child.id == child_id)
        )
        child = child_result.scalar_one_or_none()
        if not child:
            return

        media_result = await session.execute(
            select(MediaFile)
            .join(MediaChild, MediaChild.media_id == MediaFile.id)
            .where(MediaChild.child_id == child_id)
        )
        media_files = list(media_result.scalars().all())

        analysis_result = await session.execute(
            select(AnalysisResult).where(
                AnalysisResult.media_id.in_([m.id for m in media_files])
            )
        )
        analyses = list(analysis_result.scalars().all())

        report_result = await session.execute(
            select(MonthlyReport).where(MonthlyReport.child_id == child_id)
        )
        reports = list(report_result.scalars().all())

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        child_info = {
            "name": child.name,
            "birth_date": child.birth_date.isoformat(),
            "gender": child.gender,
            "export_date": datetime.utcnow().isoformat(),
        }
        zip_file.writestr("child_info.json", json.dumps(child_info, ensure_ascii=False, indent=2))

        for media in media_files:
            try:
                file_bytes = minio_service.get_file_bytes(media.storage_path)
                zip_file.writestr(f"media/{media.original_filename}", file_bytes)
            except Exception:
                logger.warning("导出媒体文件失败: %s", media.storage_path)

        analyses_data = [
            {
                "media_id": a.media_id,
                "type": a.analysis_type,
                "result": a.result_data,
                "analyzed_at": a.analyzed_at.isoformat(),
            }
            for a in analyses
        ]
        zip_file.writestr("analyses.json", json.dumps(analyses_data, ensure_ascii=False, indent=2))

        for report in reports:
            report_data = {
                "month": report.report_month.isoformat(),
                "summary": report.summary,
                "radar_data": report.radar_data,
                "spark_cards": report.spark_cards,
                "narrative": getattr(report, "narrative", ""),
            }
            filename = f"reports/{report.report_month.isoformat()}.json"
            zip_file.writestr(filename, json.dumps(report_data, ensure_ascii=False, indent=2))

    zip_bytes = zip_buffer.getvalue()
    storage_path = f"exports/{child_id}/{export_id}.zip"
    minio_service.upload_file(storage_path, zip_bytes, "application/zip")

    from app.api.v1.export import export_tasks
    if export_id in export_tasks:
        export_tasks[export_id]["status"] = "completed"
        export_tasks[export_id]["download_path"] = storage_path
