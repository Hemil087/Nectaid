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
8. [Key Decisions & Gotchas](#8-key-decisions--gotchas)
9. [What's Not Built Yet](#9-whats-not-built-yet)

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
│   │       ├── volunteers.py    # POST/GET/DELETE /volunteers
│   │       ├── needs.py         # GET /needs
│   │       └── submissions.py   # POST /submissions
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
│   ├── utils/
│   │   └── firebase.py          # init_firebase_admin()
│   ├── database.py              # async engine + get_db() dependency
│   ├── dependencies.py          # get_current_user(), require_role()
│   └── main.py                  # FastAPI app, routers, CORS, health
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

**Response:**
```json
{
  "items": [...],
  "total": 42,
  "next_cursor": "20"
}
```

Note: cursor is currently offset-based. Will be replaced with keyset pagination (on `created_at + id`) post-MVP.

---

### Submissions

#### `POST /submissions`
Creates a raw submission. Role: `coordinator` or `admin`.

Server always sets `source='webform'` and `status='received'` — client cannot override these.

**Request body:**
```json
{
  "raw_text": "There are 40 flood-affected families near Vasna...",
  "image_urls": ["https://storage.googleapis.com/..."],
  "submitter_phone": "+919876543210"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "received",
  "created_at": "2026-04-18T12:00:00Z"
}
```

---

### Health

#### `GET /health`
No auth required.

```json
{
  "status": "ok",
  "service": "core-api",
  "version": "0.2.0"
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
All `needs` table fields except `embedding` — the 768-dim vector is never sent to the client.

### `NeedsListResponse`
```
items: list[NeedResponse]
total: int
next_cursor: str | None
```

### `SubmissionCreate`
```
raw_text: str | None
image_urls: list[str] = []
submitter_phone: str | None
```

### `SubmissionResponse`
```
id: UUID
status: str
created_at: datetime
```

---

## 8. Key Decisions & Gotchas

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

**`delete_my_profile` requires `db` injection.**
Setting `user.deleted_at` on the ORM object without flushing does nothing — the session must be told about the change. Always inject `db: AsyncSession = Depends(get_db)` and call `await db.flush()` in mutation endpoints.

**`init_firebase_admin()` is called once on startup, not per request.**
Firebase SDK initialization is expensive. It's called in `startup_event()` in `main.py`. The `verify_firebase_token_from_header()` function does NOT call it — it assumes it's already initialized.

**Role defaults to `volunteer` if no Firebase custom claim is set.**
On first `POST /auth/session`, if the Firebase token has no `role` claim, the user is created as a volunteer. To create coordinators or admins, set the custom claim via Firebase Admin SDK before the user's first login.

---

## 9. What's Not Built Yet

Endpoints still needed (in priority order):

| Endpoint | Day | Purpose |
|---|---|---|
| `PATCH /volunteers/me` | Day 6 | Update volunteer profile |
| `GET /volunteers/me/assignments` | Day 6 | Volunteer's assignment list |
| `GET /needs/{id}` | Day 4 | Single need detail |
| `GET /needs/{id}/explain` | Day 5 | Priority score breakdown |
| `PATCH /needs/{id}` | Day 4 | Coordinator edits extracted fields |
| `POST /needs/{id}/publish` | Day 4 | Publish need → triggers matching |
| `POST /needs/{id}/cancel` | Day 4 | Cancel a need |
| `POST /assignments/{id}/accept` | Day 6 | Volunteer accepts |
| `POST /assignments/{id}/decline` | Day 6 | Volunteer declines |
| `POST /assignments/{id}/status` | Day 6 | Update status (in_progress / completed) |
| `POST /assignments/{id}/rate` | Day 6 | Coordinator rates volunteer |
| `POST /uploads/signed-url` | Day 3 | GCS signed URL for file upload |
| `GET /analytics/dashboard` | Day 9 | Coordinator dashboard aggregates |
| `GET /reports/weekly` | Day 9 | Weekly report JSON |
| `GET /reports/weekly.pdf` | Day 9 | Signed GCS URL for PDF |
| `POST /notifications/{id}/read` | Day 7 | Mark notification read |
| `POST /cron/escalate` | Day 7 | Cloud Scheduler: expire stale assignments |
| `POST /cron/weekly-report` | Day 9 | Cloud Scheduler: trigger report generation |
| `POST /webhooks/sendgrid` | Day 8 | SendGrid event webhook |

Background workers not yet started:

| Worker | Day | Purpose |
|---|---|---|
| `ingestion-worker` | Day 3 | Pub/Sub consumer: Gemini extraction + embedding |
| `matching-worker` | Day 5 | Pub/Sub consumer: run matching algorithm |
| `notification-worker` | Day 8 | Pub/Sub consumer: send SendGrid emails |
| `reports-worker` | Day 9 | Pub/Sub consumer: generate weekly PDF |
