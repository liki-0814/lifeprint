from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.child import Child
from app.models.family import FamilyMember
from app.schemas.child import ChildCreateRequest, ChildUpdateRequest, ChildResponse
from app.utils.deps import get_current_user

router = APIRouter()


@router.post(
    "/families/{family_id}/children",
    response_model=ChildResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_child(
    family_id: str,
    body: ChildCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """为家庭添加孩子"""
    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该家庭")

    child = Child(
        family_id=family_id,
        name=body.name,
        birth_date=body.birth_date,
        gender=body.gender,
        avatar_url=body.avatar_url,
    )
    db.add(child)
    await db.flush()
    await db.refresh(child)

    return ChildResponse.model_validate(child)


@router.get("/families/{family_id}/children", response_model=list[ChildResponse])
async def list_children(
    family_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取家庭的孩子列表"""
    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该家庭")

    result = await db.execute(
        select(Child).where(Child.family_id == family_id).order_by(Child.created_at.desc())
    )
    children = list(result.scalars().all())
    return [ChildResponse.model_validate(c) for c in children]


@router.get("/{child_id}", response_model=ChildResponse)
async def get_child(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取孩子详情"""
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="孩子不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == child.family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    return ChildResponse.model_validate(child)


@router.put("/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: str,
    body: ChildUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新孩子信息"""
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="孩子不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == child.family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(child, field, value)

    await db.flush()
    await db.refresh(child)

    return ChildResponse.model_validate(child)
