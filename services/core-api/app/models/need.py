from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from geoalchemy2 import Geography
from geoalchemy2.elements import WKBElement
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.submission import RawSubmission
    from app.models.user import Org, User


class Need(Base):
    __tablename__ = "needs"
    __table_args__ = (
        CheckConstraint(
            "urgency IN ('critical','high','medium','low')",
            name="needs_urgency_check",
        ),
        CheckConstraint("beneficiary_count >= 0", name="needs_beneficiary_count_check"),
        CheckConstraint("required_team_size >= 1", name="needs_required_team_size_check"),
        CheckConstraint(
            "status IN ('pending_review','published','matching_complete','assigned','in_progress','completed','cancelled','expired')",
            name="needs_status_check",
        ),
        Index("idx_needs_location", "location", postgresql_using="gist"),
        Index(
            "idx_needs_embedding",
            "embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_with={"lists": 100},
        ),
        Index("idx_needs_status_priority", "status", text("priority_score DESC")),
        Index(
            "idx_needs_urgency_deadline",
            "urgency",
            "deadline",
            postgresql_where=text("status = 'published'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    raw_submission_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("raw_submissions.id"),
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("orgs.id"),
    )
    need_type: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    description_original: Mapped[str | None] = mapped_column(Text)
    original_language: Mapped[str | None] = mapped_column(Text)
    location: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326)
    )
    location_text: Mapped[str | None] = mapped_column(Text)
    urgency: Mapped[str] = mapped_column(Text, nullable=False)
    beneficiary_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("1"),
    )
    required_skills: Mapped[list[str] | None] = mapped_column(ARRAY(Text()))
    required_team_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("1"),
    )
    resources_needed: Mapped[list[str] | None] = mapped_column(ARRAY(Text()))
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority_score: Mapped[float | None] = mapped_column(Float)
    priority_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768))
    window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'pending_review'"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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

    raw_submission: Mapped["RawSubmission | None"] = relationship(back_populates="needs")
    org: Mapped["Org | None"] = relationship(back_populates="needs")
    created_by_user: Mapped["User | None"] = relationship(
        back_populates="created_needs",
        foreign_keys=[created_by],
    )
    reviewed_by_user: Mapped["User | None"] = relationship(
        back_populates="reviewed_needs",
        foreign_keys=[reviewed_by],
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="need",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
