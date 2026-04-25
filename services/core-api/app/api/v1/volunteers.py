from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_user_by_firebase_uid,
    require_role,
    verify_firebase_token_from_header,
)
from app.models import Need, User, VolunteerProfile
from app.models.assignment import Assignment
from app.schemas.volunteer import VolunteerCreate, VolunteerResponse


router = APIRouter(prefix="/volunteers", tags=["volunteers"])


def _normalize_role(claims_role: object) -> str:
    role = str(claims_role or "volunteer").lower()
    return role if role in {"volunteer", "coordinator", "admin"} else "volunteer"


def _volunteer_response(user: User, profile: VolunteerProfile) -> VolunteerResponse:
    return VolunteerResponse(
        id=user.id,
        firebase_uid=user.firebase_uid,
        role=user.role,
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
        preferred_language=user.preferred_language,
        org_id=user.org_id,
        deleted_at=user.deleted_at,
        user_created_at=user.created_at,
        user_updated_at=user.updated_at,
        skills=profile.skills,
        skills_text=profile.skills_text,
        certifications=profile.certifications,
        home_address=profile.home_address,
        max_travel_km=profile.max_travel_km,
        verified=profile.verified,
        verification_docs=profile.verification_docs,
        reliability_score=profile.reliability_score,
        total_tasks_completed=profile.total_tasks_completed,
        total_tasks_declined=profile.total_tasks_declined,
        notification_prefs=profile.notification_prefs,
        email_deliverable=profile.email_deliverable,
        active=profile.active,
        profile_created_at=profile.created_at,
        profile_updated_at=profile.updated_at,
    )


async def _get_profile(db: AsyncSession, user_id):
    result = await db.execute(
        select(VolunteerProfile).where(VolunteerProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


@router.post(
    "",
    response_model=VolunteerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_volunteer(
    payload: VolunteerCreate,
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> VolunteerResponse:
    claims = verify_firebase_token_from_header(authorization)
    user = await get_user_by_firebase_uid(db, claims["uid"])

    if user is None:
        user = User(
            firebase_uid=claims["uid"],
            role=_normalize_role(claims.get("role")),
            full_name=payload.full_name,
            phone=payload.phone,
            email=payload.email or claims.get("email"),
            preferred_language=payload.preferred_language,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    elif user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was deleted",
        )
    else:
        user.full_name = payload.full_name
        user.phone = payload.phone
        user.email = payload.email
        user.preferred_language = payload.preferred_language

    existing_profile = await _get_profile(db, user.id)
    if existing_profile is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Volunteer profile already exists",
        )

    profile = VolunteerProfile(
        user_id=user.id,
        skills=payload.skills,
        home_address=payload.home_address,
        max_travel_km=payload.max_travel_km,
        notification_prefs=payload.notification_prefs,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    await db.refresh(user)

    return _volunteer_response(user, profile)


@router.get(
    "/me",
    response_model=VolunteerResponse,
    status_code=status.HTTP_200_OK,
)
async def get_my_profile(
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> VolunteerResponse:
    profile = await _get_profile(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found",
        )

    return _volunteer_response(current_user, profile)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    current_user.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── PATCH /volunteers/me ───────────────────────────────────────────────────

_PATCH_USER_FIELDS    = {"full_name", "phone", "email", "preferred_language"}
_PATCH_PROFILE_FIELDS = {"skills", "home_address", "max_travel_km", "notification_prefs", "certifications"}


@router.patch(
    "/me",
    response_model=VolunteerResponse,
    status_code=status.HTTP_200_OK,
)
async def patch_my_profile(
    body: dict,
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> VolunteerResponse:
    profile = await _get_profile(db, current_user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer profile not found")

    skills_changed = False
    now = datetime.now(timezone.utc)

    for key, value in body.items():
        if key in _PATCH_USER_FIELDS:
            setattr(current_user, key, value)
        elif key in _PATCH_PROFILE_FIELDS:
            if key == "skills":
                skills_changed = True
            setattr(profile, key, value)

    current_user.updated_at = now
    profile.updated_at = now

    # Re-generate skill embedding asynchronously when skills change
    if skills_changed:
        from app.services.embedding import embed_need_text
        import asyncio
        skills_text = " | ".join(profile.skills or [])
        if skills_text.strip():
            profile.skills_text = skills_text
            try:
                profile.skills_embedding = await embed_need_text(skills_text)
            except Exception as exc:
                # Non-fatal — embedding can be regenerated later
                import logging
                logging.getLogger(__name__).warning("skills embedding failed: %s", exc)

    await db.commit()
    await db.refresh(current_user)
    await db.refresh(profile)
    return _volunteer_response(current_user, profile)


# ── GET /volunteers/me/assignments ────────────────────────────────────────

@router.get(
    "/me/assignments",
    status_code=status.HTTP_200_OK,
)
async def get_my_assignments(
    current_user: User = Depends(require_role("volunteer")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Assignment)
        .where(Assignment.volunteer_id == current_user.id)
        .order_by(Assignment.assigned_at.desc())
    )
    assignments = list(result.scalars().all())

    # Fetch associated needs in one query
    need_ids = list({a.need_id for a in assignments})
    needs_map: dict[uuid.UUID, Need] = {}
    if need_ids:
        needs_result = await db.execute(select(Need).where(Need.id.in_(need_ids)))
        for n in needs_result.scalars():
            needs_map[n.id] = n

    items = []
    for a in assignments:
        need = needs_map.get(a.need_id)
        items.append({
            "assignment_id": str(a.id),
            "need": {
                "id": str(need.id) if need else str(a.need_id),
                "title": need.title if need else None,
                "need_type": need.need_type if need else None,
                "urgency": need.urgency if need else None,
                "location_text": need.location_text if need else None,
                "status": need.status if need else None,
            },
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
            "completion_notes": a.completion_notes,
            "completion_photo_urls": a.completion_photo_urls,
        })

    return {"items": items, "total": len(items)}