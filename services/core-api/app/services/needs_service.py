"""
needs_service.py — Creates a Need row from a NeedExtraction result.
Does NOT generate embeddings. Does NOT publish to Pub/Sub.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import httpx
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


async def geocode_location_hint(location_hint: str) -> tuple[float, float] | None:
    """
    Convert a free-text location hint (e.g. "Kathlal, Kheda, Gujarat") to
    (lat, lng) using the Google Geocoding API.

    Returns None silently on any failure — the need is still created,
    just without coordinates. The coordinator can pin the location manually
    in the review screen.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or not location_hint.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": location_hint.strip() + ", India",
                    "key": api_key,
                    "region": "in",
                },
            )
            data = r.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
    except Exception:
        pass
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

    Location: if location_hint is present, geocodes it via Google Geocoding API
    and stores the result as a PostGIS POINT. If geocoding fails, location is
    left NULL — the coordinator can set it manually in the review screen.
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

    # Geocode location_hint → PostGIS POINT
    if extracted.location_hint:
        coords = await geocode_location_hint(extracted.location_hint)
        print(f"[GEOCODE] hint='{extracted.location_hint}' result={coords}")
        if coords:
            lat, lng = coords
            # WKT format: POINT(lng lat) — note longitude first in WKT
            need.location = f"SRID=4326;POINT({lng} {lat})"
            print(f"[GEOCODE] set location to POINT({lng} {lat})", flush=True)

    # Compute and persist stable priority components
    breakdown = compute_stable_components(need)
    need.priority_breakdown = breakdown
    need.priority_score = compute_stable_score(breakdown)

    db.add(need)
    await db.flush()
    await db.refresh(need)
    return need