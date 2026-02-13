import uuid
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id"), nullable=False
    )
    report_month: Mapped[date] = mapped_column(Date, nullable=False)
    radar_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    spark_cards: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    child = relationship("Child", back_populates="monthly_reports", lazy="selectin")


class SkillTree(Base):
    __tablename__ = "skill_tree"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id"), nullable=False
    )
    skill_name: Mapped[str] = mapped_column(String(100), nullable=False)
    unlocked_at: Mapped[date] = mapped_column(Date, nullable=False)
    evidence_media_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("media_files.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    child = relationship("Child", back_populates="skills", lazy="selectin")
    evidence_media = relationship("MediaFile", lazy="selectin")
