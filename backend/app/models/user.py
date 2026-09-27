import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class User(Base):
    __tablename__ = "users"  # actual Postgres table name

    # Primary key, auto-generated UUID (instead of auto-incrementing integer)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)  # unique + indexed for fast login lookup
    password_hash: Mapped[str] = mapped_column(String, nullable=False)  # NEVER store raw password
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())  # Postgres sets this automatically on insert

    # relationship() does NOT create DB columns — it's a Python-side convenience
    # so you can do `user.projects` and get a list of Project objects.
    # cascade="all, delete-orphan" means: if a User is deleted, delete their Projects too.
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    ai_providers = relationship("AIProvider", back_populates="owner", cascade="all, delete-orphan")