import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.media import MediaFile, MediaChild
from app.models.family import FamilyMember
from app.models.analysis import AnalysisTask
from app.schemas.media import (
    MediaUploadInitRequest,
    MediaUploadInitResponse,
    MediaUploadCompleteRequest,
    MediaResponse,
    MediaDetailResponse,
)
from app.utils.deps import get_current_user
from app.services.media_service import minio_service

router = APIRouter()


@router.post("/upload/init", response_model=MediaUploadInitResponse)
async def init_upload(
    body: MediaUploadInitRequest,
    current_user: User = Depends(get_current_user),
):
    """初始化文件上传，返回 upload_id 和存储路径"""
    upload_id = str(uuid.uuid4())
    storage_path = f"uploads/{current_user.id}/{upload_id}/{body.filename}"
    return MediaUploadInitResponse(upload_id=upload_id, storage_path=storage_path)


@router.post("/upload/{upload_id}/complete", response_model=MediaResponse)
async def complete_upload(
    upload_id: str,
    body: MediaUploadCompleteRequest,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """完成文件上传，创建媒体记录并触发 AI 分析"""
    file_content = await file.read()
    storage_path = f"uploads/{current_user.id}/{upload_id}/{file.filename}"

    content_type = file.content_type or "application/octet-stream"
    minio_service.upload_file(storage_path, file_content, content_type)

    file_type = "video" if content_type.startswith("video") else "image"

    family_member = await db.execute(
        select(FamilyMember).where(FamilyMember.user_id == current_user.id).limit(1)
    )
    member = family_member.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先创建或加入一个家庭")

    media_file = MediaFile(
        family_id=member.family_id,
        uploader_id=current_user.id,
        file_type=file_type,
        storage_path=storage_path,
        original_filename=file.filename or "unknown",
        file_size=len(file_content),
        captured_at=body.captured_at,
        analysis_status="pending",
    )
    db.add(media_file)
    await db.flush()

    for child_id in body.child_ids:
        media_child = MediaChild(media_id=media_file.id, child_id=child_id)
        db.add(media_child)

    analysis_task = AnalysisTask(
        media_id=media_file.id,
        task_type="preprocess",
        status="queued",
    )
    db.add(analysis_task)
    await db.flush()

    try:
        from app.tasks.preprocess import preprocess_video
        preprocess_video.delay(media_file.id)
    except Exception:
        pass

    await db.refresh(media_file)
    return MediaResponse.model_validate(media_file)


@router.get("/families/{family_id}/media", response_model=list[MediaResponse])
async def list_media(
    family_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取家庭的媒体列表"""
    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该家庭")

    query = select(MediaFile).where(MediaFile.family_id == family_id)

    if start_date:
        query = query.where(MediaFile.uploaded_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(MediaFile.uploaded_at <= datetime.fromisoformat(end_date))

    query = query.order_by(MediaFile.uploaded_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    media_files = list(result.scalars().all())
    return [MediaResponse.model_validate(m) for m in media_files]


@router.get("/{media_id}", response_model=MediaDetailResponse)
async def get_media(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取媒体详情"""
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = result.scalar_one_or_none()
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

    from app.services.analysis_service import get_analysis_results
    analysis_results = await get_analysis_results(db, media_id)

    return MediaDetailResponse(
        id=media_file.id,
        family_id=media_file.family_id,
        file_type=media_file.file_type,
        original_filename=media_file.original_filename,
        file_size=media_file.file_size,
        duration_seconds=media_file.duration_seconds,
        captured_at=media_file.captured_at,
        uploaded_at=media_file.uploaded_at,
        analysis_status=media_file.analysis_status,
        storage_path=media_file.storage_path,
        metadata_info=media_file.metadata_info,
        analysis_results=[r.__dict__ for r in analysis_results],
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除媒体文件"""
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = result.scalar_one_or_none()
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

    minio_service.delete_file(media_file.storage_path)
    await db.delete(media_file)
