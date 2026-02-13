from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AnalysisResultResponse(BaseModel):
    id: str
    media_id: str
    child_id: str
    analysis_type: str
    result_data: dict
    confidence_score: Optional[float] = None
    analyzed_at: datetime
    model_version: str

    model_config = {"from_attributes": True}


class AnalysisTaskResponse(BaseModel):
    id: str
    media_id: str
    task_type: str
    status: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class GrowthMetricResponse(BaseModel):
    id: str
    child_id: str
    metric_type: str
    metric_value: float
    measured_at: datetime
    source_media_id: Optional[str]

    model_config = {"from_attributes": True}


class GrowthTimelineRequest(BaseModel):
    metric_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
