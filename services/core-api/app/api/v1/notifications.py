from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", status_code=status.HTTP_200_OK)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="cursor must be an integer offset") from exc

    total = await db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id)
    )
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset).limit(limit + 1)
    )
    rows = list(result.scalars().all())
    next_cursor = str(offset + limit) if len(rows) > limit else None

    return {
        "items": [
            {
                "id": str(n.id),
                "channel": n.channel,
                "subject": n.subject,
                "body": n.body,
                "related_entity_type": n.related_entity_type,
                "related_entity_id": str(n.related_entity_id) if n.related_entity_id else None,
                "status": n.status,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat(),
            }
            for n in rows[:limit]
        ],
        "total": total or 0,
        "unread_count": await db.scalar(
            select(func.count()).select_from(Notification)
            .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        ) or 0,
        "next_cursor": next_cursor,
    }


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    n = await db.get(Notification, notification_id)
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if n.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your notification")

    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        if n.status not in ("delivered", "read"):
            n.status = "read"
        await db.commit()
        await db.refresh(n)

    return {"id": str(n.id), "read_at": n.read_at.isoformat()}
