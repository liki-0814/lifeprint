import uuid
from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # 用户级 LLM 配置（为空时使用系统默认配置）
    llm_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    llm_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    llm_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    llm_vision_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    owned_families = relationship("Family", back_populates="owner", lazy="selectin")
    family_memberships = relationship("FamilyMember", back_populates="user", lazy="selectin")
