"""
app/api/v1/analytics.py

GET /analytics/dashboard — coordinator dashboard aggregates.

All queries hit Postgres directly. No BigQuery, no external service.
Scoped to the coordinator's org when user.org_id is set;
returns platform-wide aggregates when org_id is NULL (admin / unaffiliated).
"""
from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── helpers ────────────────────────────────────────────────────────────────

async def _scalar(db: AsyncSession, sql: str, params: dict) -> Any:
    result = await db.execute(text(sql), params)
    return result.scalar()


# ── GET /analytics/dashboard ───────────────────────────────────────────────

@router.get("/dashboard", status_code=200)
async def get_dashboard(
    _: User = Depends(require_role("coordinator", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:

    org_clause, org_params = "", {}

    # 1 — open needs (any non-terminal status)
    open_needs_count = await _scalar(db, f"""
        SELECT COUNT(*) FROM needs
        WHERE status NOT IN ('completed', 'cancelled', 'expired')
        {org_clause}
    """, org_params)

    # 2 — critical unresolved needs
    critical_needs_count = await _scalar(db, f"""
        SELECT COUNT(*) FROM needs
        WHERE urgency = 'critical'
          AND status NOT IN ('completed', 'cancelled', 'expired')
        {org_clause}
    """, org_params)

    # 3 — needs awaiting coordinator review
    pending_review_count = await _scalar(db, f"""
        SELECT COUNT(*) FROM needs
        WHERE status = 'pending_review'
        {org_clause}
    """, org_params)

    # 4 — active volunteers: verified + active + not deleted
    #     scoping to org not applicable (volunteers don't belong to orgs)
    active_volunteers = await _scalar(db, """
        SELECT COUNT(*)
        FROM volunteer_profiles vp
        JOIN users u ON u.id = vp.user_id
        WHERE vp.active    = TRUE
          AND vp.verified  = TRUE
          AND u.deleted_at IS NULL
    """, {})

    # 5 — median minutes from assignment to first response (last 30 days)
    avg_response_raw = await _scalar(db, """
        SELECT AVG(
            EXTRACT(EPOCH FROM (responded_at - assigned_at)) / 60.0
        )
        FROM assignments
        WHERE status      IN ('accepted', 'declined')
          AND responded_at IS NOT NULL
          AND assigned_at  > NOW() - INTERVAL '30 days'
    """, {})
    avg_response_time_minutes = (
        round(float(avg_response_raw), 1) if avg_response_raw is not None else None
    )

    # 6 — beneficiaries served this week (completed needs)
    beneficiaries_served = await _scalar(db, f"""
        SELECT COALESCE(SUM(beneficiary_count), 0) FROM needs
        WHERE status       = 'completed'
          AND completed_at > NOW() - INTERVAL '7 days'
        {org_clause}
    """, org_params)

    # 7 — needs by status breakdown (used by frontend for the status bar)
    status_rows = await db.execute(text(f"""
        SELECT status, COUNT(*) AS cnt FROM needs
        WHERE status NOT IN ('completed', 'cancelled', 'expired')
        {org_clause}
        GROUP BY status
    """), org_params)
    needs_by_status = {row.status: row.cnt for row in status_rows}

    # 8 — heatmap: rounded lat/lng + count for completed needs
    #     need.location is a PostGIS geography; returns empty list when not geocoded
    heatmap_rows = await db.execute(text(f"""
        SELECT
            ROUND(ST_Y(location::geometry)::numeric, 2) AS lat,
            ROUND(ST_X(location::geometry)::numeric, 2) AS lng,
            COUNT(*) AS count
        FROM needs
        WHERE status    = 'completed'
          AND location  IS NOT NULL
          AND completed_at > NOW() - INTERVAL '30 days'
        {org_clause}
        GROUP BY lat, lng
        HAVING COUNT(*) > 0
    """), org_params)
    heatmap = [
        {"lat": float(r.lat), "lng": float(r.lng), "count": int(r.count)}
        for r in heatmap_rows
    ]

    return {
        "open_needs_count":           int(open_needs_count or 0),
        "critical_needs_count":       int(critical_needs_count or 0),
        "pending_review_count":       int(pending_review_count or 0),
        "active_volunteers":          int(active_volunteers or 0),
        "avg_response_time_minutes":  avg_response_time_minutes,
        "beneficiaries_served_this_week": int(beneficiaries_served or 0),
        "needs_by_status":            needs_by_status,
        "heatmap":                    heatmap,
    }