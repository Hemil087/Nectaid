"""
app/api/v1/assignments.py

Assignment lifecycle endpoints for volunteers and coordinators.

POST /assignments/{id}/accept   — volunteer accepts
POST /assignments/{id}/decline  — volunteer declines
POST /assignments/{id}/status   — volunteer updates status (in_progress / completed)
POST /assignments/{id}/rate     — coordinator rates volunteer after completion
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Need, User
from app.models.assignment import Assignment
from app.models.volunteer import VolunteerProfile
from app.services.firestore_sync import sync_firestore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assignments", tags=["assignments"])


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_assignment_or_404(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment:
    a = await db.get(Assignment, assignment_id)
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return a


def _serialize(a: Assignment) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "need_id": str(a.need_id),
        "volunteer_id": str(a.volunteer_id),
        "role_in_team": a.role_in_team,
        "match_score": a.match_score,
        "match_breakdown": a.match_breakdown,
        "status": a.status,
        "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
        "accept_deadline": a.accept_deadline.isoformat() if a.accept_deadline else None,
        "responded_at": a.responded_at.isoformat() if a.responded_at else None,
        "started_at": a.started_at.isoformat() if a.started_at else None,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "coordinator_rating": a.coordinator_rating,
        "volunteer_feedback": a.volunteer_feedback,
        "completion_notes": a.completion_notes,
        "completion_photo_urls": a.completion_photo_urls,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


async def _count_accepted(db: AsyncSession, need_id: uuid.UUID) -> tuple[int, int]:
    """Returns (accepted_count, required_team_size)."""
    need = await db.get(Need, need_id)
    if need is None:
        return 0, 0

    result = await db.execute(
        select(func.count()).select_from(Assignment).where(
            Assignment.need_id == need_id,
            Assignment.status == "accepted",
        )
    )
    accepted = result.scalar() or 0
    return accepted, need.required_team_size or 1


async def _maybe_transition_need(
    db: AsyncSession, need_id: uuid.UUID, new_status: str
) -> None:
    """Transition need.status if the business rule is met. Commits nothing — caller commits."""
    need = await db.get(Need, need_id)
    if need is None:
        return

    if new_status == "assigned":
        # All required slots accepted → assigned
        accepted, required = await _count_accepted(db, need_id)
        if accepted >= required and need.status == "matching_complete":
            need.status = "assigned"
            need.updated_at = datetime.now(timezone.utc)

    elif new_status == "in_progress":
        if need.status == "assigned":
            need.status = "in_progress"
            need.updated_at = datetime.now(timezone.utc)

    elif new_status == "completed":
        # All assignments for this need are completed
        result = await db.execute(
            select(func.count()).select_from(Assignment).where(
                Assignment.need_id == need_id,
                Assignment.status.notin_(["completed", "declined", "expired", "cancelled", "no_show"]),
            )
        )
        non_terminal = result.scalar() or 0
        if non_terminal == 0 and need.status in ("in_progress", "assigned"):
            need.status = "completed"
            need.completed_at = datetime.now(timezone.utc)
            need.updated_at = datetime.now(timezone.utc)


# ── POST /assignments/{id}/accept ──────────────────────────────────────────

@router.post("/{assignment_id}/accept", status_code=status.HTTP_200_OK)
async def accept_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    a = await _get_assignment_or_404(db, assignment_id)

    if a.volunteer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your assignment")

    if a.status != "pending_accept":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot accept assignment with status '{a.status}'",
        )

    now = datetime.now(timezone.utc)
    a.status = "accepted"
    a.responded_at = now
    a.updated_at = now
    await db.flush()

    # Transition need → assigned if all roles accepted
    await _maybe_transition_need(db, a.need_id, "assigned")
    await db.commit()
    await db.refresh(a)

    await sync_firestore("assignments", str(assignment_id), db)
    logger.info("assignment_accepted id=%s volunteer=%s", assignment_id, current_user.id)
    return _serialize(a)


# ── POST /assignments/{id}/decline ────────────────────────────────────────

@router.post("/{assignment_id}/decline", status_code=status.HTTP_200_OK)
async def decline_assignment(
    assignment_id: uuid.UUID,
    body: dict[str, Any] = Body(default={}),
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    a = await _get_assignment_or_404(db, assignment_id)

    if a.volunteer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your assignment")

    if a.status not in ("pending_accept",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot decline assignment with status '{a.status}'",
        )

    now = datetime.now(timezone.utc)
    a.status = "declined"
    a.responded_at = now
    a.volunteer_feedback = body.get("reason")
    a.updated_at = now
    await db.commit()
    await db.refresh(a)

    await sync_firestore("assignments", str(assignment_id), db)
    logger.info("assignment_declined id=%s volunteer=%s", assignment_id, current_user.id)
    return _serialize(a)


# ── POST /assignments/{id}/status ─────────────────────────────────────────

@router.post("/{assignment_id}/status", status_code=status.HTTP_200_OK)
async def update_assignment_status(
    assignment_id: uuid.UUID,
    body: dict[str, Any] = Body(...),
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    a = await _get_assignment_or_404(db, assignment_id)

    if a.volunteer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your assignment")

    new_status = body.get("status")
    if new_status not in ("in_progress", "completed"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status must be 'in_progress' or 'completed'",
        )

    # Validate transition
    VALID_TRANSITIONS = {
        "in_progress": {"accepted"},
        "completed": {"in_progress"},
    }
    if a.status not in VALID_TRANSITIONS.get(new_status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move from '{a.status}' to '{new_status}'",
        )

    now = datetime.now(timezone.utc)
    a.status = new_status
    a.completion_notes = body.get("notes") or a.completion_notes
    a.completion_photo_urls = body.get("photo_urls") or a.completion_photo_urls
    a.updated_at = now

    if new_status == "in_progress":
        a.started_at = now
    elif new_status == "completed":
        a.completed_at = now

    await db.flush()

    # Cascade need status
    need_new = "in_progress" if new_status == "in_progress" else "completed"
    await _maybe_transition_need(db, a.need_id, need_new)
    await db.commit()
    await db.refresh(a)

    await sync_firestore("assignments", str(assignment_id), db)
    logger.info("assignment_status id=%s -> %s volunteer=%s", assignment_id, new_status, current_user.id)
    return _serialize(a)


# ── POST /assignments/{id}/rate ────────────────────────────────────────────

@router.post("/{assignment_id}/rate", status_code=status.HTTP_200_OK)
async def rate_assignment(
    assignment_id: uuid.UUID,
    body: dict[str, Any] = Body(...),
    current_user: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    a = await _get_assignment_or_404(db, assignment_id)

    if a.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Can only rate completed assignments",
        )

    rating = body.get("rating")
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rating must be an integer between 1 and 5",
        )

    a.coordinator_rating = rating
    a.volunteer_feedback = body.get("feedback") or a.volunteer_feedback
    a.updated_at = datetime.now(timezone.utc)

    # Update volunteer reliability score via EMA
    profile_result = await db.execute(
        select(VolunteerProfile).where(VolunteerProfile.user_id == a.volunteer_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is not None:
        alpha = 0.2
        normalized = (rating - 1) / 4.0  # maps 1..5 → 0..1
        new_score = alpha * normalized + (1 - alpha) * profile.reliability_score
        # Clamp to [0.05, 1.0] — keeps bad-streak volunteers eligible
        profile.reliability_score = max(0.05, min(1.0, new_score))
        profile.total_tasks_completed = (profile.total_tasks_completed or 0) + 1
        profile.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(a)

    await sync_firestore("assignments", str(assignment_id), db)
    logger.info(
        "assignment_rated id=%s rating=%d coordinator=%s",
        assignment_id, rating, current_user.id,
    )
    return _serialize(a)