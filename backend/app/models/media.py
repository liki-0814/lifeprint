import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, BigInteger, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    family_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("families.id"), nullable=False
    )
    uploader_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    file_type: Mapped[str] = mapped_column(
        SAEnum("video", "image", name="file_type_enum"), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    analysis_status: Mapped[str] = mapped_column(
        SAEnum("pending", "processing", "completed", "failed", name="analysis_status_enum"),
        default="pending",
        nullable=False,
    )
    metadata_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    family = relationship("Family", back_populates="media_files", lazy="selectin")
    uploader = relationship("User", lazy="selectin")
    child_associations = relationship("MediaChild", back_populates="media", lazy="selectin")
    analysis_results = relationship("AnalysisResult", back_populates="media", lazy="selectin")
    analysis_tasks = relationship("AnalysisTask", back_populates="media", lazy="selectin")


class MediaChild(Base):
    __tablename__ = "media_children"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    media_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("media_files.id"), nullable=False
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id"), nullable=False
    )

    media = relationship("MediaFile", back_populates="child_associations", lazy="selectin")
    child = relationship("Child", back_populates="media_associations", lazy="selectin")
