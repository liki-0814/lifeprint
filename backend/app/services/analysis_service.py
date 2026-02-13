from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.analysis import AnalysisResult, GrowthMetric
from app.models.media import MediaFile, MediaChild


async def get_analysis_results(db: AsyncSession, media_id: str) -> list[AnalysisResult]:
    """获取某个媒体的所有分析结果"""
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.media_id == media_id)
    )
    return list(result.scalars().all())


async def get_growth_metrics(
    db: AsyncSession,
    child_id: str,
    metric_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[GrowthMetric]:
    """查询成长指标，支持按类型和时间范围筛选"""
    query = select(GrowthMetric).where(GrowthMetric.child_id == child_id)

    if metric_type:
        query = query.where(GrowthMetric.metric_type == metric_type)
    if start_date:
        query = query.where(GrowthMetric.measured_at >= start_date)
    if end_date:
        query = query.where(GrowthMetric.measured_at <= end_date)

    query = query.order_by(GrowthMetric.measured_at)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_growth_timeline(db: AsyncSession, child_id: str) -> list[dict]:
    """获取孩子的成长时间线数据"""
    result = await db.execute(
        select(MediaFile)
        .join(MediaChild, MediaChild.media_id == MediaFile.id)
        .where(MediaChild.child_id == child_id)
        .order_by(MediaFile.uploaded_at.desc())
    )
    media_files = list(result.scalars().all())

    timeline = []
    for media in media_files:
        analysis_result = await db.execute(
            select(AnalysisResult).where(AnalysisResult.media_id == media.id)
        )
        analyses = list(analysis_result.scalars().all())

        timeline.append({
            "date": (media.captured_at or media.uploaded_at).isoformat(),
            "media_id": media.id,
            "file_type": media.file_type,
            "original_filename": media.original_filename,
            "analysis_status": media.analysis_status,
            "analyses": [
                {
                    "type": a.analysis_type,
                    "result_data": a.result_data,
                    "analyzed_at": a.analyzed_at.isoformat(),
                }
                for a in analyses
            ],
        })

    return timeline
