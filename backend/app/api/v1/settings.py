from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserSettingsRequest, UserSettingsResponse
from app.utils.deps import get_current_user
from app.ai.remote.llm_client import LLMClient

router = APIRouter()


def mask_api_key(key: str | None) -> str | None:
    """将 API Key 脱敏显示，只保留前 4 位和后 4 位。"""
    if not key:
        return None
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}{'*' * (len(key) - 8)}{key[-4:]}"


@router.get("", response_model=UserSettingsResponse)
async def get_settings(current_user: User = Depends(get_current_user)):
    """获取当前用户的 LLM API 配置。"""
    return UserSettingsResponse(
        llm_provider=current_user.llm_provider,
        llm_api_key_masked=mask_api_key(current_user.llm_api_key),
        llm_base_url=current_user.llm_base_url,
        llm_model=current_user.llm_model,
        llm_vision_model=current_user.llm_vision_model,
    )


@router.put("", response_model=UserSettingsResponse)
async def update_settings(
    body: UserSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户的 LLM API 配置。"""
    if body.llm_provider is not None:
        current_user.llm_provider = body.llm_provider
    if body.llm_api_key is not None:
        current_user.llm_api_key = body.llm_api_key
    if body.llm_base_url is not None:
        current_user.llm_base_url = body.llm_base_url
    if body.llm_model is not None:
        current_user.llm_model = body.llm_model
    if body.llm_vision_model is not None:
        current_user.llm_vision_model = body.llm_vision_model

    await db.flush()
    await db.refresh(current_user)

    return UserSettingsResponse(
        llm_provider=current_user.llm_provider,
        llm_api_key_masked=mask_api_key(current_user.llm_api_key),
        llm_base_url=current_user.llm_base_url,
        llm_model=current_user.llm_model,
        llm_vision_model=current_user.llm_vision_model,
    )


@router.post("/test")
async def test_connection(
    current_user: User = Depends(get_current_user),
):
    """测试当前用户配置的 LLM API 连通性。"""
    client = LLMClient(
        provider=current_user.llm_provider,
        api_key=current_user.llm_api_key,
        base_url=current_user.llm_base_url,
        model=current_user.llm_model,
        vision_model=current_user.llm_vision_model,
    )
    return await client.test_connection()
