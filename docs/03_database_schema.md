# 03 — Database Schema

## 1. Design Philosophy

- **Postgres is source of truth** for all business entities
- **Firestore mirrors only real-time fields** — written by a single `sync_firestore()` helper
- **No BigQuery** — analytics queries hit Postgres directly for MVP
- **GCS stores binary artifacts** — DB stores URLs, never blobs
- **Soft deletes** via `deleted_at TIMESTAMPTZ` on user-facing tables
- **Every table has `created_at` and `updated_at`** — enforced by triggers

## 2. Postgres Schema (Full)

```sql
-- =========================================================
-- Extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =========================================================
-- updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('volunteer','coordinator','admin')),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en','hi','gu')),
    org_id UUID,  -- FK filled after orgs table
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- ORGS (NGOs)
-- =========================================================
CREATE TABLE orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    contact_email TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES orgs(id);

-- =========================================================
-- VOLUNTEER PROFILES
-- =========================================================
-- NOTE: We intentionally do NOT have an `availability` JSONB column.
-- Availability lives only in availability_slots (below) — single source of truth.
-- We also do NOT store tasks_this_week / attempted_volunteer_ids as columns;
-- both are computed via subqueries in the matching SQL.
CREATE TABLE volunteer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL DEFAULT '{}',
    skills_text TEXT,                                  -- concat for embedding
    skills_embedding vector(768),
    certifications TEXT[],
    home_location geography(POINT, 4326),
    home_address TEXT,
    max_travel_km INT DEFAULT 20 CHECK (max_travel_km BETWEEN 1 AND 200),
    verified BOOLEAN DEFAULT FALSE,
    verification_docs JSONB,
    reliability_score FLOAT DEFAULT 0.5 CHECK (reliability_score BETWEEN 0 AND 1),
    total_tasks_completed INT DEFAULT 0,
    total_tasks_declined INT DEFAULT 0,
    notification_prefs JSONB DEFAULT '{"email":true,"in_app":true}'::JSONB,
    email_deliverable BOOLEAN DEFAULT TRUE,  -- set to FALSE on permanent SendGrid bounce
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vp_home_location ON volunteer_profiles USING GIST(home_location);
CREATE INDEX idx_vp_skills_embedding ON volunteer_profiles
    USING ivfflat (skills_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_vp_active_verified ON volunteer_profiles(active, verified) WHERE active = TRUE;
CREATE TRIGGER trg_vp_updated BEFORE UPDATE ON volunteer_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- AVAILABILITY SLOTS (sole source of volunteer availability)
-- =========================================================
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    recurrence TEXT,  -- e.g., 'WEEKLY:SAT' or NULL for one-off
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_time > start_time)
);
CREATE INDEX idx_avail_volunteer_range ON availability_slots(volunteer_id, start_time, end_time);

-- =========================================================
-- RAW SUBMISSIONS
-- =========================================================
-- The `source` field is set by the server based on the endpoint that
-- created the row (not trusted from the client):
--   POST /submissions          → source='webform'
--   POST /admin/ingest/email   → source='email'  (future: email-to-submission endpoint)
--   POST /admin/ingest/api     → source='api'    (future: partner-NGO integration)
CREATE TABLE raw_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('webform','email','api')),
    submitted_by UUID REFERENCES users(id),
    submitter_phone TEXT,  -- optional, captured if coordinator records who phoned in
    raw_text TEXT,
    image_urls TEXT[],
    audio_url TEXT,
    metadata JSONB,
    status TEXT DEFAULT 'received' CHECK (status IN ('received','processing','extracted','failed','discarded')),
    extraction_error TEXT,
    extracted_need_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX idx_raw_status ON raw_submissions(status, created_at);

-- =========================================================
-- NEEDS
-- =========================================================
-- Status transition rules (enforced by API handlers, not DB):
--   pending_review  → published         (coordinator publishes)
--   published       → matching_complete (matching worker finished)
--   matching_complete → assigned        (all required roles accepted)
--   assigned        → in_progress       (first volunteer starts)
--   in_progress     → completed         (all assignments complete)
--   any state       → cancelled         (coordinator action)
CREATE TABLE needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_submission_id UUID REFERENCES raw_submissions(id),
    org_id UUID REFERENCES orgs(id),
    need_type TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    description_original TEXT,
    original_language TEXT,
    location geography(POINT, 4326),
    location_text TEXT,
    urgency TEXT NOT NULL CHECK (urgency IN ('critical','high','medium','low')),
    beneficiary_count INT DEFAULT 1 CHECK (beneficiary_count >= 0),
    required_skills TEXT[],
    required_team_size INT DEFAULT 1 CHECK (required_team_size >= 1),
    resources_needed TEXT[],
    deadline TIMESTAMPTZ,
    priority_score FLOAT,              -- stored WITHOUT time_pressure; computed on read
    priority_breakdown JSONB,           -- components (urgency/severity/bene/resource); time_pressure added at read time
    embedding vector(768),
    window_start TIMESTAMPTZ,           -- when the task needs to happen (for availability matching)
    window_end TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review','published','matching_complete','assigned','in_progress','completed','cancelled','expired')
    ),
    created_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_needs_location ON needs USING GIST(location);
CREATE INDEX idx_needs_embedding ON needs
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_needs_status_priority ON needs(status, priority_score DESC);
CREATE INDEX idx_needs_urgency_deadline ON needs(urgency, deadline) WHERE status = 'published';
CREATE TRIGGER trg_needs_updated BEFORE UPDATE ON needs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- ASSIGNMENTS
-- =========================================================
-- The set of assignment rows per need IS the record of:
--   - who has been offered the task (status='pending_accept')
--   - who accepted/declined/expired
--   - who's doing/done the work
-- So "already-attempted volunteers" for re-matching is just:
--   SELECT volunteer_id FROM assignments WHERE need_id=$1 AND status IN ('declined','expired','no_show')
-- (no separate attempted_volunteer_ids column needed)
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id),
    role_in_team TEXT,
    match_score FLOAT,
    match_breakdown JSONB,
    status TEXT NOT NULL DEFAULT 'pending_accept' CHECK (
        status IN ('pending_accept','accepted','declined','in_progress','completed','cancelled','no_show','expired')
    ),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    accept_deadline TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    coordinator_rating INT CHECK (coordinator_rating BETWEEN 1 AND 5),
    volunteer_feedback TEXT,
    completion_notes TEXT,
    completion_photo_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (need_id, volunteer_id)
);
CREATE INDEX idx_assign_need ON assignments(need_id);
CREATE INDEX idx_assign_volunteer_status ON assignments(volunteer_id, status);
CREATE INDEX idx_assign_pending_deadline ON assignments(accept_deadline) WHERE status = 'pending_accept';
CREATE INDEX idx_assign_volunteer_recent ON assignments(volunteer_id, assigned_at DESC);  -- for recency subquery
CREATE TRIGGER trg_assign_updated BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- NOTIFICATIONS (in-app inbox + audit of outbound channels)
-- =========================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    channel TEXT NOT NULL CHECK (channel IN ('email','in_app')),
    subject TEXT,
    body TEXT NOT NULL,
    payload JSONB,
    related_entity_type TEXT,
    related_entity_id UUID,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','read')),
    provider_message_id TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user_status ON notifications(user_id, status, created_at DESC);

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id),
    actor_ip TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor_time ON audit_log(actor_user_id, created_at DESC);
```

## 3. Firestore Collections (Realtime Mirrors ONLY)

Firestore is NEVER the source of truth. These collections are written only by the `sync_firestore()` helper in `shared/firestore_sync.py`, called from both core-api and workers after a successful Postgres commit.

```
/needs_realtime/{need_id}
  - status: string             // mirrors needs.status
  - title: string
  - priority_score: number
  - last_updated: timestamp

/task_status/{assignment_id}
  - status: string             // mirrors assignments.status
  - volunteer_id: string
  - volunteer_name: string
  - need_id: string
  - need_title: string
  - last_updated: timestamp

/coordinator_feed/{org_id}/feed/{event_id}
  - type: string               // 'need.extracted', 'assignment.accepted', etc.
  - message: string
  - entity_id: string
  - created_at: timestamp
  - read: boolean
```

We removed `volunteer_presence` and `notifications_unread` from the original plan — they weren't wired to any UI feature in MVP.

## 4. Analytics (Direct Postgres Queries, No BigQuery)

For MVP scale (< 10k needs, < 1000 volunteers), Postgres aggregate queries with proper indexes run in < 100ms. No warehouse needed.

### Example: Coordinator Dashboard

```sql
-- Open needs by status
SELECT status, COUNT(*) FROM needs
WHERE status IN ('pending_review','published','matching_complete','assigned','in_progress')
GROUP BY status;

-- Critical needs count
SELECT COUNT(*) FROM needs
WHERE urgency='critical' AND status NOT IN ('completed','cancelled','expired');

-- Median time-to-accept this week (using percentile_cont)
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (responded_at - assigned_at))
) AS median_seconds
FROM assignments
WHERE status IN ('accepted','declined')
  AND assigned_at > NOW() - INTERVAL '7 days';

-- Beneficiaries served this week
SELECT COALESCE(SUM(beneficiary_count), 0) AS served
FROM needs
WHERE status='completed' AND completed_at > NOW() - INTERVAL '7 days';

-- Heatmap (aggregated to grid cells)
SELECT
    ROUND(ST_Y(location::geometry)::numeric, 2) AS lat,
    ROUND(ST_X(location::geometry)::numeric, 2) AS lng,
    COUNT(*) AS count
FROM needs
WHERE status='completed' AND completed_at > NOW() - INTERVAL '30 days'
GROUP BY lat, lng
HAVING COUNT(*) > 0;
```

### Scaling-Up Path (Post-MVP)

When you hit > 100k needs or analytic queries start degrading the OLTP workload, migrate to BigQuery with a nightly `pg_dump` + `bq load` job, or set up Datastream CDC. **Do not do this in the 11-day MVP.**

## 5. GCS Bucket Layout

```
gs://nectaid-prod-uploads/
  submissions/{yyyy}/{mm}/{dd}/{submission_id}/{original-filename}
  task-completion/{assignment_id}/{photo-n}.jpg

gs://nectaid-prod-reports/
  weekly/{org_id}/{yyyy-Www}.pdf

gs://nectaid-prod-backups/
  pg/{yyyy-mm-dd}.dump
```

- **Uniform bucket-level access** enabled
- **Versioning** on the uploads bucket
- Client uploads only via **signed URLs** from `POST /api/v1/uploads/signed-url` with 15-min expiry
- Lifecycle rule: move submissions to **Nearline after 30 days**

## 6. Data Retention

| Table/Bucket | Retention |
|---|---|
| `raw_submissions.raw_text` / images | 90 days, then PII-stripped archive |
| `needs` / `assignments` | 3 years |
| `audit_log` | 1 year |
| `notifications` | 60 days |
| GCS uploads | 90 days in Standard, then Nearline |
| GCS backups | 30 days rolling |
