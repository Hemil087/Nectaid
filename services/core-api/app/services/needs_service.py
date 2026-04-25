"""
needs_service.py — Creates a Need row from a NeedExtraction result.
Does NOT generate embeddings. Does NOT publish to Pub/Sub.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.need import Need
from app.services.extraction import NeedExtraction
from app.services.priority import compute_stable_components, compute_stable_score


def _parse_deadline(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


async def create_need_from_extraction(
    db: AsyncSession,
    submission_id: str,
    extracted: NeedExtraction,
) -> Need:
    """
    Persist a Need row derived from a NeedExtraction.

    Priority score is computed from the stable components only
    (urgency + severity + beneficiary_scale − resource_difficulty).
    Time pressure is intentionally excluded — it is recomputed on every read.
    """
    need = Need(
        raw_submission_id=uuid.UUID(submission_id),
        need_type=extracted.need_type,
        category=extracted.category,
        title=extracted.title,
        description=extracted.description_en,
        description_original=extracted.description_original,
        original_language=extracted.original_language,
        urgency=extracted.urgency,
        location_text=extracted.location_hint,
        beneficiary_count=extracted.beneficiary_count or 1,
        required_skills=extracted.required_skills or [],
        required_team_size=extracted.required_team_size or 1,
        resources_needed=extracted.resources_needed,
        deadline=_parse_deadline(extracted.time_sensitive_deadline),
        status="pending_review",
    )

    # Compute and persist stable priority components
    breakdown = compute_stable_components(need)
    need.priority_breakdown = breakdown
    need.priority_score = compute_stable_score(breakdown)

    db.add(need)
    await db.flush()
    await db.refresh(need)
    return need
