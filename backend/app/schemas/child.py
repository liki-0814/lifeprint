from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


class ChildCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    birth_date: date
    gender: str = Field(..., pattern="^(male|female|other)$")
    avatar_url: Optional[str] = None


class ChildUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    birth_date: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    avatar_url: Optional[str] = None


class ChildResponse(BaseModel):
    id: str
    family_id: str
    name: str
    birth_date: date
    gender: str
    avatar_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
