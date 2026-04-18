from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.need import Need
    from app.models.notification import AuditLog, Notification
    from app.models.submission import RawSubmission
    from app.models.volunteer import AvailabilitySlot, VolunteerProfile
    from app.models.assignment import Assignment


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE"),
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

    users: Mapped[list["User"]] = relationship(back_populates="org")
    needs: Mapped[list["Need"]] = relationship(back_populates="org")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('volunteer','coordinator','admin')",
            name="users_role_check",
        ),
        CheckConstraint(
            "preferred_language IN ('en','hi','gu')",
            name="users_preferred_language_check",
        ),
        Index("idx_users_firebase_uid", "firebase_uid"),
        Index(
            "idx_users_role",
            "role",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    firebase_uid: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    preferred_language: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'en'"),
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("orgs.id"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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

    org: Mapped[Org | None] = relationship(back_populates="users")
    volunteer_profile: Mapped["VolunteerProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    availability_slots: Mapped[list["AvailabilitySlot"]] = relationship(
        back_populates="volunteer",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    submitted_submissions: Mapped[list["RawSubmission"]] = relationship(
        back_populates="submitter",
        foreign_keys="RawSubmission.submitted_by",
    )
    created_needs: Mapped[list["Need"]] = relationship(
        back_populates="created_by_user",
        foreign_keys="Need.created_by",
    )
    reviewed_needs: Mapped[list["Need"]] = relationship(
        back_populates="reviewed_by_user",
        foreign_keys="Need.reviewed_by",
    )
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="volunteer")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor_user")
