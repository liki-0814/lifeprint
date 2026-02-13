from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class MediaUploadInitRequest(BaseModel):
    filename: str
    file_type: str = Field(..., pattern="^(video|image)$")
    file_size: int
    total_parts: int = 1


class MediaUploadInitResponse(BaseModel):
    upload_id: str
    storage_path: str


class MediaUploadCompleteRequest(BaseModel):
    child_ids: list[str] = Field(default_factory=list)
    captured_at: Optional[datetime] = None


class MediaResponse(BaseModel):
    id: str
    family_id: str
    file_type: str
    original_filename: str
    file_size: int
    duration_seconds: Optional[float]
    captured_at: Optional[datetime]
    uploaded_at: datetime
    analysis_status: str

    model_config = {"from_attributes": True}


class MediaDetailResponse(MediaResponse):
    storage_path: str
    metadata_info: Optional[dict]
    analysis_results: list = []
