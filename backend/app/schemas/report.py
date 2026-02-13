from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class MonthlyReportResponse(BaseModel):
    id: str
    child_id: str
    report_month: date
    radar_data: dict
    spark_cards: list
    summary_text: str
    narrative: Optional[str] = None
    generated_at: datetime
    pdf_path: Optional[str] = None

    model_config = {"from_attributes": True}


class MonthlyReportListItem(BaseModel):
    id: str
    report_month: date
    generated_at: datetime
    pdf_path: Optional[str]

    model_config = {"from_attributes": True}


class SkillTreeResponse(BaseModel):
    id: str
    child_id: str
    skill_name: str
    unlocked_at: date
    evidence_media_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class InitiativeMetricResponse(BaseModel):
    date: date
    initiative_score: float
    independent_action_count: int
