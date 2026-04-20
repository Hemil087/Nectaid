from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    role: str
    full_name: str
    email: str | None = None
    org_id: UUID | None = None
