import uuid
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Child(Base):
    __tablename__ = "children"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    family_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("families.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gender: Mapped[str] = mapped_column(
        SAEnum("male", "female", "other", name="gender_enum"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    family = relationship("Family", back_populates="children", lazy="selectin")
    media_associations = relationship("MediaChild", back_populates="child", lazy="selectin")
    analysis_results = relationship("AnalysisResult", back_populates="child", lazy="selectin")
    growth_metrics = relationship("GrowthMetric", back_populates="child", lazy="selectin")
    monthly_reports = relationship("MonthlyReport", back_populates="child", lazy="selectin")
    skills = relationship("SkillTree", back_populates="child", lazy="selectin")
