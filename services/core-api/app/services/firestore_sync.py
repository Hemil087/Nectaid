"""
Firestore sync helpers for realtime updates.
All functions are non-fatal — exceptions are logged and swallowed.

Writes to:
  /needs_realtime/{need_id}                   ← need status + key fields
  /task_status/{assignment_id}                ← assignment status + key fields
  /coordinator_feed/{org_id}/feed/{event_id}  ← event feed for coordinator UI
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.need import Need

logger = logging.getLogger(__name__)


def _fs():
    from firebase_admin import firestore
    return firestore.client()


async def sync_firestore(
    entity_type: str,
    entity_id: str,
    db: AsyncSession,
    *,
    org_id: str | None = None,
    event_type: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """
    Sync a Postgres entity to the appropriate Firestore path.

    entity_type : "needs" | "assignments" | "coordinator_feed"
    entity_id   : UUID string — document ID (auto-generated event UUID for coordinator_feed)
    db          : Open AsyncSession used for reads; caller owns the lifecycle
    org_id      : Required for coordinator_feed
    event_type  : Label merged into the coordinator_feed document
    extra       : Additional fields merged into the coordinator_feed document
    """
    try:
        if entity_type == "needs":
            need = await db.get(Need, uuid.UUID(entity_id))
            if need is None:
                return
            data: dict[str, Any] = {
                "id": str(need.id),
                "status": need.status,
                "title": need.title,
                "urgency": need.urgency,
                "need_type": need.need_type,
                "location_text": need.location_text,
                "priority_score": need.priority_score,
                "beneficiary_count": need.beneficiary_count,
                "updated_at": need.updated_at.isoformat() if need.updated_at else None,
            }
            await asyncio.to_thread(
                _fs().collection("needs_realtime").document(entity_id).set, data
            )

        elif entity_type == "assignments":
            assignment = await db.get(Assignment, uuid.UUID(entity_id))
            if assignment is None:
                return
            data = {
                "id": str(assignment.id),
                "need_id": str(assignment.need_id),
                "volunteer_id": str(assignment.volunteer_id),
                "status": assignment.status,
                "role_in_team": assignment.role_in_team,
                "match_score": assignment.match_score,
                "accept_deadline": (
                    assignment.accept_deadline.isoformat()
                    if assignment.accept_deadline else None
                ),
                "updated_at": (
                    assignment.updated_at.isoformat()
                    if assignment.updated_at else None
                ),
            }
            await asyncio.to_thread(
                _fs().collection("task_status").document(entity_id).set, data
            )

        elif entity_type == "coordinator_feed":
            if not org_id:
                logger.warning("sync_firestore coordinator_feed called without org_id — skipping")
                return
            event_doc: dict[str, Any] = {
                "event_id": entity_id,
                "event_type": event_type or "unknown",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **(extra or {}),
            }
            await asyncio.to_thread(
                _fs()
                .collection("coordinator_feed")
                .document(org_id)
                .collection("feed")
                .document(entity_id)
                .set,
                event_doc,
            )

        else:
            logger.warning("sync_firestore: unknown entity_type=%s", entity_type)
            return

        logger.debug("firestore_synced entity_type=%s id=%s", entity_type, entity_id)

    except Exception as exc:
        logger.error(
            "firestore_sync_failed entity_type=%s id=%s: %s",
            entity_type, entity_id, exc,
        )
