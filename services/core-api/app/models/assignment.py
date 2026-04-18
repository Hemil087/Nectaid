from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.need import Need
    from app.models.user import User


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_accept','accepted','declined','in_progress','completed','cancelled','no_show','expired')",
            name="assignments_status_check",
        ),
        CheckConstraint(
            "coordinator_rating BETWEEN 1 AND 5",
            name="assignments_coordinator_rating_check",
        ),
        UniqueConstraint("need_id", "volunteer_id", name="uq_assignments_need_volunteer"),
        Index("idx_assign_need", "need_id"),
        Index("idx_assign_volunteer_status", "volunteer_id", "status"),
        Index(
            "idx_assign_pending_deadline",
            "accept_deadline",
            postgresql_where=text("status = 'pending_accept'"),
        ),
        Index("idx_assign_volunteer_recent", "volunteer_id", text("assigned_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    need_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("needs.id", ondelete="CASCADE"),
        nullable=False,
    )
    volunteer_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    role_in_team: Mapped[str | None] = mapped_column(Text)
    match_score: Mapped[float | None] = mapped_column(Float)
    match_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'pending_accept'"),
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    accept_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    coordinator_rating: Mapped[int | None] = mapped_column(Integer)
    volunteer_feedback: Mapped[str | None] = mapped_column(Text)
    completion_notes: Mapped[str | None] = mapped_column(Text)
    completion_photo_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text()))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    need: Mapped["Need"] = relationship(back_populates="assignments")
    volunteer: Mapped["User"] = relationship(back_populates="assignments")
