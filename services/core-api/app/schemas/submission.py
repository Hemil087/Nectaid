from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SubmissionCreate(BaseModel):
    raw_text: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    submitter_phone: str | None = None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    created_at: datetime
