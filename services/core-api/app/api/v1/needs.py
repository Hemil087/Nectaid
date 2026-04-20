from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import Need, User
from app.schemas.need import NeedResponse, NeedsListResponse


router = APIRouter(prefix="/needs", tags=["needs"])


def _serialize_need(need: Need) -> NeedResponse:
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
        location_text=need.location_text,
        urgency=need.urgency,
        beneficiary_count=need.beneficiary_count,
        required_skills=need.required_skills,
        required_team_size=need.required_team_size,
        resources_needed=need.resources_needed,
        deadline=need.deadline,
        priority_score=need.priority_score,
        priority_breakdown=need.priority_breakdown,
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


@router.get(
    "",
    response_model=NeedsListResponse,
    status_code=status.HTTP_200_OK,
)
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cursor must be an integer offset",
        ) from exc

    filters = []
    if status_filter:
        filters.append(Need.status == status_filter)
    if urgency:
        filters.append(Need.urgency == urgency)

    total = await db.scalar(
        select(func.count()).select_from(Need).where(*filters)
    )

    result = await db.execute(
        select(Need)
        .where(*filters)
        .order_by(Need.created_at.desc(), Need.id.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    rows = list(result.scalars().all())
    next_cursor = str(offset + limit) if len(rows) > limit else None
    items = rows[:limit]

    return NeedsListResponse(
        items=[_serialize_need(need) for need in items],
        total=total or 0,
        next_cursor=next_cursor,
    )
