from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import User
from app.models.volunteer import VolunteerProfile

router = APIRouter(prefix="/admin", tags=["admin"])


def _serialize_volunteer(user: User, profile: VolunteerProfile) -> dict:
    return {
        "user_id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "skills": profile.skills,
        "home_address": profile.home_address,
        "max_travel_km": profile.max_travel_km,
        "verified": profile.verified,
        "active": profile.active,
        "reliability_score": profile.reliability_score,
        "total_tasks_completed": profile.total_tasks_completed,
        "total_tasks_declined": profile.total_tasks_declined,
        "profile_created_at": profile.created_at.isoformat(),
    }


# ── GET /admin/volunteers ─────────────────────────────────────────────────────

@router.get("/volunteers", status_code=status.HTTP_200_OK)
async def list_all_volunteers(
    verified: bool | None = Query(None),
    active: bool | None = Query(None),
    skill: str | None = Query(None, description="Filter by skill tag (substring match)"),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="cursor must be an integer offset") from exc

    filters = [User.deleted_at.is_(None)]
    if verified is not None:
        filters.append(VolunteerProfile.verified == verified)
    if active is not None:
        filters.append(VolunteerProfile.active == active)
    if skill:
        filters.append(VolunteerProfile.skills.any(skill.lower()))

    base_q = (
        select(User, VolunteerProfile)
        .join(VolunteerProfile, VolunteerProfile.user_id == User.id)
        .where(*filters)
    )

    total = await db.scalar(
        select(func.count()).select_from(base_q.subquery())
    )
    result = await db.execute(
        base_q.order_by(VolunteerProfile.created_at.desc())
        .offset(offset).limit(limit + 1)
    )
    rows = result.all()
    next_cursor = str(offset + limit) if len(rows) > limit else None

    return {
        "items": [_serialize_volunteer(u, p) for u, p in rows[:limit]],
        "total": total or 0,
        "next_cursor": next_cursor,
    }


# ── PATCH /admin/volunteers/{id}/verify ───────────────────────────────────────

@router.patch("/volunteers/{user_id}/verify", status_code=status.HTTP_200_OK)
async def verify_volunteer(
    user_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(VolunteerProfile).where(VolunteerProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer profile not found")

    profile.verified = True
    profile.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"user_id": str(user_id), "verified": True}


# ── POST /admin/users/{id}/suspend ────────────────────────────────────────────

@router.post("/users/{user_id}/suspend", status_code=status.HTTP_200_OK)
async def suspend_user(
    user_id: uuid.UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already suspended")

    user.deleted_at = datetime.now(timezone.utc)
    await db.commit()

    return {"user_id": str(user_id), "suspended_at": user.deleted_at.isoformat()}
