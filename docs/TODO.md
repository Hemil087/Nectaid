# Nectaid — Master TODO

> **Current status (Apr 25, 2026):** Backend ≈ Day 10 (all core endpoints done). Frontend wiring in progress. Deadline: Apr 28 23:59 IST.
> Items are ordered by dependency chain — don't skip ahead.

---

## 🔴 BACKEND

### AI / Ingestion Pipeline (Day 3 — COMPLETE)

- [x] ~~Create Pub/Sub topic `need.submitted` + push subscription~~ — skipped, using BackgroundTasks instead
- [x] Wire Gemini 2.5 Flash multimodal call with structured output + strict JSON schema (`app/services/extraction.py`)
- [x] Define `NeedExtraction` Pydantic model
- [x] Add schema validation on every Gemini response; retry once on schema mismatch
- [x] Generate need embedding via `text-embedding-004` (`app/services/embedding.py`)
- [x] Write `needs` row to Postgres in `pending_review` state (`app/services/needs_service.py`)
- [x] Compute and persist priority score (stable components) on need creation
- [x] Background task wired into `POST /submissions`
- [x] `raw_submissions.status` lifecycle: `received → processing → extracted` (or `failed`)
- [ ] Add prompt injection defense: scan extracted fields for suspicious patterns
- [x] Call `sync_firestore('needs', id)` so coordinator's review queue listener fires
- [ ] Run Gemini eval: 10 realistic sample submissions → check extraction outputs

### Uploads Endpoint (Day 3 — COMPLETE)

- [x] `POST /uploads/signed-url` — GCS signed URL in prod, local file fallback in dev
- [x] Local dev upload receiver: `PUT /uploads/local/{key}`
- [x] Local dev file serve: `GET /uploads/file/{key}`

### Needs Endpoints (Day 4 — COMPLETE)

- [x] `GET /needs/{id}` — single need detail
- [x] `PATCH /needs/{id}` — coordinator edits extracted fields (only while `status = pending_review`)
- [x] `POST /needs/{id}/publish` — transition to `published`, triggers matching as BackgroundTask
- [x] `POST /needs/{id}/cancel` — coordinator cancels a need
- [x] `GET /needs/{id}/explain` — priority breakdown JSON
- [x] `GET /needs/{id}/assignments` — list all assignments for a need
- [ ] Install audit log trigger on `needs` table

### Priority Scoring (Day 5 — COMPLETE)

- [x] Implement `compute_priority()` in Python (`app/services/priority.py`)
- [x] `time_pressure` computed on-read from `deadline`, NOT persisted
- [x] Store priority breakdown JSONB on need creation
- [x] Return `time_pressure` + full breakdown in all `GET /needs` and `GET /needs/{id}` responses

### Matching Pipeline (Day 5 — COMPLETE)

- [x] `app/services/matching.py` — Phase 2+3: scoring + greedy/Hungarian team formation
- [x] `app/services/matching_worker.py` — Phase 1 SQL + Phase 4 persist assignments as BackgroundTask
- [x] Insert `assignments` rows with `status = pending_accept` + `accept_deadline = now() + 15min`
- [x] Transition `needs.status` to `matching_complete` on success
- [x] Graceful degradation when `need.embedding` or `need.location` is None
- [x] Call `sync_firestore('assignments', id)` for each assignment created
- [x] Emit inline SendGrid email per assignment created

### Volunteer Assignment Endpoints (Day 6 — COMPLETE)

- [x] `PATCH /volunteers/me` — update volunteer profile fields + re-generate embedding when skills change
- [x] `GET /volunteers/me/assignments` — paginated list with embedded need details
- [x] `POST /assignments/{id}/accept` — check deadline + transition need to `assigned` when all accepted
- [x] `POST /assignments/{id}/decline` — store reason
- [x] `POST /assignments/{id}/status` — `in_progress` / `completed` with photo URLs + cascade need status
- [x] `POST /assignments/{id}/rate` — coordinator rates; EMA reliability score update
- [x] Generate skill embedding on `POST /volunteers` registration (async BackgroundTask)
- [ ] Install audit log trigger on `assignments` table

### Analytics (Day 9 — COMPLETE)

- [x] `GET /analytics/dashboard` — 8 Postgres aggregates: open/critical/pending counts, active volunteers, avg response time, beneficiaries served this week, needs-by-status map, heatmap (returns `[]` until geocoding is wired)

### Escalation Cron (Day 7 — COMPLETE)

- [x] `POST /cron/escalate` — expire stale `pending_accept` assignments, reset need to `published`, re-run `run_matching` for under-assigned needs
- [x] Auth: `CRON_SECRET` env var for local dev; OIDC SA email verification for Cloud Run prod
- [ ] Wire Cloud Scheduler every-15-min job → `POST /cron/escalate` (needs GCP console access)

### Realtime + Firestore Sync (Day 7 — COMPLETE)

- [x] Implement `sync_firestore()` helper in `app/services/firestore_sync.py`
  - Writes `/needs_realtime/{need_id}` on need status changes
  - Writes `/task_status/{assignment_id}` on assignment status changes
  - Writes `/coordinator_feed/{org_id}/feed/{event_id}` on key events
- [x] Wire into ingestion pipeline after extraction (need_created event)
- [x] Wire into `needs.py` on publish (need_published event) and cancel
- [x] Wire into `matching_worker.py` after assignment creation (assignment_created event)
- [x] Wire into `assignments.py` on accept, decline, status, rate

### Notification Worker (Day 8 — COMPLETE)

- [x] Send assignment email inline in `matching_worker.py` after `_persist_assignments()`
  - SendGrid SDK: volunteer email, need title/urgency/deadline, deep link to `/assignments/{id}`
  - Write `notifications` row to Postgres (`status=queued → sent/failed`)
- [x] `GET /notifications` — paginated in-app notification feed with `unread_count`
- [x] `POST /notifications/{id}/read` — mark as read (ownership check)
- [ ] `POST /webhooks/sendgrid` — ED25519 signature verification, update `notifications.status`
- [ ] On permanent bounce: flag `email_deliverable=False` on volunteer profile

### Reports (Day 9 — NOT STARTED)

- [ ] `GET /reports/weekly?week=YYYY-WNN` — weekly report JSON
- [ ] `GET /reports/weekly.pdf` — return 15-min signed GCS URL to PDF
- [ ] Reports worker: Postgres aggregates → Gemini narrative → WeasyPrint PDF → GCS upload
- [ ] `POST /cron/weekly-report` (OIDC-authenticated) → trigger reports worker

### Admin Endpoints (COMPLETE)

- [x] `POST /admin/users/{id}/suspend` — set `deleted_at` (admin only)
- [x] `GET /admin/volunteers` — list with filter + pagination (admin/coordinator), cursor-paginated
- [x] `PATCH /admin/volunteers/{id}/verify` — set `volunteer_profiles.verified = true` (admin only)

### Security Hardening (COMPLETE — app level)

- [x] Every route has `Depends(require_role(...))` or explicit "public" annotation (audit done)
- [x] Every multipart upload validates MIME + size (submissions.py + uploads.py)
- [x] Rate limiter — `slowapi` 100 req/min per IP, applied globally via `SlowAPIMiddleware`
- [x] HSTS header (`max-age=63072000; includeSubDomains`) + `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` via `SecurityHeadersMiddleware` in `main.py`
- [x] Logs scrubbed of PII — `app/utils/safe_log.py` (email + phone regex scrubbers); email removed from assignment notification log
- [x] `/cron/*` routes: `CRON_SECRET` in dev, OIDC SA email in prod
- [ ] Secrets in Secret Manager only (not in git, not in .env files) — infra task
- [ ] GCS bucket: uniform access + no public objects — infra task
- [ ] Cloud SQL: no authorized public networks — infra task
- [ ] Audit log triggers installed on `needs`, `assignments`, `volunteer_profiles`, `users`
- [ ] SendGrid webhook signature verified (`POST /webhooks/sendgrid`)
- [ ] Worker Cloud Run services deployed with `--no-allow-unauthenticated`
- [ ] `DELETE /api/v1/volunteers/me` tested — PII scrubbed, aggregates intact

---

## 🟡 FRONTEND

### Pages — all wired (COMPLETE)

- [x] `/dashboard` — stats from `GET /analytics/dashboard` + Firestore live activity feed (30s poll)
- [x] `/needs` — `GET /needs` with status + urgency filters, client-side title search, skeleton loaders
- [x] `/needs/[id]` — detail + Firestore realtime status overlay + assignments team list + publish/cancel actions
- [x] `/needs/[id]/review` — full edit form for all PATCH-able fields + "Save & publish" flow
- [x] `/assignments` — `GET /volunteers/me/assignments` with Active/Pending/Completed tabs + pending count badge
- [x] `/assignments/[id]` — accept/decline/start/complete flow + Firestore realtime status
- [x] `/notifications` — `GET /notifications` list + `POST /notifications/{id}/read`
- [x] `/submissions/new` — multipart form upload wired to `POST /submissions`
- [x] `/volunteers/register` — multi-step volunteer registration flow
- [x] `/admin/volunteers` — admin volunteer management page (scaffolded)
- [x] `/volunteers/me` — volunteer profile edit page (scaffolded)

### API clients + hooks (COMPLETE)

- [x] `lib/api/needs.ts` — list, get, patch, publish, explain
- [x] `lib/api/analytics.ts` — dashboard
- [x] `lib/api/notifications.ts` — list, read, readAll
- [x] `lib/api/assignments.ts` — accept, decline, status, rate
- [x] `lib/firebase/firestore.ts` — Firestore client init
- [x] `lib/hooks/use-coordinator-feed.ts` — `/coordinator_feed/{org_id}/feed` listener
- [x] `lib/hooks/use-need-realtime.ts` — `/needs_realtime/{need_id}` listener
- [x] `lib/hooks/use-task-realtime.ts` — `/task_status/{assignment_id}` listener

### Notification bell (COMPLETE)

- [x] Bell icon in TopBar links to `/notifications`
- [x] Unread count badge — fetches `unread_count` from `GET /notifications`, polls every 30s, shows red badge capped at `9+`

### Remaining frontend work

- [ ] Toast notifications on accept/decline/status mutations (sonner)
- [ ] Role-filter sidebar nav (hide coordinator items from volunteer view)
- [ ] Photo upload in completion form — wire `POST /uploads/signed-url` + `PUT` to GCS/local
- [ ] `/reports` page — wire to `GET /reports/weekly` + PDF download (blocked on backend)
- [ ] `components/dashboard/needs-heatmap.tsx` — Leaflet map (blocked until `need.location` geocoding is wired)
- [ ] Skeleton loaders on pages that are missing them
- [ ] Error boundaries on all pages
- [ ] `messages/hi.json` + `messages/gu.json` + `next-intl` provider — i18n
- [ ] Tablet layout: collapsed sidebar → Sheet nav at <1024px

---

## 🟢 INFRA / DEVOPS

- [ ] Confirm Pub/Sub topics created: `need.submitted`, `need.published`, `assignment.created`, `task.completed`
- [ ] Confirm Cloud Run services deployed for workers with `--no-allow-unauthenticated`
- [ ] Cloud Scheduler job: every 15 min → `POST /cron/escalate` (needs GCP console)
- [ ] Cloud Scheduler job: Mon 06:00 IST → `POST /cron/weekly-report` (needs GCP console)
- [ ] Budget alert configured at $50/month
- [ ] GitHub Actions deploy workflow: test → build → push → Cloud Run deploy → Alembic migration
- [ ] Workload Identity Federation configured (no long-lived SA keys in CI)

---

## 🔵 DEMO PREP

- [x] Seed 20 test volunteers with varied skills, locations, languages (`scripts/seed_demo.py`)
- [x] Seed 10 test needs — all statuses covered: pending_review, published, matching_complete, assigned, in_progress, completed, cancelled
- [x] Seed historical assignments (completed, accepted, in_progress) so dashboard avg response time + beneficiary stats are non-zero
- [ ] Firebase Auth: create coordinator + admin + 2 volunteer accounts in Firebase console, run seed with their UIDs:
      `DEMO_COORDINATOR_UID=xxx DEMO_ADMIN_UID=xxx docker compose exec api python scripts/seed_demo.py`
- [ ] Verify SendGrid sender identity (`noreply@nectaid.org`); test assignment email end-to-end
- [ ] Run full E2E: submission → AI extraction → coordinator review → publish → matching → volunteer accept → complete → rate
- [ ] Record screen demo: priority breakdown card, notification bell badge, assignment accept/decline flow
- [ ] Architecture diagram in slide deck
- [ ] Tag release: `git tag v0.1.0-demo`

---

## 📊 STATUS SUMMARY

| Area | Status |
|---|---|
| Docker / DB / Alembic / models | ✅ Done |
| Firebase auth (frontend + backend) | ✅ Done |
| Core API auth + volunteer + submissions endpoints | ✅ Done |
| Frontend login / shell / submission form | ✅ Done |
| Volunteer self-registration (signup flow) | ✅ Done |
| Priority scoring service | ✅ Done |
| AI ingestion pipeline (BackgroundTasks) | ✅ Done |
| Needs endpoints (GET list/detail, PATCH, publish, cancel, explain, assignments) | ✅ Done |
| Matching algorithm service (scoring + team formation) | ✅ Done |
| Matching worker (Phase 1 SQL + persist assignments) | ✅ Done |
| Uploads signed-URL endpoint (GCS + local dev fallback) | ✅ Done |
| Assignment endpoints (accept/decline/status/rate) | ✅ Done |
| PATCH /volunteers/me + GET /volunteers/me/assignments | ✅ Done |
| GET /analytics/dashboard (8 Postgres aggregates) | ✅ Done |
| POST /cron/escalate (expire stale + re-match) | ✅ Done |
| Frontend — all app pages scaffolded | ✅ Done |
| Frontend realtime hooks (Firestore listeners) | ✅ Done |
| sync_firestore() helper + wire into all mutations | ✅ Done |
| SendGrid email inline on assignment creation | ✅ Done |
| GET /notifications + POST /notifications/{id}/read | ✅ Done |
| Admin endpoints (list/verify/suspend) | ✅ Done |
| Skill embedding on volunteer registration | ✅ Done |
| App-level security hardening (rate limit, HSTS, safe_log) | ✅ Done |
| Frontend pages fully wired to API (dashboard, needs, assignments, notifications) | ✅ Done |
| Notification bell with live unread badge | ✅ Done |
| Demo seed script (20 volunteers, 10 needs, historical assignments) | ✅ Done |
| Reports endpoint + PDF worker | ❌ Missing |
| i18n (hi + gu) | ❌ Missing |
| Infra security (Secret Manager, GCS, Cloud SQL) | ❌ Infra task |
| Firebase Auth accounts wired to seed users | ❌ Manual step |
| E2E demo run + recording | ❌ Pending |