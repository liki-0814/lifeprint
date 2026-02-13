from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class FamilyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FamilyResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FamilyMemberResponse(BaseModel):
    id: str
    family_id: str
    user_id: str
    role: str

    model_config = {"from_attributes": True}


class FamilyDetailResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime
    members: list[FamilyMemberResponse] = []

    model_config = {"from_attributes": True}
