import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Family(Base):
    __tablename__ = "families"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    owner = relationship("User", back_populates="owned_families", lazy="selectin")
    members = relationship("FamilyMember", back_populates="family", lazy="selectin")
    children = relationship("Child", back_populates="family", lazy="selectin")
    media_files = relationship("MediaFile", back_populates="family", lazy="selectin")


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    family_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("families.id"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(
        SAEnum("owner", "member", name="family_role_enum"),
        default="member",
        nullable=False,
    )

    family = relationship("Family", back_populates="members", lazy="selectin")
    user = relationship("User", back_populates="family_memberships", lazy="selectin")
