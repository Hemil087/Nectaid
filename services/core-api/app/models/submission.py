from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.need import Need
    from app.models.user import User


class RawSubmission(Base):
    __tablename__ = "raw_submissions"
    __table_args__ = (
        CheckConstraint(
            "source IN ('webform','email','api')",
            name="raw_submissions_source_check",
        ),
        CheckConstraint(
            "status IN ('received','processing','extracted','failed','discarded')",
            name="raw_submissions_status_check",
        ),
        Index("idx_raw_status", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    source: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
    )
    submitter_phone: Mapped[str | None] = mapped_column(Text)
    raw_text: Mapped[str | None] = mapped_column(Text)
    image_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text()))
    audio_url: Mapped[str | None] = mapped_column(Text)
    submission_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'received'"),
    )
    extraction_error: Mapped[str | None] = mapped_column(Text)
    extracted_need_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    submitter: Mapped["User | None"] = relationship(
        back_populates="submitted_submissions",
        foreign_keys=[submitted_by],
    )
    needs: Mapped[list["Need"]] = relationship(back_populates="raw_submission")
