from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.child import Child
from app.models.family import FamilyMember
from app.models.report import MonthlyReport
from app.schemas.report import MonthlyReportResponse, MonthlyReportListItem
from app.utils.deps import get_current_user

router = APIRouter()


async def _verify_child_access(child_id: str, user: User, db: AsyncSession) -> Child:
    """验证用户对孩子的访问权限"""
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


@router.get("/children/{child_id}/reports", response_model=list[MonthlyReportListItem])
async def list_reports(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取孩子的月度报告列表"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(MonthlyReport)
        .where(MonthlyReport.child_id == child_id)
        .order_by(MonthlyReport.report_month.desc())
    )
    reports = list(result.scalars().all())
    return [MonthlyReportListItem.model_validate(r) for r in reports]


@router.get("/children/{child_id}/reports/{report_id}", response_model=MonthlyReportResponse)
async def get_report(
    child_id: str,
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取月度报告详情"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(MonthlyReport).where(
            MonthlyReport.id == report_id,
            MonthlyReport.child_id == child_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="报告不存在")

    return MonthlyReportResponse.model_validate(report)


@router.get("/children/{child_id}/reports/{report_id}/pdf")
async def download_report_pdf(
    child_id: str,
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """下载月度报告 PDF"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(MonthlyReport).where(
            MonthlyReport.id == report_id,
            MonthlyReport.child_id == child_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="报告不存在")

    if not report.pdf_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF 尚未生成")

    from app.services.media_service import minio_service
    presigned_url = minio_service.get_presigned_url(report.pdf_path)
    return {"download_url": presigned_url}


@router.post("/children/{child_id}/reports/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_report(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动触发生成月度报告"""
    await _verify_child_access(child_id, current_user, db)

    try:
        from app.tasks.report import generate_child_monthly_report
        generate_child_monthly_report.delay(child_id)
    except Exception:
        pass

    return {"message": "已触发月度报告生成"}
