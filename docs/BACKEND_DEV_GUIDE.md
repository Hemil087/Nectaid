# Nectaid — Backend Development Guide

> **Reference for backend contributors.** Documents what was built, how it's structured, every decision made, and what comes next.

---

## Table of Contents

1. [Stack](#1-stack)
2. [Project Structure](#2-project-structure)
3. [Local Dev Setup](#3-local-dev-setup)
4. [Database](#4-database)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Endpoints (Built)](#6-api-endpoints-built)
7. [Schemas](#7-schemas)
8. [Ingestion Pipeline](#8-ingestion-pipeline)
9. [Matching Pipeline](#9-matching-pipeline)
10. [Key Decisions & Gotchas](#10-key-decisions--gotchas)
11. [What's Not Built Yet](#11-whats-not-built-yet)

---

## 1. Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI, Python 3.12 |
| ORM | SQLAlchemy 2.0 async |
| Migrations | Alembic |
| DB driver (app) | asyncpg |
| DB driver (alembic) | psycopg2-binary |
| Database | PostgreSQL 16 + pgvector + PostGIS |
| Auth | Firebase Admin SDK |
| Validation | Pydantic v2 |
| PDF / Reports | WeasyPrint |
| Email | SendGrid |
| AI | Vertex AI / Gemini 2.5 Flash |

---

## 2. Project Structure

```
services/core-api/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py          # POST /auth/session, GET /auth/me
│   │       ├── volunteers.py    # POST/GET/PATCH/DELETE /volunteers + /me/assignments
│   │       ├── needs.py         # Full needs CRUD + publish/cancel/explain/assignments
│   │       ├── submissions.py   # POST /submissions + _run_ingestion background task
│   │       ├── assignments.py   # POST accept/decline/status/rate
│   │       ├── uploads.py       # POST /signed-url + local dev upload receiver
│   │       ├── analytics.py     # GET /analytics/dashboard (Postgres aggregates)
│   │       ├── cron.py          # POST /cron/escalate (OIDC-authenticated)
│   │       ├── notifications.py # GET /notifications, POST /notifications/{id}/read
│   │       └── admin.py         # GET/PATCH/POST /admin/volunteers + /admin/users/{id}/suspend
│   ├── models/
│   │   ├── base.py              # DeclarativeBase with NAMING_CONVENTION
│   │   ├── user.py              # Org, User
│   │   ├── volunteer.py         # VolunteerProfile, AvailabilitySlot
│   │   ├── submission.py        # RawSubmission
│   │   ├── need.py              # Need
│   │   ├── assignment.py        # Assignment
│   │   ├── notification.py      # Notification, AuditLog
│   │   └── __init__.py          # imports all models (required for Alembic)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py              # SessionResponse
│   │   ├── volunteer.py         # VolunteerCreate, VolunteerResponse
│   │   ├── need.py              # NeedResponse, NeedsListResponse
│   │   └── submission.py        # SubmissionCreate, SubmissionResponse
│   ├── services/
│   │   ├── extraction.py        # extract_need() — Gemini 2.5 Flash multimodal extraction
│   │   ├── needs_service.py     # create_need_from_extraction() — persist Need row
│   │   ├── embedding.py         # embed_need_text() — text-embedding-004 768-dim vector
│   │   ├── priority.py          # compute_stable_components/score/full_score
│   │   ├── matching.py          # Phase 2+3: score_candidates(), form_team()
│   │   ├── matching_worker.py   # Phase 1 SQL + persist assignments (BackgroundTask)
│   │   └── firestore_sync.py    # sync_firestore() — mirrors Postgres state into Firestore
│   ├── utils/
│   │   ├── firebase.py          # init_firebase_admin()
│   │   └── safe_log.py          # scrub(text) — redacts email + phone from log messages
│   ├── database.py              # async engine + SessionLocal + get_db() dependency
│   ├── dependencies.py          # get_current_user(), require_role()
│   └── main.py                  # FastAPI app, routers, CORS, rate limiter, security headers
├── alembic/
│   ├── env.py                   # imports Base.metadata + all models
│   └── versions/
│       └── abcd0b71c7eb_initial_schema.py
├── alembic.ini                  # points to postgresql+psycopg2://
├── Dockerfile                   # COPY . . (includes alembic/)
└── requirements.txt
```

---

## 3. Local Dev Setup

### Prerequisites
- Docker Desktop

### Start everything

```bash
docker compose up --build -d
```

### Run migrations (first time only)

```bash
docker compose exec api sh -c "alembic upgrade head"
```

### Verify

```bash
# Check migration state
docker compose exec api sh -c "alembic current"

# Check tables
docker compose exec db sh -c "psql -U nectaid -d nectaid -c '\dt'"

# API health
curl http://localhost:8080/health

# Swagger docs
open http://localhost:8080/api/v1/docs
```

### After copying in new files (no schema changes)

```bash
docker compose restart api
```

### After changing models

```bash
# Generate a new migration
docker compose exec api sh -c "alembic revision --autogenerate -m 'your_message'"

# Apply it
docker compose exec api sh -c "alembic upgrade head"
```

Migration files appear on the host at `services/core-api/alembic/versions/` because the directory is volume-mounted. Commit them to git.

### After changing requirements.txt

```bash
docker compose build api
docker compose up -d
```

### Environment variables

Backend env vars are set directly in `docker-compose.yml` for local dev. For staging/production they come from GCP Secret Manager.

| Variable | Local value | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://nectaid:dev_password_change_in_prod@db:5432/nectaid` | Async DB connection (app) |
| `FIREBASE_SA` | path to `firebase-service-account.json` | Firebase Admin SDK credentials |
| `PROJECT_ID` | `nectaid-dev` | GCP project |
| `REGION` | `asia-south1` | GCP region |
| `GCS_UPLOADS_BUCKET` | _(unset locally)_ | When unset, uploads use local file fallback |

`firebase-service-account.json` is gitignored. Place it at `services/core-api/firebase-service-account.json` for local dev. Add a volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./services/core-api/app:/app/app
  - ./services/core-api/alembic:/app/alembic
  - ./services/core-api/firebase-service-account.json:/app/firebase-service-account.json
```

---

## 4. Database

### Tables (9 total)

| Table | Purpose |
|---|---|
| `orgs` | NGO organizations |
| `users` | All users — volunteers, coordinators, admins |
| `volunteer_profiles` | Extended profile for volunteers (skills, location, availability prefs) |
| `availability_slots` | Time windows when a volunteer is available |
| `raw_submissions` | Raw webform/email/API submissions before AI extraction |
| `needs` | Extracted and reviewed community needs |
| `assignments` | Volunteer-to-need assignment records |
| `notifications` | In-app and email notification records |
| `audit_log` | Append-only log of all mutations with before/after state |

### Extensions enabled

```sql
uuid-ossp   -- gen_random_uuid()
pgcrypto    -- PII encryption
postgis     -- geospatial queries (ST_DWithin for proximity matching)
vector      -- pgvector (embedding similarity search)
```

### Key schema decisions

- **`users.deleted_at`** — soft delete, never hard delete. All queries must filter `WHERE deleted_at IS NULL`.
- **`volunteer_profiles.skills_embedding`** — `vector(768)`, populated by text-embedding-004 on registration/update. Used for semantic matching.
- **`needs.embedding`** — same, populated by AI extraction pipeline.
- **`ivfflat` index uses `lists=10`** — safe for dev/small data. Increase to 100+ in production when row count exceeds 300.
- **`availability_slots`** — separate table, not a JSONB column. Single source of truth for availability.
- **`raw_submissions.source`** — set by the server, never trusted from client. `webform` for `POST /submissions`, `email` and `api` for future ingestion workers.

### Alembic notes

- `alembic.ini` uses `postgresql+psycopg2://` (sync driver) — intentional. Alembic runs sync; the app uses asyncpg.
- `alembic/env.py` imports `Base.metadata` and all models via `from app.models import *` so autogenerate detects all tables.
- `spatial_ref_sys` is a PostGIS system table — it will appear in autogenerate diffs. It is excluded from migrations manually.
- `ivfflat` indexes are created in the migration with `lists=10`. Change to `lists=100` before production deploy once data volume justifies it.

---

## 5. Authentication & Authorization

### Flow

```
Client
  → sends Firebase ID token in Authorization: Bearer <token>
FastAPI dependency (get_current_user)
  → verifies token with Firebase Admin SDK
  → looks up user in Postgres by firebase_uid
  → returns User row
Route handler
  → uses User row for role checks and business logic
```

### Key files

**`app/utils/firebase.py`** — initializes Firebase Admin SDK once on startup.

```python
def init_firebase_admin():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    sa_path = os.getenv("FIREBASE_SA")
    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault()  # Cloud Run fallback
    return firebase_admin.initialize_app(cred)
```

Called once in `main.py` `startup_event`. Not called per-request.

**`app/dependencies.py`** — two main dependencies:

```python
# Verifies token + looks up user in Postgres
async def get_current_user(authorization: str = Header(...), db: AsyncSession = Depends(get_db)) -> User

# Wraps get_current_user + checks role
def require_role(*roles: str) -> Callable
```

Usage in routes:

```python
# Any authenticated user
current_user: User = Depends(get_current_user)

# Specific role only
current_user: User = Depends(require_role("coordinator", "admin"))
```

### Role system

Roles are stored in `users.role` in Postgres. Three valid values: `volunteer`, `coordinator`, `admin`.

On first login (`POST /auth/session`), if the user doesn't exist in Postgres yet, the role is read from Firebase custom claims (`claims.get("role")`). If no claim is set, defaults to `volunteer`.

Firebase custom claims are set server-side only — never by the client. Use Firebase Admin SDK to set them:

```python
auth.set_custom_user_claims(uid, {"role": "coordinator"})
```

### Error responses

| Situation | HTTP |
|---|---|
| Missing or invalid token | 401 |
| User not in Postgres or soft-deleted | 401 |
| Wrong role for endpoint | 403 |

---

## 6. API Endpoints (Built)

Base path: `/api/v1`

All endpoints require `Authorization: Bearer <firebase_id_token>` except `/health`.

---

### Auth

#### `POST /auth/session`
Creates a user in Postgres on first login, or returns existing user.

- Verifies Firebase token
- If user doesn't exist → creates `users` row with role from Firebase claims (default: `volunteer`)
- Returns `SessionResponse`

**Response:**
```json
{
  "user_id": "uuid",
  "role": "volunteer",
  "full_name": "Arjun Mehta",
  "email": "arjun@example.com",
  "org_id": null
}
```

#### `GET /auth/me`
Returns the current user's session info. Requires valid token + existing Postgres user.

---

### Volunteers

#### `POST /volunteers`
Creates a volunteer profile. Creates the `users` row if it doesn't exist, then creates `volunteer_profiles`.

Returns 400 if profile already exists for this user.

**Request body:**
```json
{
  "full_name": "Priya Shah",
  "phone": "+919876543210",
  "email": "priya@example.com",
  "preferred_language": "gu",
  "skills": ["first_aid", "teaching"],
  "home_address": "Ahmedabad, Gujarat",
  "max_travel_km": 25,
  "notification_prefs": { "email": true, "in_app": true }
}
```

#### `GET /volunteers/me`
Returns the current volunteer's user + profile. Role: `volunteer` only. Returns 404 if no profile.

#### `PATCH /volunteers/me`
Updates the current volunteer's profile. Role: `volunteer` only.

Patchable fields on `users`: `full_name`, `phone`, `email`, `preferred_language`.
Patchable fields on `volunteer_profiles`: `skills`, `home_address`, `max_travel_km`, `notification_prefs`, `certifications`.

If `skills` changes, the skills embedding is regenerated asynchronously inline. Non-fatal if embedding fails — will show a warning in logs.

**Request body:** any subset of patchable fields as a flat JSON object.

#### `GET /volunteers/me/assignments`
Returns the current volunteer's assignments with embedded need details. Role: `volunteer` only.

**Response:**
```json
{
  "items": [
    {
      "assignment_id": "uuid",
      "need": {
        "id": "uuid",
        "title": "Urgent medical camp needed",
        "need_type": "medical",
        "urgency": "critical",
        "location_text": "Kathlal, Kheda",
        "status": "matching_complete"
      },
      "role_in_team": "pediatrician",
      "match_score": 0.87,
      "status": "pending_accept",
      "assigned_at": "...",
      "accept_deadline": "...",
      "responded_at": null,
      "completion_notes": null,
      "completion_photo_urls": null
    }
  ],
  "total": 3
}
```

#### `DELETE /volunteers/me`
Soft-deletes the current user by setting `users.deleted_at`. DPDP right-to-erasure. Returns 204. Any role.

---

### Needs

#### `GET /needs`
Returns paginated list of needs. Role: `coordinator` or `admin`.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by need status |
| `urgency` | string | Filter by urgency level |
| `limit` | int | Page size, default 20, max 100 |
| `cursor` | string | Pagination cursor (integer offset) |

`priority_score` in the response always includes fresh `time_pressure` computed from `deadline`.

#### `GET /needs/{id}`
Full need detail. Role: `coordinator`, `admin`, or `volunteer`.

#### `PATCH /needs/{id}`
Coordinator edits AI-extracted fields. Only allowed while `status = pending_review`. Role: `coordinator` or `admin`.

Allowed fields: `title`, `need_type`, `category`, `description`, `urgency`, `beneficiary_count`, `required_skills`, `required_team_size`, `resources_needed`, `deadline`, `window_start`, `window_end`.

If any scoring field changes (`urgency`, `need_type`, `category`, `beneficiary_count`, `required_skills`), stable priority components are recomputed and persisted.

#### `POST /needs/{id}/publish`
Transitions `pending_review → published`. Recomputes and persists the full stable priority score. Triggers the matching pipeline as a `BackgroundTask`. Role: `coordinator` or `admin`.

**Matching background task** (`run_matching` in `services/matching_worker.py`):
1. Fetches candidate volunteers via SQL (PostGIS radius + pgvector cosine + availability + not double-booked + not previously declined on this need)
2. Scores candidates + forms team via `matching.py`
3. Inserts `Assignment` rows (`status=pending_accept`, `accept_deadline=now+15min`)
4. Transitions need to `matching_complete`

Graceful degradation: if `need.embedding` or `need.location` is `None`, the relevant SQL filter is skipped rather than failing.

#### `POST /needs/{id}/cancel`
Cancels a need from any non-terminal state. Role: `coordinator` or `admin`.

#### `GET /needs/{id}/explain`
Returns the full priority score breakdown. Role: `coordinator` or `admin`.

**Response:**
```json
{
  "priority_score": 78.4,
  "breakdown": {
    "urgency_component": 40.0,
    "severity_component": 17.5,
    "beneficiary_component": 12.8,
    "time_pressure_component": 10.0,
    "resource_difficulty_component": -1.9,
    "total": 78.4
  },
  "formula": "priority = W_u*u + W_s*s + W_b*log(1+b) + W_t*t - W_r*r",
  "weights": {"W_u": 40, "W_s": 25, "W_b": 20, "W_t": 10, "W_r": 5}
}
```

#### `GET /needs/{id}/assignments`
Lists all assignment rows for a need. Role: `coordinator` or `admin`.

---

### Submissions

#### `POST /submissions`
Creates a raw submission and fires the ingestion pipeline as a background task. Role: `coordinator` or `admin`.

**Request:** multipart/form-data (not JSON)

| Field | Type | Description |
|---|---|---|
| `raw_text` | string (optional) | Typed field report text |
| `files` | file(s) (optional) | Images — jpeg/png/webp/heic, max 10 MB each |

At least one of `raw_text` or `files` must be provided.

Files are saved to `/app/uploads/{submission_id}/{filename}` inside the container. `image_urls` stored in DB as `/uploads/{id}/{filename}`.

Server sets `source='webform'` and `status='received'` — client cannot override.

**Response** (immediate — before pipeline completes):
```json
{
  "id": "uuid",
  "status": "received",
  "created_at": "2026-04-18T12:00:00Z"
}
```

---

### Assignments

#### `POST /assignments/{id}/accept`
Volunteer accepts a pending assignment. Role: `volunteer` (own assignments only).

Fails with 409 if: status is not `pending_accept`, or `accept_deadline` has passed.

**Side effect:** if all required-role assignments on the parent need are now `accepted`, transitions `needs.status` from `matching_complete → assigned`.

#### `POST /assignments/{id}/decline`
Volunteer declines a pending assignment. Role: `volunteer` (own assignments only).

**Request body (optional):**
```json
{ "reason": "Out of station this weekend" }
```

#### `POST /assignments/{id}/status`
Volunteer updates status during task execution. Role: `volunteer` (own assignments only).

**Request body:**
```json
{
  "status": "in_progress" | "completed",
  "notes": "Checked 23 children, 3 referred to district hospital",
  "photo_urls": ["https://..."]
}
```

Valid transitions: `accepted → in_progress`, `in_progress → completed`.

**Side effects:**
- First `in_progress` → transitions need from `assigned → in_progress`
- Last `completed` (all other assignments terminal) → transitions need to `completed`, sets `completed_at`

`photo_urls` should be GCS public URLs obtained by first calling `POST /uploads/signed-url` with `purpose=completion`, uploading directly, then passing the `public_url` here.

#### `POST /assignments/{id}/rate`
Coordinator rates a volunteer after task completion. Role: `coordinator` or `admin`.

**Request body:**
```json
{ "rating": 5, "feedback": "Prompt, thorough, documentation was excellent" }
```

Updates `volunteer_profiles.reliability_score` via EMA (α=0.2, clamped to [0.05, 1.0]).
Also increments `total_tasks_completed` on the profile.

---

### Uploads

#### `POST /uploads/signed-url`
Returns a pre-authorised URL for the client to upload a file directly, plus the `public_url` to store in the DB.

Role: any authenticated user.

**Request body:**
```json
{
  "content_type": "image/jpeg",
  "filename": "photo.jpg",
  "purpose": "submission" | "completion"
}
```

**Response:**
```json
{
  "upload_url": "https://...",
  "object_key": "task-completion/abc123/photo.jpg",
  "public_url": "https://...",
  "expires_at": "2026-04-25T10:45:00+00:00"
}
```

**Two modes:**

| Mode | When | Behaviour |
|---|---|---|
| **GCS** | `GCS_UPLOADS_BUCKET` env var is set | Generates a real v4 signed PUT URL (15-min TTL) |
| **Local dev** | `GCS_UPLOADS_BUCKET` unset | Returns `upload_url` pointing to `PUT /api/v1/uploads/local/{key}` on this server |

The `purpose` field enforces path prefixes server-side — a volunteer cannot write to the `submissions/` prefix.

#### `PUT /uploads/local/{key}` _(local dev only, hidden from Swagger)_
Receives raw file bytes and saves to `/app/uploads/local/{key}`. Max 10 MB.

#### `GET /uploads/file/{key}` _(local dev only, hidden from Swagger)_
Serves a previously uploaded local file.

---

### Analytics

#### `GET /analytics/dashboard`
Returns coordinator dashboard aggregates computed directly from Postgres. Role: `coordinator` or `admin`.

Scoped to `user.org_id` when set; platform-wide when `org_id` is NULL (admin or unaffiliated coordinator).

**Response:**
```json
{
  "open_needs_count": 12,
  "critical_needs_count": 3,
  "pending_review_count": 4,
  "active_volunteers": 87,
  "avg_response_time_minutes": 23.4,
  "beneficiaries_served_this_week": 412,
  "needs_by_status": {
    "pending_review": 4,
    "published": 2,
    "matching_complete": 1,
    "assigned": 3,
    "in_progress": 2
  },
  "heatmap": [
    { "lat": 22.31, "lng": 72.13, "count": 5 }
  ]
}
```

`heatmap` returns `[]` until `need.location` geocoding is wired (known gap — `need.location` is currently always `NULL`). `avg_response_time_minutes` is `null` when no responded assignments exist yet.

---

### Cron

All cron endpoints require `Authorization: Bearer <token>`. Auth accepts either:
- **Local dev:** `Bearer <CRON_SECRET>` where `CRON_SECRET` is set in `docker-compose.yml`
- **Production:** Google OIDC token from `scheduler-invoker` SA; email verified against `GOOGLE_SA_EMAIL` env var

#### `POST /cron/escalate`
Expires stale `pending_accept` assignments and re-triggers matching for under-assigned needs.

**Algorithm:**
1. Find all `assignments` where `status = 'pending_accept'` AND `accept_deadline < now()`
2. Mark them `expired`
3. For each affected need: count accepted assignments; if `accepted_count < required_team_size` and need is not terminal, reset need to `published` and call `run_matching()` (which excludes previously expired volunteers via the NOT EXISTS filter)

**Response:**
```json
{
  "expired": 3,
  "rematched_needs": ["uuid-1", "uuid-2"]
}
```

**Test locally:**
```bash
# Add CRON_SECRET=dev-secret to docker-compose.yml env, then:
curl -X POST http://localhost:8080/api/v1/cron/escalate \
  -H "Authorization: Bearer dev-secret"
```

---

### Notifications

#### `GET /notifications`
Returns the current user's paginated notification feed. Any authenticated role.

**Query params:** `limit` (1–100, default 20), `cursor` (integer offset).

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "channel": "email",
      "subject": "[Nectaid] New volunteer assignment: ...",
      "body": "...",
      "related_entity_type": "assignment",
      "related_entity_id": "uuid",
      "status": "sent",
      "read_at": null,
      "created_at": "2026-04-25T10:00:00Z"
    }
  ],
  "total": 5,
  "unread_count": 2,
  "next_cursor": "20"
}
```

#### `POST /notifications/{id}/read`
Marks a notification as read. Verifies the notification belongs to the current user (403 otherwise).

**Response:** `{ "id": "uuid", "read_at": "2026-04-25T10:05:00Z" }`

---

### Admin

All admin endpoints are under `/admin`. Role requirements are noted per endpoint.

#### `GET /admin/volunteers`
Lists all volunteers with optional filters. Role: `coordinator` or `admin`.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `verified` | bool | Filter by verified status |
| `active` | bool | Filter by active status |
| `skill` | string | Substring match against skills array |
| `limit` | int | Page size, default 20, max 100 |
| `cursor` | string | Integer offset cursor |

**Response:** `{ "items": [...], "total": N, "next_cursor": "20" | null }`

Each item is a flat merge of `users` + `volunteer_profiles` fields.

#### `PATCH /admin/volunteers/{user_id}/verify`
Sets `volunteer_profiles.verified = true`. Role: `admin` only.

**Response:** `{ "user_id": "uuid", "verified": true }`

#### `POST /admin/users/{user_id}/suspend`
Soft-deletes a user by setting `users.deleted_at = now()`. Role: `admin` only.

Returns 409 if user is already suspended.

**Response:** `{ "user_id": "uuid", "suspended_at": "2026-04-25T10:00:00Z" }`

---

### Health

#### `GET /health`
No auth required.

```json
{
  "status": "ok",
  "service": "core-api",
  "version": "0.4.0"
}
```

---

## 7. Schemas

All schemas use Pydantic v2. `model_config = ConfigDict(from_attributes=True)` on response models so they work with SQLAlchemy ORM objects.

### `SessionResponse`
```
user_id: UUID
role: str
full_name: str
email: str | None
org_id: UUID | None
```

### `VolunteerCreate`
```
full_name: str
phone: str | None
email: str | None
preferred_language: str = "en"
skills: list[str] = []
home_address: str | None
max_travel_km: int = 20
notification_prefs: dict = {"email": True, "in_app": True}
```

### `VolunteerResponse`
Flat merge of `users` + `volunteer_profiles` fields. Timestamps are prefixed `user_created_at` / `profile_created_at` to avoid collision.

### `NeedResponse`
All `needs` table fields except `embedding` — the 768-dim vector is never sent to the client. `priority_score` is always the full score (stable + fresh `time_pressure`).

### `NeedsListResponse`
```
items: list[NeedResponse]
total: int
next_cursor: str | None
```

### `SubmissionResponse`
```
id: UUID
status: str
created_at: datetime
```

### `SignedUrlResponse`
```
upload_url: str
object_key: str
public_url: str
expires_at: str
```

---

## 8. Ingestion Pipeline

### Overview

After `POST /submissions` saves the `raw_submissions` row, a FastAPI `BackgroundTasks` task runs the full ingestion pipeline asynchronously:

```
POST /submissions
  → save RawSubmission (status=received) → return 201 immediately
  → [background] _run_ingestion()
      1. status → processing
      2. read image bytes from disk (/app/uploads/{id}/)
      3. extract_need(text, images) → NeedExtraction
      4. create_need_from_extraction(db, submission_id, extracted) → Need
      5. embed_need_text(title + description + required_skills) → vector(768)
      6. need.embedding = vector
      7. status → extracted, extracted_need_id = need.id, processed_at = now()
      [on any exception]
      7. status → failed, extraction_error = str(exc)[:2000]
```

### Files

| File | Responsibility |
|---|---|
| `app/api/v1/submissions.py` | `POST /submissions` endpoint + `_run_ingestion()` background task |
| `app/services/extraction.py` | `extract_need(text, images) -> NeedExtraction` — Gemini call, retry, PII strip |
| `app/services/needs_service.py` | `create_need_from_extraction(db, id, extracted) -> Need` — ORM persist + priority score |
| `app/services/embedding.py` | `embed_need_text(text) -> list[float]` — text-embedding-004 via Vertex AI |
| `app/services/priority.py` | `compute_stable_components/score/full_score` — deterministic priority formula |

### Priority formula

```
stable_score = 40 × urgency_value           (critical=1.0, high=0.7, medium=0.4, low=0.1)
             + 25 × severity_value           (by need_type + category)
             + 20 × log10(1+count)/log10(1001)  (beneficiary scale, 0..1)
             −  5 × avg_skill_rarity         (stored negative in breakdown)

full_score (on-read) = stable_score + 10 × time_pressure_value
```

`stable_score` is persisted. `time_pressure` is recomputed on every read from `deadline`.

### Vertex AI credentials

Both `extraction.py` and `embedding.py` load credentials from `FIREBASE_SERVICE_ACCOUNT_JSON` (already in `.env`) and pass them explicitly to `vertexai.init()`. This avoids Application Default Credentials not being present inside the Docker container. The Firebase SA must have `roles/aiplatform.user` granted.

### Model notes

- **Extraction:** `gemini-2.5-flash` — only Gemini model available in `asia-south1`. Set `max_output_tokens=32768` to accommodate thinking tokens (the model uses internal reasoning that consumes the output budget invisibly; 8192 is not enough on complex inputs).
- **Embedding:** `text-embedding-004` — 768-dim, `task_type=RETRIEVAL_DOCUMENT` for needs (index side). Volunteers use `RETRIEVAL_QUERY` when searching.

---

## 9. Matching Pipeline

### Overview

Triggered as a `BackgroundTask` from `POST /needs/{id}/publish`. Lives in `app/services/matching_worker.py`.

```
POST /needs/{id}/publish
  → status → published, priority score persisted → return response immediately
  → [background] run_matching(need_id)
      Phase 1  — _fetch_candidates(): raw SQL with dynamic clauses
      Phase 2  — score_candidates(): weighted match_score per candidate
      Phase 3  — form_team(): greedy skill coverage → Hungarian fallback
      Phase 4  — _persist_assignments(): insert Assignment rows
                  need.status → matching_complete
      [no candidates] — need stays published, coordinator sees "no matches" state
      [exception]      — need stays published, error logged
```

### Phase 1 SQL

Dynamic SQL built in `_fetch_candidates()`. Clauses are conditionally included based on what's populated on the need:

| Condition | When skipped |
|---|---|
| `pgvector cosine ORDER BY` | `need.embedding is None` → falls back to `ORDER BY reliability_score DESC` |
| `ST_DWithin` geospatial filter | `need.location is None` (currently always None — geocoding not yet wired) |
| `availability_slots` EXISTS | `need.window_start/window_end is None` |
| Double-booking `tstzrange` check | `need.window_start/window_end is None` |

The `NOT EXISTS` filter for previously-declined/expired volunteers always runs.

### Phase 2 Scoring (`matching.py`)

```python
match_score = 0.50 × similarity
            + 0.20 × location_score       # max(0, 1 - distance_km/max_travel_km)
            + 0.15 × reliability_score
            + 0.10 × experience_score     # min(experience_in_type/10, 1)
            + 0.05 × (1 - recency_penalty) # min(tasks_this_week/5, 1)
```

### Phase 3 Team Formation (`matching.py`)

1. `team_size == 1` → return top-1 by match_score
2. Single repeated skill → top-N by match_score
3. Multi-skill → greedy skill-coverage pass first
4. Greedy fails to cover all skills → Hungarian algorithm (`scipy.optimize.linear_sum_assignment`)

### Assignment rows

Each team member gets one `Assignment` row:
- `status = pending_accept`
- `accept_deadline = now() + 15 minutes`
- `match_breakdown` JSONB with per-component scores

### Files

| File | Responsibility |
|---|---|
| `app/services/matching_worker.py` | Phase 1 SQL + Phase 4 persist — BackgroundTask entry point |
| `app/services/matching.py` | Phase 2 scoring + Phase 3 team formation — pure Python, no DB |

---

## 10. Key Decisions & Gotchas

**Alembic uses psycopg2, app uses asyncpg — intentional.**
Alembic's migration engine is synchronous. psycopg2 is the sync driver. The running app uses asyncpg for async performance. Both point to the same database.

**`COPY . .` in Dockerfile — intentional.**
The Dockerfile copies the full `services/core-api/` directory into the image, not just `app/`. This is required so `alembic.ini` and `alembic/` are present inside the container. Without this, `alembic upgrade head` fails with "No config file found".

**`alembic/` is volume-mounted — intentional.**
```yaml
- ./services/core-api/alembic:/app/alembic
```
This means migration files generated inside the container (`alembic revision --autogenerate`) appear on the host and can be committed to git. Without this mount, migrations are lost when the container restarts.

**`embedding` excluded from `NeedResponse` — intentional.**
The `needs.embedding` column is a 768-dimension float vector (~6KB per row). Serializing it in list responses would waste significant bandwidth. The frontend never needs raw embeddings.

**`need.location` is always `None` for now — known gap.**
`needs_service.py` does not geocode `location_hint` (a text string like "Kathlal, Kheda") to a PostGIS point. The matching SQL handles this with a conditional clause — the geospatial filter is skipped when `need.location is None`. For MVP, volunteers are matched purely on skill embedding similarity + reliability score. Post-MVP: wire a geocoding API call in `create_need_from_extraction`.

**`init_firebase_admin()` is called once on startup, not per request.**
Firebase SDK initialization is expensive. It's called in `startup_event()` in `main.py`. The `verify_firebase_token_from_header()` function does NOT call it — it assumes it's already initialized.

**Role defaults to `volunteer` if no Firebase custom claim is set.**
On first `POST /auth/session`, if the Firebase token has no `role` claim, the user is created as a volunteer. To create coordinators or admins, set the custom claim via Firebase Admin SDK before the user's first login.

**Uploads: GCS vs local dev.**
`POST /uploads/signed-url` checks for `GCS_UPLOADS_BUCKET` env var. If unset, it returns a local upload URL (`PUT /api/v1/uploads/local/{key}`) so the frontend upload flow works without any GCS setup locally.

**Matching background task opens its own DB session.**
`run_matching` uses `SessionLocal()` directly, not `get_db()`, because it runs outside the request lifecycle. This is the same pattern as `_run_ingestion` in submissions.py.

**Rate limiter uses slowapi with `SlowAPIMiddleware`.**
`default_limits=["100/minute"]` on the `Limiter` instance applies to all routes automatically when using `SlowAPIMiddleware` — no per-route decorator needed. The limiter key is the client IP via `get_remote_address`.

**HSTS middleware sits before CORS in the middleware stack.**
Middleware in Starlette/FastAPI is applied in reverse order of `add_middleware` calls (last added = first to run on request, first to run on response). `SecurityHeadersMiddleware` is added before `CORSMiddleware` so HSTS + security headers appear on all responses including preflight OPTIONS.

**`safe_log.scrub()` is available but not applied globally.**
`app/utils/safe_log.py` provides `scrub(text)` to redact emails and phone numbers from log strings. It is applied manually only at the point of logging — not as a logging filter — to keep overhead minimal. The email-in-assignment-notification log in `matching_worker.py` was the only place logging raw PII; it now logs `volunteer_id` instead.

---

## 11. What's Not Built Yet

All core backend endpoints are complete. Remaining items are either low-priority, infra-only, or frontend-wiring work.

| Endpoint / Task | Priority | Notes |
|---|---|---|
| `POST /webhooks/sendgrid` | P2 | ED25519 delivery event handler — updates `notifications.status`; on permanent bounce set `email_deliverable=False` |
| `GET /reports/weekly` + `GET /reports/weekly.pdf` | P2 | Postgres aggregates → Gemini narrative → WeasyPrint PDF → GCS signed URL |
| `POST /cron/weekly-report` | P2 | OIDC-authenticated cron trigger for reports worker |
| Geocoding in `needs_service.py` | P2 | Convert `location_hint` text → PostGIS point so `need.location` is populated and geospatial matching activates |
| Audit log DB triggers | P3 | Postgres triggers on `needs`, `assignments`, `volunteer_profiles`, `users` |
| Cloud Scheduler jobs | Infra | Two jobs: `/cron/escalate` every 15 min, `/cron/weekly-report` Mon 06:00 IST |
| GCS bucket ACL + Cloud SQL network policy | Infra | No authorized public networks; uniform bucket access |
| Secrets in Secret Manager | Infra | Move all env vars from `docker-compose.yml` to GCP Secret Manager for staging/prod |

Background workers:

| Worker | Status |
|---|---|
| ~~`ingestion-worker`~~ | Replaced by `BackgroundTasks` in `core-api` |
| ~~`matching-worker`~~ | Replaced by `BackgroundTasks` in `core-api` |
| ~~`notification-worker`~~ | Replaced by inline SendGrid in `matching_worker.py` |
| `reports-worker` | Not started — Postgres aggregates → Gemini narrative → WeasyPrint PDF → GCS |