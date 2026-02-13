import uuid
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Float, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    media_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("media_files.id"), nullable=False
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id"), nullable=False
    )
    analysis_type: Mapped[str] = mapped_column(
        SAEnum("behavior", "emotion", "cognition", "autonomy", name="analysis_type_enum"),
        nullable=False,
    )
    result_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False, default="v1.0")

    media = relationship("MediaFile", back_populates="analysis_results", lazy="selectin")
    child = relationship("Child", back_populates="analysis_results", lazy="selectin")


class AnalysisTask(Base):
    __tablename__ = "analysis_tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    media_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("media_files.id"), nullable=False
    )
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum("queued", "running", "completed", "failed", name="task_status_enum"),
        default="queued",
        nullable=False,
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    media = relationship("MediaFile", back_populates="analysis_tasks", lazy="selectin")


class GrowthMetric(Base):
    __tablename__ = "growth_metrics"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id"), nullable=False
    )
    metric_type: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    measured_at: Mapped[date] = mapped_column(Date, nullable=False)
    source_media_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("media_files.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    child = relationship("Child", back_populates="growth_metrics", lazy="selectin")
    source_media = relationship("MediaFile", lazy="selectin")
