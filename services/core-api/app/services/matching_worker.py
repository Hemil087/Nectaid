"""
matching_worker.py — Orchestrates the full matching pipeline for a published need.

Called as a FastAPI BackgroundTask from POST /needs/{id}/publish.

  Phase 1  — fetch candidate volunteers via raw SQL
             (pgvector cosine + PostGIS radius + availability + no double-book)
  Phase 2+3 — score + form team  (delegated to matching.py)
  Phase 4  — persist Assignment rows, transition need.status

No Pub/Sub, no separate Cloud Run service — runs inline for MVP.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models.assignment import Assignment
from app.models.need import Need
from app.services.matching import CandidateVolunteer, form_team

logger = logging.getLogger(__name__)

ACCEPT_DEADLINE_MINUTES = 15


# ──────────────────────────────────────────────────────────────────────────────
# Phase 1 — candidate SQL
# ──────────────────────────────────────────────────────────────────────────────

def _embedding_to_pg(vec: list[float]) -> str:
    """Convert Python float list → Postgres vector literal, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


async def _fetch_candidates(
    db: AsyncSession,
    need: Need,
) -> list[CandidateVolunteer]:
    """
    Run the candidate-fetch SQL and return CandidateVolunteer instances.

    Graceful degradation:
    - No need embedding   → similarity defaults to 0.3, ORDER BY reliability_score
    - No need location    → geospatial filter skipped, distance_km = 0
    - No time window      → availability + double-booking filters skipped
    """
    has_embedding = need.embedding is not None
    has_location = need.location is not None
    has_window = need.window_start is not None and need.window_end is not None

    # ── Build dynamic SQL clauses ────────────────────────────────────────────

    similarity_expr = (
        f"1.0 - (vp.skills_embedding <=> '{_embedding_to_pg(need.embedding)}'::vector)"
        if has_embedding
        else "0.3"
    )

    geo_filter = (
        "AND ST_DWithin(vp.home_location, ST_GeogFromText(:need_location), vp.max_travel_km * 1000)"
        if has_location
        else ""
    )

    distance_expr = (
        "ST_Distance(vp.home_location, ST_GeogFromText(:need_location)) / 1000.0"
        if has_location
        else "0.0"
    )

    avail_filter = (
        """
        AND EXISTS (
            SELECT 1 FROM availability_slots av
            WHERE av.volunteer_id = vp.user_id
              AND av.start_time <= :window_end
              AND av.end_time   >= :window_start
        )
        """
        if has_window
        else ""
    )

    # Double-booking uses tstzrange; needs real timestamps.
    # If no window we skip rather than block on guessed times.
    double_book_filter = (
        """
        AND NOT EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.volunteer_id = vp.user_id
              AND a.status IN ('pending_accept', 'accepted', 'in_progress')
              AND tstzrange(
                    a.assigned_at,
                    COALESCE(a.completed_at, 'infinity'::timestamptz),
                    '[)'
                  )
                  && tstzrange(:window_start::timestamptz, :window_end::timestamptz, '[)')
        )
        """
        if has_window
        else ""
    )

    order_clause = (
        f"ORDER BY vp.skills_embedding <=> '{_embedding_to_pg(need.embedding)}'::vector"
        if has_embedding
        else "ORDER BY vp.reliability_score DESC"
    )

    sql_str = f"""
    SELECT
        vp.user_id::text,
        u.full_name,
        vp.skills,
        vp.reliability_score,
        {similarity_expr}                           AS similarity,
        {distance_expr}                             AS distance_km,
        vp.max_travel_km,

        (SELECT COUNT(*) FROM assignments a2
         WHERE a2.volunteer_id = vp.user_id
           AND a2.assigned_at  > NOW() - INTERVAL '7 days'
           AND a2.status IN ('accepted', 'in_progress', 'completed')
        ) AS tasks_this_week,

        (SELECT COUNT(*) FROM assignments a3
         JOIN needs n3 ON n3.id = a3.need_id
         WHERE a3.volunteer_id  = vp.user_id
           AND a3.status        = 'completed'
           AND n3.need_type     = :need_type
        ) AS experience_in_type

    FROM volunteer_profiles vp
    JOIN users u ON u.id = vp.user_id
    WHERE
        vp.active      = TRUE
        AND vp.verified = TRUE
        AND u.deleted_at IS NULL

        -- Not previously declined/expired on THIS need
        AND NOT EXISTS (
            SELECT 1 FROM assignments a4
            WHERE a4.volunteer_id = vp.user_id
              AND a4.need_id      = :need_id
              AND a4.status IN ('declined', 'expired', 'no_show')
        )

        {geo_filter}
        {avail_filter}
        {double_book_filter}

    {order_clause}
    LIMIT 50
    """

    params: dict[str, Any] = {
        "need_id":   str(need.id),
        "need_type": need.need_type,
    }
    if has_location:
        # need.location is a WKBElement — convert to WKT via ST_AsText in a quick query
        wkt_result = await db.execute(
            text("SELECT ST_AsText(:geom)"), {"geom": need.location}
        )
        params["need_location"] = "SRID=4326;" + (wkt_result.scalar() or "POINT(0 0)")

    if has_window:
        params["window_start"] = need.window_start.isoformat()
        params["window_end"] = need.window_end.isoformat()

    rows = await db.execute(text(sql_str), params)
    candidates: list[CandidateVolunteer] = []
    for row in rows.mappings():
        candidates.append(
            CandidateVolunteer(
                user_id=row["user_id"],
                full_name=row["full_name"],
                skills=list(row["skills"] or []),
                reliability_score=float(row["reliability_score"] or 0.5),
                similarity=float(row["similarity"] or 0.3),
                distance_km=float(row["distance_km"] or 0.0),
                max_travel_km=int(row["max_travel_km"] or 20),
                tasks_this_week=int(row["tasks_this_week"] or 0),
                experience_in_type=int(row["experience_in_type"] or 0),
            )
        )

    logger.info(
        "matching_candidates need=%s found=%d", need.id, len(candidates)
    )
    return candidates


# ──────────────────────────────────────────────────────────────────────────────
# Phase 4 — persist assignments + transition need status
# ──────────────────────────────────────────────────────────────────────────────

async def _persist_assignments(
    db: AsyncSession,
    need: Need,
    team: list,
) -> list[Assignment]:
    """Insert one Assignment row per team member."""
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(minutes=ACCEPT_DEADLINE_MINUTES)
    created: list[Assignment] = []

    for member in team:
        vol = member.volunteer
        assignment = Assignment(
            need_id=need.id,
            volunteer_id=uuid.UUID(vol.user_id),
            role_in_team=member.role,
            match_score=vol.match_score,
            match_breakdown=member.match_breakdown,
            status="pending_accept",
            assigned_at=now,
            accept_deadline=deadline,
        )
        db.add(assignment)
        created.append(assignment)

    await db.flush()
    for a in created:
        await db.refresh(a)

    return created


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point — called as BackgroundTask
# ──────────────────────────────────────────────────────────────────────────────

async def run_matching(need_id: str) -> None:
    """
    Full matching pipeline for a single need.
    Runs in a background task; opens its own DB session.
    """
    nid = uuid.UUID(need_id)

    async with SessionLocal() as db:
        need = await db.get(Need, nid)
        if need is None:
            logger.error("matching_failed: need %s not found", need_id)
            return
        if need.status != "published":
            logger.warning(
                "matching_skip: need %s has status=%s (expected published)",
                need_id, need.status,
            )
            return

        try:
            # Phase 1 — fetch candidates
            candidates = await _fetch_candidates(db, need)

            if not candidates:
                logger.warning(
                    "matching_no_candidates need=%s — need stays published", need_id
                )
                # Leave need in 'published' so coordinator sees "no matches" state.
                return

            # Phase 2+3 — score + form team
            required_skills = list(need.required_skills or [])
            team_size = need.required_team_size or 1
            team = form_team(candidates, required_skills, team_size)

            if not team:
                logger.warning(
                    "matching_empty_team need=%s — need stays published", need_id
                )
                return

            # Phase 4 — persist
            await _persist_assignments(db, need, team)

            need.status = "matching_complete"
            need.updated_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info(
                "matching_ok need=%s team_size=%d status=matching_complete",
                need_id, len(team),
            )

        except Exception as exc:
            await db.rollback()
            logger.error("matching_failed need=%s: %s", need_id, exc, exc_info=True)
            # Need stays 'published' — coordinator can see it didn't get matched.