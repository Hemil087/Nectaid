from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Phone: E.164 format or common local formats (7-15 digits with optional +/spaces/dashes)
_PHONE_RE = re.compile(r"\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}")


def scrub(text: str) -> str:
    """Replace PII (email, phone) in a log message with safe placeholders."""
    text = _EMAIL_RE.sub("[email]", text)
    text = _PHONE_RE.sub("[phone]", text)
    return text
