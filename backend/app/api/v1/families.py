from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.family import Family, FamilyMember
from app.schemas.family import (
    FamilyCreateRequest,
    FamilyResponse,
    FamilyDetailResponse,
    FamilyMemberResponse,
)
from app.utils.deps import get_current_user

router = APIRouter()


@router.get("/mine", response_model=FamilyResponse)
async def get_my_family(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的家庭，如果没有则自动创建一个"""
    member_result = await db.execute(
        select(FamilyMember).where(FamilyMember.user_id == current_user.id)
    )
    member = member_result.scalar_one_or_none()

    if member:
        family_result = await db.execute(
            select(Family).where(Family.id == member.family_id)
        )
        family = family_result.scalar_one_or_none()
        if family:
            return FamilyResponse.model_validate(family)

    family = Family(name=f"{current_user.username}的家庭", owner_id=current_user.id)
    db.add(family)
    await db.flush()

    new_member = FamilyMember(
        family_id=family.id, user_id=current_user.id, role="owner"
    )
    db.add(new_member)
    await db.flush()
    await db.refresh(family)

    return FamilyResponse.model_validate(family)


@router.post("/", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
async def create_family(
    body: FamilyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建家庭，自动将创建者添加为 owner"""
    family = Family(name=body.name, owner_id=current_user.id)
    db.add(family)
    await db.flush()

    member = FamilyMember(
        family_id=family.id, user_id=current_user.id, role="owner"
    )
    db.add(member)
    await db.flush()
    await db.refresh(family)

    return FamilyResponse.model_validate(family)


@router.get("/{family_id}", response_model=FamilyDetailResponse)
async def get_family(
    family_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取家庭详情"""
    result = await db.execute(select(Family).where(Family.id == family_id))
    family = result.scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="家庭不存在")

    member_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该家庭")

    members_result = await db.execute(
        select(FamilyMember).where(FamilyMember.family_id == family_id)
    )
    members = list(members_result.scalars().all())

    return FamilyDetailResponse(
        id=family.id,
        name=family.name,
        owner_id=family.owner_id,
        created_at=family.created_at,
        members=[FamilyMemberResponse.model_validate(m) for m in members],
    )


@router.post("/{family_id}/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    family_id: str,
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """邀请用户加入家庭"""
    owner_check = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == current_user.id,
            FamilyMember.role == "owner",
        )
    )
    if not owner_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有家庭所有者可以邀请成员")

    user_result = await db.execute(select(User).where(User.username == username))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    existing = await db.execute(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该用户已是家庭成员")

    member = FamilyMember(
        family_id=family_id, user_id=target_user.id, role="member"
    )
    db.add(member)

    return {"message": f"已邀请 {username} 加入家庭"}
