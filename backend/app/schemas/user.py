from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserSettingsRequest(BaseModel):
    llm_provider: Optional[str] = Field(None, max_length=20, description="openai 或 anthropic")
    llm_api_key: Optional[str] = Field(None, max_length=500, description="LLM API Key")
    llm_base_url: Optional[str] = Field(None, max_length=500, description="LLM Base URL")
    llm_model: Optional[str] = Field(None, max_length=100, description="文本模型名称")
    llm_vision_model: Optional[str] = Field(None, max_length=100, description="视觉模型名称")

class UserSettingsResponse(BaseModel):
    llm_provider: Optional[str] = None
    llm_api_key_masked: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_model: Optional[str] = None
    llm_vision_model: Optional[str] = None

    model_config = {"from_attributes": True}
