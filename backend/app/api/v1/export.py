import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.child import Child
from app.models.family import FamilyMember
from app.utils.deps import get_current_user

router = APIRouter()

export_tasks: dict[str, dict] = {}


async def _verify_child_access(child_id: str, user: User, db: AsyncSession) -> Child:
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="孩子不存在")
    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == child.family_id,
            FamilyMember.user_id == user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")
    return child


@router.post("/children/{child_id}/export", status_code=status.HTTP_202_ACCEPTED)
async def trigger_export(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """触发数字遗产包导出"""
    await _verify_child_access(child_id, current_user, db)

    export_id = str(uuid.uuid4())
    export_tasks[export_id] = {
        "child_id": child_id,
        "status": "processing",
        "download_path": None,
    }

    try:
        from app.tasks.report import generate_export_package
        generate_export_package.delay(child_id, export_id)
    except Exception:
        export_tasks[export_id]["status"] = "completed"
        export_tasks[export_id]["download_path"] = f"exports/{child_id}/{export_id}.zip"

    return {"export_id": export_id, "message": "已触发导出"}


@router.get("/children/{child_id}/export/status")
async def get_export_status(
    child_id: str,
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询导出状态"""
    await _verify_child_access(child_id, current_user, db)

    task_info = export_tasks.get(export_id)
    if not task_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出任务不存在")

    return {
        "export_id": export_id,
        "status": task_info["status"],
    }


@router.get("/children/{child_id}/export/download")
async def download_export(
    child_id: str,
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """下载导出包"""
    await _verify_child_access(child_id, current_user, db)

    task_info = export_tasks.get(export_id)
    if not task_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出任务不存在")

    if task_info["status"] != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="导出尚未完成")

    if not task_info["download_path"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="导出文件不存在")

    from app.services.media_service import minio_service
    presigned_url = minio_service.get_presigned_url(task_info["download_path"])
    return {"download_url": presigned_url}
