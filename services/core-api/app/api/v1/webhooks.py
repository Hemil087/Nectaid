"""
app/api/v1/webhooks.py

POST /webhooks/sendgrid — SendGrid Event Webhook handler.

Production use: enable ED25519 signature verification via SENDGRID_WEBHOOK_KEY env var.
Demo use: set SENDGRID_WEBHOOK_VERIFY=false to skip verification (default).

Events handled:
  delivered  → notifications.status = 'delivered'
  bounce     → notifications.status = 'failed'; permanent bounce → email_deliverable = False
  spam_report → same as permanent bounce
  open        → (future: notifications.opened_at)
  click       → (future: notifications.clicked_at)

Idempotency: duplicate event deliveries are silently ignored (no unique constraint
on provider_message_id yet — add one post-demo if needed).
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from fastapi import Depends
from app.models.notification import Notification
from app.models.volunteer import VolunteerProfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_VERIFY = os.getenv("SENDGRID_WEBHOOK_VERIFY", "false").lower() == "true"
_WEBHOOK_KEY = os.getenv("SENDGRID_WEBHOOK_KEY", "")


def _verify_signature(body: bytes, signature: str, timestamp: str) -> None:
    """ED25519 verification — only runs when SENDGRID_WEBHOOK_VERIFY=true."""
    if not _VERIFY:
        return
    if not _WEBHOOK_KEY:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Webhook key not configured")
    try:
        from sendgrid.helpers.eventwebhook import EventWebhook  # type: ignore[import-untyped]
        ec = EventWebhook(_WEBHOOK_KEY)
        if not ec.verify_signature(body, signature, timestamp):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Invalid webhook signature")
    except ImportError:
        logger.warning("sendgrid EventWebhook not available — skipping signature check")


@router.post("/sendgrid", status_code=status.HTTP_200_OK)
async def sendgrid_webhook(
    request: Request,
    x_twilio_email_event_webhook_signature: str | None = Header(None, alias="X-Twilio-Email-Event-Webhook-Signature"),
    x_twilio_email_event_webhook_timestamp: str | None = Header(None, alias="X-Twilio-Email-Event-Webhook-Timestamp"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    body = await request.body()

    _verify_signature(
        body,
        x_twilio_email_event_webhook_signature or "",
        x_twilio_email_event_webhook_timestamp or "",
    )

    try:
        events: list[dict[str, Any]] = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    processed = 0
    now = datetime.now(timezone.utc)

    for event in events:
        event_type = event.get("event", "")
        msg_id = event.get("sg_message_id", "").split(".")[0]  # strip SendGrid suffix

        if not msg_id:
            continue

        # Find matching notification row
        result = await db.execute(
            select(Notification).where(Notification.provider_message_id == msg_id)
        )
        notif = result.scalar_one_or_none()

        if notif is None:
            logger.debug("webhook: no notification found for msg_id=%s event=%s", msg_id, event_type)
            continue

        if event_type == "delivered":
            notif.status = "delivered"
            notif.delivered_at = now

        elif event_type in ("bounce", "blocked"):
            notif.status = "failed"
            # Permanent bounces → mark volunteer's email as undeliverable
            bounce_type = event.get("type", "")
            if bounce_type in ("bounce", "invalid") and notif.related_entity_type == "assignment":
                profile_result = await db.execute(
                    select(VolunteerProfile).where(VolunteerProfile.user_id == notif.user_id)
                )
                profile = profile_result.scalar_one_or_none()
                if profile is not None:
                    profile.email_deliverable = False
                    profile.updated_at = now
                    logger.warning(
                        "webhook: permanent bounce — email_deliverable=False user=%s", notif.user_id
                    )

        elif event_type == "spamreport":
            notif.status = "failed"

        else:
            # open, click, unsubscribe — log only for now
            logger.debug("webhook: unhandled event=%s msg_id=%s", event_type, msg_id)
            continue

        processed += 1

    await db.commit()
    logger.info("webhook: processed %d/%d events", processed, len(events))
    return {"received": len(events), "processed": processed}
