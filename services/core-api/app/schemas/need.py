from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NeedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    raw_submission_id: UUID | None = None
    org_id: UUID | None = None
    need_type: str
    category: str | None = None
    title: str
    description: str
    description_original: str | None = None
    original_language: str | None = None
    location: str | None = None
    location_text: str | None = None
    urgency: str
    beneficiary_count: int
    required_skills: list[str] | None = None
    required_team_size: int
    resources_needed: list[str] | None = None
    deadline: datetime | None = None
    priority_score: float | None = None
    priority_breakdown: dict[str, Any] | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    status: str
    created_by: UUID | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    published_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class NeedsListResponse(BaseModel):
    items: list[NeedResponse]
    total: int
    next_cursor: str | None = None
