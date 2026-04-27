from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LatLng(BaseModel):
    lat: float
    lng: float


class VolunteerCreate(BaseModel):
    full_name: str
    phone: str | None = None
    email: str | None = None
    preferred_language: str = "en"
    skills: list[str] = Field(default_factory=list)
    home_address: str | None = None
    home_location: LatLng | None = None  # { lat, lng } from map picker
    max_travel_km: int = 20
    notification_prefs: dict[str, Any] = Field(
        default_factory=lambda: {"email": True, "in_app": True}
    )


class VolunteerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    firebase_uid: str
    role: str
    full_name: str
    phone: str | None = None
    email: str | None = None
    preferred_language: str
    org_id: UUID | None = None
    deleted_at: datetime | None = None
    user_created_at: datetime
    user_updated_at: datetime
    skills: list[str]
    skills_text: str | None = None
    certifications: list[str] | None = None
    home_address: str | None = None
    home_location_lat: float | None = None
    home_location_lng: float | None = None
    max_travel_km: int
    verified: bool
    verification_docs: dict[str, Any] | None = None
    reliability_score: float
    total_tasks_completed: int
    total_tasks_declined: int
    notification_prefs: dict[str, Any]
    email_deliverable: bool
    active: bool
    profile_created_at: datetime
    profile_updated_at: datetime