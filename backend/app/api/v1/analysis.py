import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.media import MediaFile
from app.models.analysis import AnalysisResult, AnalysisTask
from app.models.family import FamilyMember
from app.schemas.analysis import AnalysisResultResponse, AnalysisTaskResponse
from app.utils.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{media_id}/results", response_model=list[AnalysisResultResponse])
async def get_analysis_results(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取媒体的 AI 分析结果"""
    media_result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = media_result.scalar_one_or_none()
    if not media_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="媒体文件不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == media_file.family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.media_id == media_id)
    )
    results = list(result.scalars().all())
    return [AnalysisResultResponse.model_validate(r) for r in results]


@router.get("/{media_id}/status", response_model=list[AnalysisTaskResponse])
async def get_analysis_status(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询分析任务状态"""
    media_result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = media_result.scalar_one_or_none()
    if not media_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="媒体文件不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == media_file.family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    result = await db.execute(
        select(AnalysisTask).where(AnalysisTask.media_id == media_id)
    )
    tasks = list(result.scalars().all())
    return [AnalysisTaskResponse.model_validate(t) for t in tasks]


@router.post("/{media_id}/reanalyze", status_code=status.HTTP_202_ACCEPTED)
async def reanalyze(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重新触发 AI 分析"""
    media_result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = media_result.scalar_one_or_none()
    if not media_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="媒体文件不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == media_file.family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作")

    media_file.analysis_status = "pending"

    task = AnalysisTask(
        media_id=media_id,
        task_type="preprocess",
        status="queued",
    )
    db.add(task)
    await db.flush()

    logger.info("🎯 [分析API] 收到重新分析请求: media_id=%s", media_id)

    celery_available = False
    try:
        from app.tasks.preprocess import preprocess_video
        preprocess_video.delay(media_id)
        celery_available = True
        logger.info("📤 [分析API] 已提交 Celery 预处理任务")
    except Exception as celery_error:
        logger.info("⚠️ [分析API] Celery 不可用(%s)，将使用同步模式分析", celery_error)

    if not celery_available:
        try:
            from app.ai.pipeline import run_preprocess_pipeline, run_analysis_pipeline
            from datetime import datetime

            logger.info("🔄 [分析API] 开始同步预处理: media_id=%s", media_id)
            task.status = "running"
            task.started_at = datetime.utcnow()
            await db.flush()

            preprocess_result = await run_preprocess_pipeline(db, media_id)

            task.status = "completed"
            task.completed_at = datetime.utcnow()
            await db.flush()

            logger.info("🔄 [分析API] 预处理完成，开始同步深度分析...")
            await run_analysis_pipeline(db, media_id, preprocess_result)
            await db.commit()
            logger.info("✅ [分析API] 同步分析全部完成: media_id=%s", media_id)
        except Exception as error:
            logger.error("❌ [分析API] 同步分析失败: %s", error, exc_info=True)
            task.status = "failed"
            task.error_message = str(error)
            media_file.analysis_status = "failed"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"分析失败: {str(error)}",
            )

    return {"message": "分析完成" if not celery_available else "已重新触发分析", "task_id": task.id}
