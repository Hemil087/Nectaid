from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from geoalchemy2.shape import to_shape
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Need, User
from app.models.assignment import Assignment
from app.schemas.need import NeedResponse, NeedsListResponse
from app.services.firestore_sync import sync_firestore
from app.services.matching_worker import run_matching
from app.services.priority import (
    compute_full_score,
    compute_full_breakdown,
    compute_stable_components,
    compute_stable_score,
)

router = APIRouter(prefix="/needs", tags=["needs"])


# ── Location helper ────────────────────────────────────────────────────────

def _parse_location(location) -> tuple[float | None, float | None]:
    """Extract (lat, lng) from a GeoAlchemy2 WKBElement. Returns (None, None) on failure."""
    if location is None:
        return None, None
    try:
        point = to_shape(location)
        return point.y, point.x  # lat = Y, lng = X
    except Exception:
        return None, None


# ── Serialiser ─────────────────────────────────────────────────────────────

def _serialize_need(need: Need) -> NeedResponse:
    # Priority score returned to client always includes fresh time_pressure
    full_score = compute_full_score(need)
    full_breakdown = (
        compute_full_breakdown(need.priority_breakdown, need.deadline)
        if need.priority_breakdown
        else need.priority_breakdown
    )
    lat, lng = _parse_location(need.location)
    return NeedResponse(
        id=need.id,
        raw_submission_id=need.raw_submission_id,
        org_id=need.org_id,
        need_type=need.need_type,
        category=need.category,
        title=need.title,
        description=need.description,
        description_original=need.description_original,
        original_language=need.original_language,
        location=str(need.location) if need.location is not None else None,
        location_lat=lat,
        location_lng=lng,
        location_text=need.location_text,
        urgency=need.urgency,
        beneficiary_count=need.beneficiary_count,
        required_skills=need.required_skills,
        required_team_size=need.required_team_size,
        resources_needed=need.resources_needed,
        deadline=need.deadline,
        priority_score=full_score,
        priority_breakdown=full_breakdown,
        window_start=need.window_start,
        window_end=need.window_end,
        status=need.status,
        created_by=need.created_by,
        reviewed_by=need.reviewed_by,
        reviewed_at=need.reviewed_at,
        published_at=need.published_at,
        completed_at=need.completed_at,
        created_at=need.created_at,
        updated_at=need.updated_at,
    )


# ── Helper ─────────────────────────────────────────────────────────────────

async def _get_need_or_404(db: AsyncSession, need_id: UUID) -> Need:
    need = await db.get(Need, need_id)
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Need not found")
    return need


# ── Scoring inputs that trigger recompute on PATCH ─────────────────────────
SCORING_FIELDS = {"urgency", "need_type", "category", "beneficiary_count", "required_skills"}


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("", response_model=NeedsListResponse, status_code=status.HTTP_200_OK)
async def list_needs(
    status_filter: str | None = Query(None, alias="status"),
    urgency: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> NeedsListResponse:
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cursor must be an integer offset") from exc

    filters = []
    if status_filter:
        filters.append(Need.status == status_filter)
    if urgency:
        filters.append(Need.urgency == urgency)

    total = await db.scalar(select(func.count()).select_from(Need).where(*filters))
    result = await db.execute(
        select(Need).where(*filters)
        .order_by(Need.created_at.desc(), Need.id.desc())
        .offset(offset).limit(limit + 1)
    )
    rows = list(result.scalars().all())
    next_cursor = str(offset + limit) if len(rows) > limit else None

    return NeedsListResponse(
        items=[_serialize_need(n) for n in rows[:limit]],
        total=total or 0,
        next_cursor=next_cursor,
    )


@router.get("/{need_id}", response_model=NeedResponse, status_code=status.HTTP_200_OK)
async def get_need(
    need_id: UUID,
    _: User = Depends(require_role("coordinator", "admin", "volunteer")),
    db: AsyncSession = Depends(get_db),
) -> NeedResponse:
    need = await _get_need_or_404(db, need_id)
    return _serialize_need(need)


@router.patch("/{need_id}", response_model=NeedResponse, status_code=status.HTTP_200_OK)
async def patch_need(
    need_id: UUID,
    body: dict[str, Any],
    user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> NeedResponse:
    need = await _get_need_or_404(db, need_id)

    if need.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending_review needs can be edited",
        )

    ALLOWED = {
        "title", "need_type", "category", "description", "urgency",
        "beneficiary_count", "required_skills", "required_team_size",
        "resources_needed", "deadline", "window_start", "window_end",
        "location_text",
        # location coords sent separately as location_lat + location_lng
    }
    changed_scoring = False
    for key, value in body.items():
        if key not in ALLOWED:
            continue
        setattr(need, key, value)
        if key in SCORING_FIELDS:
            changed_scoring = True

    # Handle location coordinate update from map picker
    # Frontend sends { location_lat: number, location_lng: number }
    lat = body.get("location_lat")
    lng = body.get("location_lng")
    if lat is not None and lng is not None:
        try:
            lat_f = float(lat)
            lng_f = float(lng)
            need.location = f"SRID=4326;POINT({lng_f} {lat_f})"
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="location_lat and location_lng must be valid numbers",
            )

    # Recompute priority if scoring inputs changed
    if changed_scoring:
        components = compute_stable_components(need)
        need.priority_breakdown = components
        need.priority_score = compute_stable_score(components)

    need.updated_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(need)
    return _serialize_need(need)


@router.post("/{need_id}/publish", response_model=NeedResponse, status_code=status.HTTP_200_OK)
async def publish_need(
    need_id: UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> NeedResponse:
    need = await _get_need_or_404(db, need_id)

    if need.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot publish a need with status '{need.status}'",
        )

    # Compute and persist priority score
    components = compute_stable_components(need)
    need.priority_breakdown = components
    need.priority_score = compute_stable_score(components)

    need.status = "published"
    need.reviewed_by = user.id
    need.reviewed_at = datetime.now(tz=timezone.utc)
    need.published_at = datetime.now(tz=timezone.utc)
    need.updated_at = datetime.now(tz=timezone.utc)

    await db.commit()
    await db.refresh(need)
    background_tasks.add_task(run_matching, str(need.id))

    await sync_firestore("needs", str(need.id), db)
    if need.org_id:
        await sync_firestore(
            "coordinator_feed", str(uuid4()), db,
            org_id=str(need.org_id),
            event_type="need_published",
            extra={"need_id": str(need.id), "title": need.title, "urgency": need.urgency},
        )

    return _serialize_need(need)


@router.post("/{need_id}/rematch", response_model=NeedResponse, status_code=status.HTTP_200_OK)
async def rematch_need(
    need_id: UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> NeedResponse:
    need = await _get_need_or_404(db, need_id)

    REMATCHABLE = {"published", "matching_complete", "assigned", "in_progress"}
    if need.status not in REMATCHABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot re-run matching for a need with status '{need.status}'",
        )

    # Drop pending_accept assignments so those slots are open for fresh matching.
    # Accepted/in_progress assignments are preserved — those volunteers stay on the team.
    await db.execute(
        delete(Assignment).where(
            Assignment.need_id == need_id,
            Assignment.status == "pending_accept",
        )
    )

    need.status = "published"
    need.updated_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(need)

    background_tasks.add_task(run_matching, str(need.id))
    await sync_firestore("needs", str(need.id), db)

    return _serialize_need(need)


@router.post("/{need_id}/cancel", response_model=NeedResponse, status_code=status.HTTP_200_OK)
async def cancel_need(
    need_id: UUID,
    body: dict[str, Any] | None = None,
    user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> NeedResponse:
    need = await _get_need_or_404(db, need_id)

    if need.status in ("completed", "cancelled", "expired"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a need with status '{need.status}'",
        )

    need.status = "cancelled"
    need.updated_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(need)

    await sync_firestore("needs", str(need.id), db)

    return _serialize_need(need)


@router.get("/{need_id}/explain", status_code=status.HTTP_200_OK)
async def explain_need(
    need_id: UUID,
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    need = await _get_need_or_404(db, need_id)

    breakdown = compute_full_breakdown(
        need.priority_breakdown or compute_stable_components(need),
        need.deadline,
    )
    return {
        "priority_score": breakdown.get("total", compute_full_score(need)),
        "breakdown": breakdown,
        "formula": "priority = W_u*u + W_s*s + W_b*log(1+b) + W_t*t - W_r*r",
        "weights": {"W_u": 40, "W_s": 25, "W_b": 20, "W_t": 10, "W_r": 5},
    }


@router.get("/{need_id}/assignments", status_code=status.HTTP_200_OK)
async def get_need_assignments(
    need_id: UUID,
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _get_need_or_404(db, need_id)

    result = await db.execute(
        select(Assignment, User.full_name, User.email)
        .join(User, User.id == Assignment.volunteer_id)
        .where(Assignment.need_id == need_id)
        .order_by(Assignment.assigned_at.desc())
    )
    rows = result.all()

    return {
        "items": [
            {
                "id": str(a.id),
                "need_id": str(a.need_id),
                "volunteer_id": str(a.volunteer_id),
                "volunteer_name": full_name,
                "volunteer_email": email,
                "role_in_team": a.role_in_team,
                "match_score": a.match_score,
                "match_breakdown": a.match_breakdown,
                "status": a.status,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                "accept_deadline": a.accept_deadline.isoformat() if a.accept_deadline else None,
                "responded_at": a.responded_at.isoformat() if a.responded_at else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "coordinator_rating": a.coordinator_rating,
                "completion_notes": a.completion_notes,
                "completion_photo_urls": a.completion_photo_urls,
            }
            for a, full_name, email in rows
        ]
    }

