# 05 — AI Pipeline

This document covers every AI capability in the system, with prompts, output schemas, fallbacks, and cost controls. **This is the most inspected area during technical judging.**

## Overview

| Capability | Model | Input | Output | Latency Budget |
|---|---|---|---|---|
| Multimodal extraction | `gemini-2.5-flash` | Text + images (any lang) | Structured JSON (`NeedExtraction`) | ≤ 3s p50 |
| Translation-as-needed | Same call as extraction | Multilingual | English translation alongside original | same call |
| Skill embedding | `text-embedding-004` | Volunteer skills text | 768-dim vector | ≤ 500ms |
| Need embedding | `text-embedding-004` | Need title + description | 768-dim vector | ≤ 500ms |
| Report narrative | `gemini-2.5-flash` | Weekly aggregates (JSON) | 3–5 paragraph markdown | ≤ 5s |

**Three AI capabilities (not four).** We removed Document AI from the design — Gemini 2.5 Flash handles forms well enough for MVP, and having two LLM services for "extract text from an image" adds complexity without real gain. If post-MVP we see form-parsing accuracy problems, we can add Document AI then.

## 1. Multimodal Extraction

### Prompt (system)
```
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
   or [PHONE].
```

### Input (user message)
```
Text: "<coordinator's typed text, possibly copy-pasted from a phone report>"
Images: <attached image bytes — photos of paper forms, situation photos, handwritten notes>
Submitted at: <iso timestamp>
Source: <webform|email|api>
```

### Output schema (strict JSON)
```json
{
  "need_type": "medical|education|food|shelter|wash|livelihood|other",
  "category": "string|null",
  "title": "short human-readable title, max 80 chars",
  "description_en": "2–4 sentences in English",
  "description_original": "original text as-is",
  "original_language": "en|hi|gu|other",
  "urgency": "critical|high|medium|low",
  "location_hint": "Kathlal, Kheda, Gujarat|null",
  "beneficiary_count": 45,
  "required_skills": ["pediatrician","nurse"],
  "required_team_size": 2,
  "resources_needed": ["medicines","thermometer"],
  "time_sensitive_deadline": "2026-04-19T10:00:00+05:30|null",
  "confidence": 0.82
}
```

### Python invocation (actual implementation — `app/services/extraction.py`)
```python
import json, os, re
import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part
from google.oauth2 import service_account

# Credentials from env (no ADC required in Docker)
sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
credentials = service_account.Credentials.from_service_account_info(
    json.loads(sa_json),
    scopes=["https://www.googleapis.com/auth/cloud-platform"],
)
vertexai.init(project=PROJECT_ID, location="asia-south1", credentials=credentials)

model = GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_PROMPT)

response = await model.generate_content_async(
    [Part.from_text(user_text), *[Part.from_data(img, _detect_mime(img)) for img in images]],
    generation_config=GenerationConfig(
        response_mime_type="application/json",
        response_schema=_RESPONSE_SCHEMA,   # enum constraints enforced at generation time
        temperature=0.2,
        max_output_tokens=32768,             # must be large — thinking tokens consume budget invisibly
    ),
)
extracted = NeedExtraction.model_validate(_coerce(json.loads(response.text)))
```

**Why `max_output_tokens=32768`:** Gemini 2.5 Flash is a thinking model. Internal reasoning tokens consume the `max_output_tokens` budget but do NOT appear in `usage_metadata.total_token_count`. With 8192, complex inputs use all the budget for thinking and produce no response (`finish_reason: MAX_TOKENS`). 32768 provides enough headroom for both.

**Why `gemini-2.5-flash` and not `gemini-2.0-flash`:** `asia-south1` only has `gemini-2.5-flash`. Other model IDs (including versioned `-001` suffixes) return 404 in this region.

### Coercion + validation

Model output is normalised before Pydantic validation to catch common deviations:

```python
_NEED_TYPE_COERCE = {"healthcare": "medical", "water": "wash", "housing": "shelter", ...}
_LANG_COERCE      = {"english": "en", "hindi": "hi", "gujarati": "gu", ...}
_CONFIDENCE_COERCE = {"high": 0.8, "medium": 0.6, "low": 0.4, ...}
```

### Guardrails
- **`response_schema`** passed to `GenerationConfig` enforces enum values at generation time
- **`_coerce()`** normalises common model deviations before Pydantic validation
- **Pydantic `model_validate()`** after coercion; any schema violation → retry once with stricter prompt reminder appended
- **Max 10 MB per image** enforced at upload; images read from disk by background task
- **PII regex** applied post-extraction on `title`, `description_en`, `description_original` — replaces phone patterns with `[PHONE]`

### Failure handling
1. Schema mismatch → retry once with `_STRICT_REMINDER` appended to user message
2. Second schema failure → `ExtractionError("schema_mismatch_after_retry")` → `raw_submissions.status = "failed"`
3. Any other exception → logged, `raw_submissions.status = "failed"`, `extraction_error` column populated
4. Embedding failure → logged, `needs.embedding` stays null, pipeline continues (need row still created)

### Cost control
- Gemini 2.5 Flash: ~$0.075/1M input tokens (text), images priced separately
- Typical call: ~2500 prompt tokens + ~500 response tokens + thinking ≈ $0.001–0.003
- 5000 extractions/month ≈ $5–15
- **Budget cap** via Cloud Billing budget alert at $20/month

## 2. Skill Embeddings (Volunteer)

### When generated
- On volunteer registration (async, after `POST /volunteers`)
- On `PATCH /volunteers/me` when `skills` field changes (async)
- As a backfill job for existing volunteers (one-time migration if needed)

### Input construction
```python
skills_text = " | ".join(volunteer.skills) + " | " + " ".join(volunteer.certifications or [])
# Example: "pediatrician | hindi-speaker | MBBS RGUHS 2019"
```

### Invocation
```python
from vertexai.language_models import TextEmbeddingModel
model = TextEmbeddingModel.from_pretrained("text-embedding-004")
embedding = model.get_embeddings([skills_text])[0].values
# Store as pgvector column
```

### Storage
- `volunteer_profiles.skills_embedding vector(768)`
- Indexed with `ivfflat` cosine ops, `lists=100` for up to 100k vectors

## 3. Need Embeddings

### When generated
- In `ingestion-worker`, right after successful extraction

### Input construction
```python
need_text = f"{extracted.title}. {extracted.description_en}. Requires: {', '.join(extracted.required_skills or [])}."
```

### Same embedding model and storage pattern as above
- `needs.embedding vector(768)`

## 4. Matching Query (full SQL)

This is the **complete** candidate-fetch query with all filters correctly applied:

```sql
SELECT
    vp.user_id,
    u.full_name,
    vp.reliability_score,
    1 - (vp.skills_embedding <=> $1::vector) AS similarity,
    ST_Distance(vp.home_location, $2::geography) / 1000.0 AS distance_km,
    vp.skills,
    -- recency_penalty source: recent assignments count
    (SELECT COUNT(*) FROM assignments a2
     WHERE a2.volunteer_id = vp.user_id
       AND a2.assigned_at > NOW() - INTERVAL '7 days'
       AND a2.status IN ('accepted','in_progress','completed'))
    AS tasks_this_week,
    -- experience in this need_type
    (SELECT COUNT(*) FROM assignments a3
     JOIN needs n3 ON n3.id = a3.need_id
     WHERE a3.volunteer_id = vp.user_id
       AND a3.status = 'completed'
       AND n3.need_type = $5)
    AS experience_in_type
FROM volunteer_profiles vp
JOIN users u ON u.id = vp.user_id
WHERE
    -- Hard filters:
    vp.active = TRUE
    AND vp.verified = TRUE
    AND u.deleted_at IS NULL
    AND ST_DWithin(vp.home_location, $2::geography, vp.max_travel_km * 1000)

    -- AVAILABILITY: must have a slot overlapping the need's time window.
    -- $3 = need.window_start, $4 = need.window_end
    AND EXISTS (
        SELECT 1 FROM availability_slots av
        WHERE av.volunteer_id = vp.user_id
          AND av.start_time <= $4::timestamptz
          AND av.end_time   >= $3::timestamptz
    )

    -- NOT DOUBLE-BOOKED: use COALESCE for open-ended ranges
    AND NOT EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.volunteer_id = vp.user_id
          AND a.status IN ('pending_accept','accepted','in_progress')
          AND tstzrange(
                a.assigned_at,
                COALESCE(a.completed_at, 'infinity'::timestamptz),
                '[)'
              )
              && tstzrange($3::timestamptz, $4::timestamptz, '[)')
    )

    -- NOT PREVIOUSLY DECLINED/EXPIRED on THIS need
    -- $6 = need.id
    AND NOT EXISTS (
        SELECT 1 FROM assignments a4
        WHERE a4.volunteer_id = vp.user_id
          AND a4.need_id = $6
          AND a4.status IN ('declined','expired','no_show')
    )

ORDER BY vp.skills_embedding <=> $1::vector  -- cosine distance, smallest first
LIMIT 50;
```

Parameters: `$1` = need embedding, `$2` = need location, `$3` = window_start, `$4` = window_end, `$5` = need.need_type, `$6` = need.id.

**Why this SQL is correct (addressing earlier bugs):**

1. **`COALESCE(completed_at, 'infinity'::timestamptz)`** — handles open-ended assignments that haven't been completed yet. Postgres supports the special `'infinity'` timestamp natively.
2. **Availability JOIN is present** — `EXISTS` subquery against `availability_slots`, which was missing in the earlier draft.
3. **Previously-attempted volunteers filtered via subquery** — no separate `attempted_volunteer_ids` column needed; the `assignments` table itself is the record.
4. **`tasks_this_week` and `experience_in_type` computed as subqueries** — no stored columns needed.

## 5. Report Narrative

### Prompt
```
You are writing the weekly impact summary for {org_name}.
Below are aggregated metrics for the week of {week_range}.
Write 3–5 concise paragraphs suitable for an impact report,
in plain professional English. Do not invent numbers.
Metrics: {metrics_json}
Also write a one-line headline.
Output JSON: { "headline": "...", "paragraphs": ["...", "...", "..."] }
```

### Post-processing
- Injected into a Jinja2 HTML template along with charts (matplotlib PNG embedded as base64)
- Converted to PDF via WeasyPrint
- Uploaded to GCS; coordinator receives email with a signed GCS URL (15-min TTL) and an in-app notification

## 6. Prompt Injection Defenses

User-supplied text (everything the coordinator typed or pasted into the submission form, plus any text extracted from uploaded images) goes **only in the user message**, never in the system prompt. All system prompts are constants.

Additional guard:
```python
# After model response, verify it matches schema
try:
    extracted = NeedExtraction.model_validate_json(response.text)
except ValidationError:
    raise ExtractionError("schema_mismatch")

# Check for suspicious instruction patterns in extracted fields
SUSPICIOUS = ["ignore previous", "system:", "disregard"]
for field in [extracted.description_en or "", extracted.title or ""]:
    if any(s in field.lower() for s in SUSPICIOUS):
        flag_for_manual_review()
```

## 7. Evaluation (Honesty Check)

Before demo day, run a tiny eval:
- Collect **50 real-ish sample submissions** (teammates can generate)
- Run extraction
- Manually score each: (1) got need_type right, (2) got urgency right, (3) got location right, (4) no PII leaked
- Target: **> 80% on all four**

If you fall below, tune the prompt or add few-shot examples. Judges respect teams who measure their own system.

## 8. Why This Scores Well on "AI Integration" (40% Technical Merit)

- **3 distinct AI tasks, each justified.** Not "one LLM call for everything."
- **Structured output with schema validation.** Shows production maturity.
- **Multimodal + multilingual.** Real-world India requirement, not a toy.
- **Embeddings for semantic matching.** Separates us from keyword-search competitors.
- **Hybrid with deterministic logic** for priority scoring — shows you know when NOT to use AI.
- **Measured evaluation** with a tiny eval set.
