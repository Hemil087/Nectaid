from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import User

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


def _parse_week(week: str) -> tuple[datetime, datetime]:
    """Parse 'YYYY-WNN' into (week_start_utc, week_end_utc)."""
    try:
        week_start = datetime.strptime(f"{week}-1", "%G-W%V-%u").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise HTTPException(400, "week must be ISO format: YYYY-WNN e.g. 2026-W17") from exc
    return week_start, week_start + timedelta(days=7)


@router.get("/weekly")
async def weekly_report(
    week: str = Query(..., description="ISO week: YYYY-WNN e.g. 2026-W17"),
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    week_start, week_end = _parse_week(week)

    # ── 1. Total needs submitted ──────────────────────────────────────────────
    total_submitted = await db.scalar(text("""
        SELECT COUNT(*) FROM needs
        WHERE created_at >= :ws AND created_at < :we
    """), {"ws": week_start, "we": week_end}) or 0

    # ── 2. Needs resolved (completed or cancelled this week) ─────────────────
    needs_resolved = await db.scalar(text("""
        SELECT COUNT(*) FROM needs
        WHERE status IN ('completed', 'cancelled')
          AND updated_at >= :ws AND updated_at < :we
    """), {"ws": week_start, "we": week_end}) or 0

    # ── 3. Avg time-to-accept by urgency (minutes) ────────────────────────────
    tta_rows = await db.execute(text("""
        SELECT n.urgency,
               ROUND(AVG(EXTRACT(EPOCH FROM (a.responded_at - a.assigned_at)) / 60.0)::numeric, 1) AS avg_minutes
        FROM assignments a
        JOIN needs n ON n.id = a.need_id
        WHERE a.responded_at IS NOT NULL
          AND a.responded_at >= :ws AND a.responded_at < :we
          AND a.status NOT IN ('declined', 'expired', 'no_show', 'cancelled')
        GROUP BY n.urgency
    """), {"ws": week_start, "we": week_end})
    avg_time_to_accept = {row.urgency: float(row.avg_minutes) for row in tta_rows}

    # ── 4. Beneficiaries served ───────────────────────────────────────────────
    beneficiaries_served = await db.scalar(text("""
        SELECT COALESCE(SUM(beneficiary_count), 0) FROM needs
        WHERE status = 'completed'
          AND completed_at >= :ws AND completed_at < :we
    """), {"ws": week_start, "we": week_end}) or 0

    # ── 5. Volunteer hours logged ─────────────────────────────────────────────
    vol_hours_raw = await db.scalar(text("""
        SELECT COALESCE(
            SUM(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600.0), 0
        ) FROM assignments
        WHERE status = 'completed'
          AND completed_at IS NOT NULL AND started_at IS NOT NULL
          AND completed_at >= :ws AND completed_at < :we
    """), {"ws": week_start, "we": week_end}) or 0
    volunteer_hours_logged = round(float(vol_hours_raw), 1)

    # ── 6. Top 5 need types by volume ─────────────────────────────────────────
    type_rows = await db.execute(text("""
        SELECT need_type, COUNT(*) AS cnt FROM needs
        WHERE created_at >= :ws AND created_at < :we
        GROUP BY need_type ORDER BY cnt DESC LIMIT 5
    """), {"ws": week_start, "we": week_end})
    top_need_types = [{"need_type": r.need_type, "count": int(r.cnt)} for r in type_rows]

    # ── 7. Top 5 locations by need count ─────────────────────────────────────
    loc_rows = await db.execute(text("""
        SELECT location_text, COUNT(*) AS cnt FROM needs
        WHERE created_at >= :ws AND created_at < :we
          AND location_text IS NOT NULL
        GROUP BY location_text ORDER BY cnt DESC LIMIT 5
    """), {"ws": week_start, "we": week_end})
    top_locations = [{"location": r.location_text, "count": int(r.cnt)} for r in loc_rows]

    return {
        "week": week,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_needs_submitted": int(total_submitted),
        "needs_resolved": int(needs_resolved),
        "avg_time_to_accept_by_urgency": avg_time_to_accept,
        "beneficiaries_served": int(beneficiaries_served),
        "volunteer_hours_logged": volunteer_hours_logged,
        "top_need_types": top_need_types,
        "top_locations": top_locations,
    }
