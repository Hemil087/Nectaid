"""
app/api/v1/cron.py

Cron endpoints called by Cloud Scheduler via OIDC.

POST /cron/escalate  — expire stale pending_accept assignments,
                       re-trigger matching for under-assigned needs.

Auth:
  Production  — Cloud Scheduler sends an OIDC token; we verify the email
                matches the scheduler service account via GOOGLE_SA_EMAIL env var.
  Local dev   — CRON_SECRET env var used as a simple Bearer token fallback.
                Set CRON_SECRET=any-string in docker-compose.yml and call with
                Authorization: Bearer <that-string>.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models import Need
from app.models.assignment import Assignment
from app.services.matching_worker import run_matching

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["cron"])

_CRON_SECRET  = os.getenv("CRON_SECRET", "")
_SCHEDULER_SA = os.getenv("GOOGLE_SA_EMAIL", "")   # e.g. scheduler-invoker@proj.iam.gserviceaccount.com


# ── Auth ───────────────────────────────────────────────────────────────────

def _verify_cron_auth(authorization: str | None) -> None:
    """
    Accepts either:
    - A valid Google OIDC token whose `email` claim matches GOOGLE_SA_EMAIL (prod)
    - A simple Bearer token matching CRON_SECRET (local dev)
    """
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")

    # Local dev fast-path
    if _CRON_SECRET and token == _CRON_SECRET:
        return

    # Production: verify OIDC token
    if _SCHEDULER_SA:
        try:
            from firebase_admin import auth as firebase_auth
            decoded = firebase_auth.verify_id_token(token, check_revoked=False)
            if decoded.get("email") != _SCHEDULER_SA:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Wrong service account")
            return
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OIDC token") from exc

    # Neither secret nor SA configured — reject in production, warn in dev
    logger.warning("cron_auth: neither CRON_SECRET nor GOOGLE_SA_EMAIL set — rejecting request")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cron auth not configured")


# ── POST /cron/escalate ────────────────────────────────────────────────────

@router.post("/escalate", status_code=status.HTTP_200_OK)
async def escalate_stale_assignments(
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """
    1. Find all pending_accept assignments past their accept_deadline.
    2. Mark them expired.
    3. For each need that still has unfilled required slots, re-trigger matching
       (run_matching excludes previously expired/declined volunteers automatically).

    Called by Cloud Scheduler every 15 minutes in production.
    Call manually in dev: POST /api/v1/cron/escalate  Authorization: Bearer <CRON_SECRET>
    """
    _verify_cron_auth(authorization)

    expired_count = 0
    rematched_need_ids: list[str] = []
    now = datetime.now(timezone.utc)

    async with SessionLocal() as db:
        # Step 1 — fetch stale assignments
        result = await db.execute(
            select(Assignment).where(
                Assignment.status == "pending_accept",
                Assignment.accept_deadline < now,
            )
        )
        stale = list(result.scalars().all())

        if not stale:
            logger.info("escalate: no stale assignments found")
            return {"expired": 0, "rematched_needs": []}

        # Step 2 — expire them
        stale_need_ids: set[str] = set()
        for a in stale:
            a.status = "expired"
            a.updated_at = now
            stale_need_ids.add(str(a.need_id))
            expired_count += 1

        await db.commit()
        logger.info("escalate: expired %d assignments across %d needs", expired_count, len(stale_need_ids))

        # Step 3 — for each affected need, check if still under-assigned
        for need_id_str in stale_need_ids:
            need = await db.get(Need, need_id_str)
            if need is None:
                continue

            # Skip terminal states
            if need.status in ("completed", "cancelled", "expired"):
                continue

            # Count currently accepted assignments
            accepted_result = await db.execute(text("""
                SELECT COUNT(*) FROM assignments
                WHERE need_id = :need_id
                  AND status  = 'accepted'
            """), {"need_id": need_id_str})
            accepted_count = accepted_result.scalar() or 0

            required = need.required_team_size or 1
            if accepted_count < required:
                # Reset to published so run_matching can pick it up
                need.status = "published"
                need.updated_at = now
                await db.commit()

                # run_matching opens its own session — fire and don't await
                # (it's a background-style coroutine; we await it here since
                #  we're already in a background context from the scheduler)
                await run_matching(need_id_str)
                rematched_need_ids.append(need_id_str)
                logger.info(
                    "escalate: re-triggered matching for need=%s (accepted=%d/%d)",
                    need_id_str, accepted_count, required,
                )

    return {
        "expired":          expired_count,
        "rematched_needs":  rematched_need_ids,
    }