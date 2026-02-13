from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.child import Child
from app.models.family import FamilyMember
from app.models.report import MonthlyReport
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


def _format_report(report: MonthlyReport) -> dict:
    """将报告格式化为前端期望的结构，radar_data 从嵌套 dict 转为 array"""
    from app.services.report_service import _flatten_radar_data

    radar_data = report.radar_data
    if isinstance(radar_data, dict) and "interest" in radar_data:
        radar_data = _flatten_radar_data(radar_data)

    spark_cards = report.spark_cards or []
    formatted_cards = []
    for card in spark_cards:
        formatted_cards.append({
            "title": card.get("talent_name", card.get("title", "")),
            "description": card.get("suggestion", card.get("description", "")),
            "date": card.get("date", ""),
        })

    return {
        "id": report.id,
        "child_id": report.child_id,
        "report_month": report.report_month.isoformat(),
        "summary_text": report.summary_text,
        "narrative": report.narrative,
        "radar_data": radar_data,
        "spark_cards": formatted_cards,
        "created_at": report.generated_at.isoformat() if report.generated_at else None,
        "pdf_path": report.pdf_path,
    }


@router.get("/children/{child_id}/reports")
async def list_reports(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取孩子的月度报告列表（含完整数据）"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(MonthlyReport)
        .where(MonthlyReport.child_id == child_id)
        .order_by(MonthlyReport.report_month.desc())
    )
    reports = list(result.scalars().all())
    return [_format_report(r) for r in reports]


@router.get("/children/{child_id}/reports/{report_id}")
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

    return _format_report(report)


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
    """手动触发生成月度报告，优先使用 Celery 异步执行，无 Celery 时同步生成"""
    await _verify_child_access(child_id, current_user, db)

    celery_available = False
    try:
        from app.tasks.report import generate_child_monthly_report
        generate_child_monthly_report.delay(child_id)
        celery_available = True
    except Exception:
        pass

    if not celery_available:
        try:
            from app.services.report_service import generate_report_sync
            await generate_report_sync(child_id, db)
        except Exception as error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"报告生成失败: {str(error)}",
            )

    return {"message": "报告生成完成" if not celery_available else "已触发月度报告生成"}
