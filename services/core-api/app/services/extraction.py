"""
Multimodal need extraction via Gemini 2.5 Flash on Vertex AI.
Single public function: extract_need(text, images) -> NeedExtraction
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Literal

import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part
from pydantic import BaseModel, Field, ValidationError


# ── PII regex ──────────────────────────────────────────────────────────────
_PII_RE = re.compile(
    r"\b(?:\+?91[\s\-]?)?\d{5}[\s\-]?\d{5}\b"
    r"|\b\d{10,12}\b"
)

_VERTEXAI_INITIALIZED = False


# ── Schema ─────────────────────────────────────────────────────────────────
class NeedExtraction(BaseModel):
    need_type: Literal["medical", "education", "food", "shelter", "wash", "livelihood", "other"]
    category: str | None = None
    title: str = Field(..., max_length=80)
    description_en: str
    description_original: str
    original_language: Literal["en", "hi", "gu", "other"]
    urgency: Literal["critical", "high", "medium", "low"]
    location_hint: str | None = None
    beneficiary_count: int | None = None
    required_skills: list[str] | None = None
    required_team_size: int | None = None
    resources_needed: list[str] | None = None
    time_sensitive_deadline: str | None = None
    confidence: float = Field(..., ge=0.0, le=1.0)


# ── Error ──────────────────────────────────────────────────────────────────
class ExtractionError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# ── Prompts ────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are a data-extraction assistant for an NGO field-work platform.
Your job is to convert field reports (text, images of handwritten forms,
photos of situations) into a strict JSON object describing a community need.

RULES:
1. Output MUST match the provided JSON schema. Do not invent fields.
2. If a field is unknown, return null (not a guess).
3. Preserve the original text in `description_original` and provide an
   English translation in `description_en`.
4. `urgency` is your best judgement based on context:
   - "critical" = life-threatening or time-bound within 24 hours
   - "high" = within 3 days
   - "medium" = within 2 weeks
   - "low" = no specific deadline
5. `beneficiary_count` — extract as integer if stated; else null.
6. `required_skills` — normalize to canonical lowercase tags like
   "pediatrician", "nurse", "teacher-math", "carpenter", "translator-gujarati".
7. `location_hint` — village/district/state if identifiable; else null.
8. DO NOT include personally identifiable information (names, phone numbers)
   in `description_en` or `description_original`. Replace them with [PERSON]
   or [PHONE].\
"""

_STRICT_REMINDER = (
    "\n\nCRITICAL: Your previous response did not match the required JSON schema. "
    "Output ONLY a valid JSON object. Required fields: need_type, category, title, "
    "description_en, description_original, original_language, urgency, location_hint, "
    "beneficiary_count, required_skills, required_team_size, resources_needed, "
    "time_sensitive_deadline, confidence. No extra fields. No markdown fences."
)

# Passed to Gemini to enforce enum values and field types at generation time
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "need_type":   {"type": "string", "enum": ["medical", "education", "food", "shelter", "wash", "livelihood", "other"]},
        "category":    {"type": "string", "nullable": True},
        "title":       {"type": "string"},
        "description_en":       {"type": "string"},
        "description_original": {"type": "string"},
        "original_language":    {"type": "string", "enum": ["en", "hi", "gu", "other"]},
        "urgency":     {"type": "string", "enum": ["critical", "high", "medium", "low"]},
        "location_hint":        {"type": "string", "nullable": True},
        "beneficiary_count":    {"type": "integer", "nullable": True},
        "required_skills":      {"type": "array", "items": {"type": "string"}, "nullable": True},
        "required_team_size":   {"type": "integer", "nullable": True},
        "resources_needed":     {"type": "array", "items": {"type": "string"}, "nullable": True},
        "time_sensitive_deadline": {"type": "string", "nullable": True},
        "confidence":  {"type": "number"},
    },
    "required": [
        "need_type", "title", "description_en", "description_original",
        "original_language", "urgency", "confidence",
    ],
}

_GENERATION_CONFIG = GenerationConfig(
    response_mime_type="application/json",
    response_schema=_RESPONSE_SCHEMA,
    temperature=0.2,
    max_output_tokens=1024,
)

# Coercion maps — catch anything that still slips past schema enforcement
_NEED_TYPE_COERCE: dict[str, str] = {
    "humanitarian-aid": "other", "humanitarian_aid": "other",
    "disaster-relief": "other", "disaster_relief": "other",
    "healthcare": "medical", "health": "medical",
    "water": "wash", "sanitation": "wash",
    "housing": "shelter", "infrastructure": "other",
    "employment": "livelihood", "income": "livelihood",
    "nutrition": "food",
}
_LANG_COERCE: dict[str, str] = {
    "english": "en", "hindi": "hi", "gujarati": "gu",
    "marathi": "other", "tamil": "other", "bengali": "other",
    "telugu": "other", "kannada": "other", "punjabi": "other",
}
_CONFIDENCE_COERCE: dict[str, float] = {
    "very high": 0.9, "very_high": 0.9,
    "high": 0.8,
    "medium": 0.6, "moderate": 0.6,
    "low": 0.4,
    "very low": 0.2, "very_low": 0.2,
}


# ── Helpers ────────────────────────────────────────────────────────────────
def _init_vertexai() -> None:
    global _VERTEXAI_INITIALIZED
    if _VERTEXAI_INITIALIZED:
        return
    project = os.getenv("PROJECT_ID", "nectaid-dev")
    location = os.getenv("REGION", "asia-south1")
    vertexai.init(project=project, location=location)
    _VERTEXAI_INITIALIZED = True


def _detect_mime(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 12 and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def _build_parts(text: str, images: list[bytes], strict: bool = False) -> list[Part]:
    user_text = (
        f"Text: {text}\n"
        f"Submitted at: {datetime.now(timezone.utc).isoformat()}\n"
        f"Source: webform"
    )
    if strict:
        user_text += _STRICT_REMINDER

    parts: list[Part] = [Part.from_text(user_text)]
    for img in images:
        parts.append(Part.from_data(data=img, mime_type=_detect_mime(img)))
    return parts


def _coerce(data: dict) -> dict:
    """Normalise common model deviations to valid enum/type values."""
    nt = data.get("need_type", "")
    if isinstance(nt, str):
        data["need_type"] = _NEED_TYPE_COERCE.get(nt.lower(), nt)

    lang = data.get("original_language", "")
    if isinstance(lang, str):
        data["original_language"] = _LANG_COERCE.get(lang.lower(), lang)

    conf = data.get("confidence")
    if isinstance(conf, str):
        data["confidence"] = _CONFIDENCE_COERCE.get(conf.lower().strip(), 0.5)

    return data


def _parse_response(raw: str) -> NeedExtraction:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text.rstrip())
    return NeedExtraction.model_validate(_coerce(json.loads(text)))


def _strip_pii(result: NeedExtraction) -> NeedExtraction:
    data = result.model_dump()
    for field in ("description_en", "description_original", "title"):
        if data.get(field):
            data[field] = _PII_RE.sub("[PHONE]", data[field])
    return NeedExtraction.model_validate(data)


# ── Public API ─────────────────────────────────────────────────────────────
async def extract_need(text: str, images: list[bytes]) -> NeedExtraction:
    """
    Extract a structured NeedExtraction from a field report.

    Retries once with a stricter prompt on schema mismatch.
    Raises ExtractionError on any unrecoverable failure.
    """
    try:
        _init_vertexai()
    except Exception as exc:
        raise ExtractionError(f"vertexai_init_error: {exc}") from exc

    model = GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=_SYSTEM_PROMPT,
    )

    # ── First attempt ──────────────────────────────────────────────────────
    try:
        response = await model.generate_content_async(
            _build_parts(text, images, strict=False),
            generation_config=_GENERATION_CONFIG,
        )
        return _strip_pii(_parse_response(response.text))
    except ValidationError:
        pass  # schema mismatch → retry
    except Exception as exc:
        raise ExtractionError(f"gemini_error: {exc}") from exc

    # ── Retry with strict reminder ─────────────────────────────────────────
    try:
        response = await model.generate_content_async(
            _build_parts(text, images, strict=True),
            generation_config=_GENERATION_CONFIG,
        )
        return _strip_pii(_parse_response(response.text))
    except ValidationError as exc:
        raise ExtractionError(f"schema_mismatch_after_retry: {exc}") from exc
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError(f"gemini_error: {exc}") from exc
