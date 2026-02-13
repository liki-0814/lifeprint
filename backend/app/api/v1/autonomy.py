from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.child import Child
from app.models.family import FamilyMember
from app.models.report import SkillTree
from app.models.analysis import AnalysisResult, GrowthMetric
from app.schemas.report import SkillTreeResponse, InitiativeMetricResponse
from app.utils.deps import get_current_user

router = APIRouter()


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


@router.get("/children/{child_id}/skills", response_model=list[SkillTreeResponse])
async def get_skill_tree(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取孩子的技能树"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(SkillTree)
        .where(SkillTree.child_id == child_id)
        .order_by(SkillTree.unlocked_at.desc())
    )
    skills = list(result.scalars().all())
    return [SkillTreeResponse.model_validate(s) for s in skills]


@router.get("/children/{child_id}/initiative", response_model=list[InitiativeMetricResponse])
async def get_initiative_metrics(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取孩子的主动性指标趋势"""
    await _verify_child_access(child_id, current_user, db)

    result = await db.execute(
        select(GrowthMetric)
        .where(
            GrowthMetric.child_id == child_id,
            GrowthMetric.metric_type == "initiative",
        )
        .order_by(GrowthMetric.measured_at.desc())
        .limit(90)
    )
    metrics = list(result.scalars().all())

    return [
        InitiativeMetricResponse(
            date=m.measured_at,
            initiative_score=m.metric_value,
            independent_action_count=int(m.metric_value * 10),
        )
        for m in metrics
    ]
