"""
app/services/email_service.py

Shared email helpers used by matching_worker, cron, and assignment endpoints.

All functions are non-fatal — they log errors but never raise so callers
can proceed even when Brevo is unavailable (key not set, local dev, etc.).

The caller is responsible for committing the DB session.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)

_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "new_assignment_subject":  "New volunteer assignment: {title}",
        "new_assignment_intro":    "You have been matched to a new volunteer assignment.",
        "reminder_subject":        "Reminder: assignment expiring soon — {title}",
        "reminder_intro":          "Your assignment is expiring soon. Please respond now.",
        "cta_view":                "View Assignment",
        "cta_accept":              "Accept Now",
        "urgency_label":           "Urgency",
        "type_label":              "Need type",
        "deadline_label":          "Need deadline",
        "respond_by_label":        "Please respond by",
        "footer":                  "Nectaid — connecting communities with volunteers",
    },
    "hi": {
        "new_assignment_subject":  "नया स्वयंसेवक कार्य: {title}",
        "new_assignment_intro":    "आपको एक नए स्वयंसेवक कार्य के लिए चुना गया है।",
        "reminder_subject":        "अनुस्मारक: कार्य की समय सीमा निकट है — {title}",
        "reminder_intro":          "आपके कार्य की स्वीकृति समय सीमा समाप्त होने वाली है। कृपया अभी उत्तर दें।",
        "cta_view":                "कार्य देखें",
        "cta_accept":              "अभी स्वीकार करें",
        "urgency_label":           "तात्कालिकता",
        "type_label":              "आवश्यकता प्रकार",
        "deadline_label":          "अंतिम तिथि",
        "respond_by_label":        "कृपया इस समय तक उत्तर दें",
        "footer":                  "Nectaid — समुदायों को स्वयंसेवकों से जोड़ना",
    },
    "gu": {
        "new_assignment_subject":  "નવી સ્વયંસેવક સોંપણી: {title}",
        "new_assignment_intro":    "તમને એક નવી સ્વયંસેવક સોંપણી માટે પસંદ કરવામાં આવ્યા છે।",
        "reminder_subject":        "યાદ: સોંપણીની સ્વીકૃતિ સમય સીમા નજીક છે — {title}",
        "reminder_intro":          "તમારી સોંપણીની સ્વીકૃતિ સમય સીમા સમાપ્ત થવાની છે. કૃપા કરીને હવે જવાબ આપો.",
        "cta_view":                "સોંપણી જુઓ",
        "cta_accept":              "હવે સ્વીકારો",
        "urgency_label":           "તાકીદ",
        "type_label":              "જરૂરિયાત પ્રકાર",
        "deadline_label":          "છેલ્લી તારીખ",
        "respond_by_label":        "કૃપા કરીને આ સમય સુધીમાં જવાબ આપો",
        "footer":                  "Nectaid — સ્વયંસેવકો સાથે સમુદાયોને જોડવું",
    },
}


def _t(lang: str, key: str, **fmt: Any) -> str:
    s = TRANSLATIONS.get(lang, TRANSLATIONS["en"]).get(key, TRANSLATIONS["en"][key])
    return s.format(**fmt) if fmt else s


def _btn(url: str, label: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;padding:10px 20px;'
        f'background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;'
        f'font-weight:600">{label}</a>'
    )


async def _do_send(to_email: str, to_name: str, subject: str, html: str, text: str) -> str | None:
    """
    Fire the Brevo transactional email API call in a thread.
    Returns the Brevo message ID on success, None on failure.
    BREVO_API_KEY must be set; if absent, logs a warning and returns None.
    """
    api_key = os.getenv("BREVO_API_KEY", "")
    from_address = os.getenv("BREVO_FROM_ADDRESS", "noreply@nectaid.org")

    if not api_key:
        logger.warning("BREVO_API_KEY not set — email skipped to=%s subject=%s", to_email, subject)
        return None

    try:
        import sib_api_v3_sdk  # type: ignore[import-untyped]
        from sib_api_v3_sdk.rest import ApiException  # type: ignore[import-untyped]

        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = api_key

        api = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )
        payload = sib_api_v3_sdk.SendSmtpEmail(
            sender={"name": "Nectaid", "email": from_address},
            to=[{"email": to_email, "name": to_name}],
            subject=subject,
            html_content=html,
            text_content=text,
        )
        response = await asyncio.to_thread(api.send_transac_email, payload)
        msg_id = getattr(response, "message_id", "") or ""
        logger.info("email_sent to=%s subject=%s msg_id=%s", to_email, subject, msg_id)
        return msg_id
    except Exception as exc:
        logger.error("email_failed to=%s subject=%s: %s", to_email, subject, exc)
        return None


async def _write_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    subject: str,
    body: str,
    related_entity_type: str,
    related_entity_id: uuid.UUID,
    provider_message_id: str | None,
    failed: bool = False,
) -> None:
    notif = Notification(
        user_id=user_id,
        channel="email",
        subject=subject,
        body=body,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        status="failed" if failed else ("sent" if provider_message_id is not None else "queued"),
        provider_message_id=provider_message_id or None,
        sent_at=datetime.now(timezone.utc) if provider_message_id is not None else None,
    )
    db.add(notif)
    await db.flush()


# ── Public API ────────────────────────────────────────────────────────────────

async def send_new_assignment_email(
    db: AsyncSession,
    *,
    volunteer: User,
    assignment_id: uuid.UUID,
    need_title: str,
    need_urgency: str,
    need_type: str,
    need_deadline_str: str,
    accept_deadline_str: str,
) -> None:
    """Send 'new assignment' email to a volunteer and write a notification row."""
    lang = getattr(volunteer, "preferred_language", "en") or "en"
    subject = _t(lang, "new_assignment_subject", title=need_title)
    deep_link = f"{_FRONTEND_URL}/assignments/{assignment_id}"

    html = f"""
<p>{_t(lang, 'new_assignment_intro')}</p>
<h3 style="margin:16px 0 8px">{need_title}</h3>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:4px 8px;color:#6b7280">{_t(lang,'urgency_label')}</td>
      <td style="padding:4px 8px;font-weight:600">{need_urgency.capitalize()}</td></tr>
  <tr><td style="padding:4px 8px;color:#6b7280">{_t(lang,'type_label')}</td>
      <td style="padding:4px 8px">{need_type.capitalize()}</td></tr>
  <tr><td style="padding:4px 8px;color:#6b7280">{_t(lang,'deadline_label')}</td>
      <td style="padding:4px 8px">{need_deadline_str}</td></tr>
  <tr><td style="padding:4px 8px;color:#6b7280">{_t(lang,'respond_by_label')}</td>
      <td style="padding:4px 8px;color:#d97706;font-weight:600">{accept_deadline_str}</td></tr>
</table>
<p style="margin-top:24px">{_btn(deep_link, _t(lang,'cta_accept'))}</p>
<p style="color:#6b7280;font-size:12px;margin-top:32px">{_t(lang,'footer')}</p>
"""
    text_body = (
        f"{_t(lang,'new_assignment_intro')} {need_title} ({need_urgency}). "
        f"{_t(lang,'deadline_label')}: {need_deadline_str}. "
        f"{_t(lang,'respond_by_label')}: {accept_deadline_str}. "
        f"{_t(lang,'cta_view')}: {deep_link}"
    )

    if not volunteer.email:
        logger.warning("send_new_assignment_email: no email for volunteer=%s", volunteer.id)
        return

    msg_id = await _do_send(volunteer.email, volunteer.full_name or "", subject, html, text_body)
    await _write_notification(
        db,
        user_id=volunteer.id,
        subject=subject,
        body=text_body,
        related_entity_type="assignment",
        related_entity_id=assignment_id,
        provider_message_id=msg_id,
        failed=(msg_id is None and bool(os.getenv("SENDGRID_API_KEY"))),
    )


async def send_reminder_email(
    db: AsyncSession,
    *,
    volunteer: User,
    assignment_id: uuid.UUID,
    need_title: str,
    accept_deadline_str: str,
) -> None:
    """Send 10-minute reminder email and write notification row."""
    lang = getattr(volunteer, "preferred_language", "en") or "en"
    subject = _t(lang, "reminder_subject", title=need_title)
    deep_link = f"{_FRONTEND_URL}/assignments/{assignment_id}"

    html = f"""
<p>{_t(lang,'reminder_intro')}</p>
<h3 style="margin:16px 0 8px">{need_title}</h3>
<p style="color:#d97706;font-weight:600">{_t(lang,'respond_by_label')}: {accept_deadline_str}</p>
<p style="margin-top:24px">{_btn(deep_link, _t(lang,'cta_accept'))}</p>
<p style="color:#6b7280;font-size:12px;margin-top:32px">{_t(lang,'footer')}</p>
"""
    text_body = (
        f"{_t(lang,'reminder_intro')} {need_title}. "
        f"{_t(lang,'respond_by_label')}: {accept_deadline_str}. "
        f"{_t(lang,'cta_view')}: {deep_link}"
    )

    if not volunteer.email:
        return

    msg_id = await _do_send(volunteer.email, volunteer.full_name or "", subject, html, text_body)
    await _write_notification(
        db,
        user_id=volunteer.id,
        subject=subject,
        body=text_body,
        related_entity_type="assignment",
        related_entity_id=assignment_id,
        provider_message_id=msg_id,
        failed=(msg_id is None and bool(os.getenv("SENDGRID_API_KEY"))),
    )


async def send_task_completed_email(
    db: AsyncSession,
    *,
    coordinator: User,
    need_id: uuid.UUID,
    need_title: str,
    volunteer_name: str,
    completion_notes: str | None,
    photo_count: int,
) -> None:
    """Send 'task completed — please rate volunteer' email to the coordinator."""
    subject = f"[Nectaid] Task completed — please rate {volunteer_name}"
    deep_link = f"{_FRONTEND_URL}/needs/{need_id}"

    notes_html = f"<p><strong>Notes:</strong> {completion_notes}</p>" if completion_notes else ""
    photos_html = (
        f"<p><strong>Photos submitted:</strong> {photo_count}</p>" if photo_count else ""
    )

    html = f"""
<p>A volunteer has marked a task as completed. Please log in to review and rate their work.</p>
<h3 style="margin:16px 0 8px">{need_title}</h3>
<p><strong>Volunteer:</strong> {volunteer_name}</p>
{notes_html}
{photos_html}
<p style="margin-top:24px">{_btn(deep_link, 'Review &amp; Rate')}</p>
<p style="color:#6b7280;font-size:12px;margin-top:32px">Nectaid — connecting communities with volunteers</p>
"""
    text_body = (
        f"Task completed: {need_title}. Volunteer: {volunteer_name}. "
        f"{'Notes: ' + completion_notes + '. ' if completion_notes else ''}"
        f"Review and rate: {deep_link}"
    )

    if not coordinator.email:
        return

    msg_id = await _do_send(coordinator.email, coordinator.full_name or "", subject, html, text_body)
    await _write_notification(
        db,
        user_id=coordinator.id,
        subject=subject,
        body=text_body,
        related_entity_type="need",
        related_entity_id=need_id,
        provider_message_id=msg_id,
        failed=(msg_id is None and bool(os.getenv("SENDGRID_API_KEY"))),
    )
