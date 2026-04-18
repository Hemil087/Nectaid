from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from geoalchemy2 import Geography
from geoalchemy2.elements import WKBElement
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
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
    from app.models.user import User


class VolunteerProfile(Base):
    __tablename__ = "volunteer_profiles"
    __table_args__ = (
        CheckConstraint(
            "max_travel_km BETWEEN 1 AND 200",
            name="volunteer_profiles_max_travel_km_check",
        ),
        CheckConstraint(
            "reliability_score BETWEEN 0 AND 1",
            name="volunteer_profiles_reliability_score_check",
        ),
        Index(
            "idx_vp_home_location",
            "home_location",
            postgresql_using="gist",
        ),
        Index(
            "idx_vp_skills_embedding",
            "skills_embedding",
            postgresql_using="ivfflat",
            postgresql_ops={"skills_embedding": "vector_cosine_ops"},
            postgresql_with={"lists": 100},
        ),
        Index(
            "idx_vp_active_verified",
            "active",
            "verified",
            postgresql_where=text("active = TRUE"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text()),
        nullable=False,
        server_default=text("'{}'::TEXT[]"),
    )
    skills_text: Mapped[str | None] = mapped_column(Text)
    skills_embedding: Mapped[list[float] | None] = mapped_column(Vector(768))
    certifications: Mapped[list[str] | None] = mapped_column(ARRAY(Text()))
    home_location: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326)
    )
    home_address: Mapped[str | None] = mapped_column(Text)
    max_travel_km: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("20"),
    )
    verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE"),
    )
    verification_docs: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    reliability_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        server_default=text("0.5"),
    )
    total_tasks_completed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    total_tasks_declined: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    notification_prefs: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text(r"""'{"email"\:true,"in_app"\:true}'::JSONB"""),
    )
    email_deliverable: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
    )
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

    user: Mapped["User"] = relationship(back_populates="volunteer_profile")


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    __table_args__ = (
        CheckConstraint(
            "end_time > start_time",
            name="availability_slots_end_after_start_check",
        ),
        Index("idx_avail_volunteer_range", "volunteer_id", "start_time", "end_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    volunteer_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recurrence: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    volunteer: Mapped["User"] = relationship(back_populates="availability_slots")
