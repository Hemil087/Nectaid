# 04 — API Specification

All endpoints are under `/api/v1`. JSON request/response. Authentication via `Authorization: Bearer <firebase_id_token>` unless noted.

## Conventions

- **IDs are UUIDv4** strings
- **Timestamps are ISO-8601** with timezone (`2026-04-20T10:30:00+05:30`)
- **Pagination**: `?limit=20&cursor=<opaque>`; response has `next_cursor` or null
- **Errors** return:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {...} } }
  ```
- **Rate limits**: 100 req/min per user; 429 with `Retry-After` header on exceed

---

## Authentication

### `POST /auth/session`
Exchange Firebase ID token for server session cookie (optional, enables SSR).
```json
// Request
{ "id_token": "eyJ..." }

// Response 200
{ "user": { "id": "...", "role": "coordinator", "full_name": "..." } }
```

### `GET /auth/me`
```json
// Response
{
  "id": "uuid",
  "role": "volunteer|coordinator|admin",
  "full_name": "Ria Shah",
  "email": "...",
  "phone": "+91...",
  "preferred_language": "gu",
  "org_id": "uuid|null"
}
```

---

## Submissions (Ingestion)

### `POST /submissions`
Coordinator uploads raw field data.
- **Auth:** coordinator or admin
- **Content-Type:** `multipart/form-data`
- **Body fields:**
  - `raw_text`: optional string
  - `images`: up to 5 files, max 5 MB each (can also reference pre-uploaded GCS keys from `/uploads/signed-url`)
  - `audio`: optional, max 10 MB
- **Server sets `source='webform'`.** The client does NOT supply the `source` field — it's inferred from the endpoint.

Response:
```json
{
  "submission_id": "uuid",
  "status": "received",
  "estimated_processing_seconds": 15
}
```

### `POST /webhooks/sendgrid`
SendGrid event webhook. Receives delivery events (`delivered`, `bounced`, `deferred`, `dropped`, `spam_report`, `open`, `click`) and updates `notifications.status` + `notifications.delivered_at`.
- Payload signed with SendGrid's ED25519 public key; server verifies the signature before processing.
- Idempotent: duplicate events are ignored via `(provider_message_id, event_type)` uniqueness check.
- On permanent bounce (`bounce` with reason "invalid email"), the volunteer's `email_deliverable` flag is set to `false` and an admin alert is raised.

---

## Uploads

### `POST /uploads/signed-url`
Generic endpoint used by:
- Coordinators for large submission images (before calling `/submissions` with the GCS key)
- Volunteers for task-completion photos (before calling `/assignments/{id}/status` with the URL)

```json
// Request
{
  "content_type": "image/jpeg",
  "filename": "IMG_1234.jpg",
  "purpose": "submission" | "completion"
}

// Response
{
  "upload_url": "https://storage.googleapis.com/...",
  "object_key": "submissions/2026/04/17/abc.jpg" | "task-completion/{assignment_id}/{uuid}.jpg",
  "public_url": "https://storage.googleapis.com/bucket/...",
  "expires_at": "2026-04-17T10:45:00+05:30"
}
```

The server enforces the path prefix based on `purpose` — a volunteer can't use this endpoint to upload into the submissions prefix, and vice versa.

---

## Needs

### `GET /needs`
Query params:
- `status` — one of `pending_review | published | matching_complete | assigned | in_progress | completed | cancelled`
- `urgency` — one or more
- `need_type`
- `min_priority_score`
- `near_lat` + `near_lng` + `radius_km`
- `limit`, `cursor`

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "...",
      "description": "...",
      "need_type": "medical",
      "urgency": "critical",
      "priority_score": 78.4,
      "priority_breakdown": {
        "urgency_component": 40.0,
        "severity_component": 17.5,
        "beneficiary_component": 12.8,
        "time_pressure_component": 10.0,
        "resource_difficulty_component": -1.9
      },
      "location": { "lat": 22.3, "lng": 72.1, "text": "Kathlal, Kheda" },
      "beneficiary_count": 45,
      "required_skills": ["pediatrician"],
      "required_team_size": 2,
      "deadline": "2026-04-19T10:00:00+05:30",
      "status": "published",
      "created_at": "..."
    }
  ],
  "next_cursor": "..."
}
```

**Note:** `priority_score` returned here is computed on-read. The stored `priority_score` column omits `time_pressure`; the API adds it freshly using the current `deadline`. This way there's no hourly cron job.

### `GET /needs/{id}`
Full detail including original raw submission reference.

### `GET /needs/{id}/explain`
```json
{
  "priority_score": 78.4,
  "breakdown": {
    "urgency_component": 40,
    "severity_component": 17.5,
    "beneficiary_component": 12.8,
    "time_pressure_component": 10.0,
    "resource_difficulty_component": -1.9
  },
  "formula": "priority = W_u*u + W_s*s + W_b*log(1+b) + W_t*t - W_r*r",
  "weights": {"W_u": 40, "W_s": 25, "W_b": 20, "W_t": 10, "W_r": 5}
}
```

### `PATCH /needs/{id}`
Coordinator edits AI-extracted fields before publishing.
Auth: coordinator. Only allowed if status is `pending_review`.
```json
{
  "title": "Urgent medical camp needed — Kathlal village",
  "need_type": "medical",
  "urgency": "critical",
  "beneficiary_count": 45,
  "required_skills": ["pediatrician", "nurse"],
  "required_team_size": 2,
  "deadline": "2026-04-19T10:00:00+05:30",
  "window_start": "2026-04-19T09:00:00+05:30",
  "window_end": "2026-04-19T17:00:00+05:30"
}
```

### `POST /needs/{id}/publish`
Moves `pending_review` → `published`. Triggers matching worker.

### `POST /needs/{id}/cancel`
Coordinator cancels a need with a reason.

### `GET /needs/{id}/assignments`
List all assignments (team members) for a need.

---

## Volunteers

### `POST /volunteers`
Self-registration. Auth: any authenticated user.
```json
{
  "skills": ["pediatrician", "hindi-speaker"],
  "certifications": ["MBBS - RGUHS 2019"],
  "home_location": { "lat": 23.03, "lng": 72.58 },
  "home_address": "...",
  "max_travel_km": 15,
  "availability_slots": [
    { "start": "2026-04-19T09:00:00+05:30", "end": "2026-04-19T13:00:00+05:30", "recurrence": null },
    { "start": "2026-04-26T09:00:00+05:30", "end": "2026-04-26T13:00:00+05:30", "recurrence": "WEEKLY:SAT" }
  ],
  "notification_prefs": { "email": true, "in_app": true }
}
```
Response: created volunteer profile. Server triggers skills embedding generation asynchronously.

### `PATCH /volunteers/me`
Update own profile. If `skills` changes, re-generates embedding asynchronously.

### `GET /volunteers/me`
Own profile.

### `DELETE /volunteers/me`
**DPDP right-to-erasure.** Soft-deletes the user:
- Sets `users.deleted_at = NOW()`
- Scrubs PII from `volunteer_profiles`: sets `skills_text`, `certifications`, `verification_docs`, `home_address` to NULL
- Keeps anonymized aggregates (`total_tasks_completed`, `reliability_score`) for analytics integrity
- Cascade: all future `/assignments` return 404 for this volunteer
- Auth: self

Response: `204 No Content`.

### `GET /volunteers/me/assignments`
```json
{
  "items": [
    {
      "assignment_id": "uuid",
      "need": { "id": "uuid", "title": "...", "location": {...}, "urgency": "..." },
      "status": "pending_accept",
      "match_score": 0.87,
      "assigned_at": "...",
      "accept_deadline": "2026-04-17T10:45:00+05:30"
    }
  ]
}
```

### `GET /volunteers` (admin only)
Browse/search volunteers. Supports filters: `verified`, `skill`, `near_lat/lng`.

### `POST /volunteers/{id}/verify` (admin only)
Mark volunteer verified after document check.

---

## Assignments

### `POST /assignments/{id}/accept`
Volunteer accepts. Returns updated assignment. Fails if past `accept_deadline` or already responded.

**Side effect:** the handler checks whether all required-role assignments on the parent need are now `accepted`. If so, transitions `needs.status` from `matching_complete` → `assigned` and calls `sync_firestore('needs', need_id)`.

### `POST /assignments/{id}/decline`
```json
{ "reason": "Out of station" }
```
Triggers matching worker to find next candidate (via re-publish of `need.published`).

### `POST /assignments/{id}/status`
Update status during task execution.
```json
{
  "status": "in_progress" | "completed",
  "notes": "Checked 23 children, 3 referred to district hospital",
  "photo_urls": ["https://..."]   // obtained via /uploads/signed-url with purpose='completion'
}
```

**Side effects:**
- First volunteer's `in_progress` transitions `needs.status` → `in_progress`
- Last `completed` transitions `needs.status` → `completed` and sets `completed_at`

### `POST /assignments/{id}/rate`
Coordinator rates volunteer after completion. Auth: coordinator.
```json
{ "rating": 5, "feedback": "Prompt, thorough, documentation was excellent" }
```

Updates `volunteer_profiles.reliability_score` via EMA.

---

## Analytics & Reports

### `GET /analytics/dashboard`
Coordinator dashboard aggregates (all computed from Postgres).
```json
{
  "open_needs_count": 12,
  "critical_needs_count": 3,
  "pending_review_count": 4,
  "active_volunteers": 87,
  "avg_response_time_minutes": 23,
  "beneficiaries_served_this_week": 412,
  "heatmap": [ { "lat": 22.1, "lng": 72.3, "count": 5 } ]
}
```

### `GET /reports/weekly`
Query params: `?week=2026-W16`
Returns JSON version of the weekly report.

### `GET /reports/weekly.pdf`
Returns a signed GCS URL to the PDF (15-min TTL).

---

## Notifications (in-app)

### `GET /notifications`
Paginated notification feed.

### `POST /notifications/{id}/read`
Mark as read.

---

## Cron Endpoints (Cloud Scheduler)

These endpoints are invoked by Cloud Scheduler with OIDC authentication. They are NOT reachable externally.

### `POST /cron/escalate`
Runs every hour. Finds stale `pending_accept` assignments past their `accept_deadline`, marks them `expired`, and re-publishes `need.published` for any under-assigned need.

### `POST /cron/weekly-report`
Runs weekly (Mon 06:00 IST). Triggers the reports-worker via Pub/Sub.

---

## Realtime (Firestore, not REST)

Clients use **Firestore SDK listeners** directly for realtime updates:

- Coordinator listens to `/coordinator_feed/{org_id}/feed` for live events
- Coordinator listens to `/needs_realtime/{need_id}` for a single need's status
- Volunteer listens to `/task_status/{assignment_id}` for their assignment status

These are read-only for clients — server-side Firestore rules enforce this. All writes go through the backend's `sync_firestore()` helper.

## Error Codes Reference

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Role not permitted |
| `NOT_FOUND` | 404 | Entity does not exist |
| `VALIDATION_ERROR` | 422 | Body failed schema |
| `CONFLICT` | 409 | e.g., already accepted |
| `RATE_LIMITED` | 429 | Too many requests |
| `UPSTREAM_AI_ERROR` | 502 | Vertex AI timeout |
| `QUOTA_EXCEEDED` | 503 | AI quota exceeded; retry later |

## OpenAPI Spec

FastAPI auto-generates the OpenAPI 3.1 spec at `/api/v1/openapi.json` and docs at `/api/v1/docs`. Share this with the frontend team.
