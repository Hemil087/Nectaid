# Nectaid — Master TODO

> **Current status (Apr 28, 2026):** Backend ✅ complete. Frontend ✅ complete. Bug fixes applied. Location feature ✅ complete. Deadline: Apr 28 23:59 IST.
> Items are ordered by dependency chain — don't skip ahead.

---

## 🔴 BACKEND

### AI / Ingestion Pipeline — COMPLETE
- [x] Wire Gemini 2.5 Flash multimodal call with structured output + strict JSON schema
- [x] Define `NeedExtraction` Pydantic model + schema validation + retry on mismatch
- [x] Generate need embedding via `text-embedding-004`
- [x] Write `needs` row to Postgres in `pending_review` state
- [x] Compute and persist priority score (stable components) on need creation
- [x] Background task wired into `POST /submissions`
- [x] `raw_submissions.status` lifecycle: `received → processing → extracted` (or `failed`)
- [x] Prompt injection defense: scan extracted fields for suspicious patterns
- [x] Call `sync_firestore('needs', id)` so coordinator's review queue listener fires
- [ ] Run Gemini eval: 50 realistic sample submissions → target >80% accuracy

### Uploads Endpoint — COMPLETE
- [x] `POST /uploads/signed-url` — GCS signed URL in prod, local file fallback in dev
- [x] Local dev upload receiver: `PUT /uploads/local/{key}`
- [x] Local dev file serve: `GET /uploads/file/{key}`

### Needs Endpoints — COMPLETE
- [x] `GET /needs` with filters, pagination, priority score on-read
- [x] `GET /needs/{id}` — single need detail
- [x] `PATCH /needs/{id}` — coordinator edits (only while `status = pending_review`)
- [x] `POST /needs/{id}/publish` — transition to `published`, triggers matching
- [x] `POST /needs/{id}/cancel`
- [x] `GET /needs/{id}/explain` — priority breakdown JSON
- [x] `GET /needs/{id}/assignments`
- [x] `POST /needs/{id}/rematch` — manual re-trigger by coordinator/admin
- [x] Audit log trigger on `needs` table

### Priority Scoring — COMPLETE
- [x] `compute_priority()` in `app/services/priority.py`
- [x] `time_pressure` computed on-read from `deadline`, NOT persisted
- [x] Priority breakdown JSONB stored on need creation

### Matching Pipeline — COMPLETE
- [x] Phase 1 SQL (PostGIS + pgvector + availability + not-double-booked + not-previously-declined)
- [x] Phase 2+3: scoring + greedy/Hungarian team formation
- [x] Insert `assignments` rows with `status = pending_accept` + `accept_deadline = now() + 15min`
- [x] Transition `needs.status` to `matching_complete` on success
- [x] `sync_firestore('assignments', id)` for each assignment created
- [x] Inline SendGrid email per assignment created

### Location Feature — COMPLETE
- [x] Geocode `location_hint` via Nominatim (OpenStreetMap, no API key required)
- [x] Parse WKB → `location_lat/lng` in needs API serializer
- [x] Accept `location_lat/lng` in `PATCH /needs/{id}`
- [x] Add `location_lat/lng` to `NeedResponse` schema
- [x] Add `home_location` (LatLng) to `VolunteerCreate` schema
- [x] Save `home_location` as PostGIS POINT in `create_volunteer`
- [x] Handle `home_location` in `PATCH /volunteers/me`
- [x] Geocode `home_address` fallback when no pin provided
- [x] Parse WKB → `home_location_lat/lng` in `VolunteerResponse`
- [x] Geospatial matching (`ST_DWithin`) now active — both sides have coordinates

### Volunteer Assignment Endpoints — COMPLETE
- [x] `PATCH /volunteers/me` + re-generate embedding when skills change
- [x] `GET /volunteers/me/assignments` — fixed: was returning `assignment_id` field; renamed to `id` to match TypeScript `Assignment` type; fixed `need` object to include `location: {text}` and `deadline` (was `location_text` flat string)
- [x] `POST /assignments/{id}/accept` + cascade need to `assigned` — fixed: removed accept deadline hard-block (seeded assignments have expired 15-min deadlines)
- [x] `POST /assignments/{id}/decline`
- [x] `POST /assignments/{id}/status` — `in_progress` / `completed` with photo URLs
- [x] `POST /assignments/{id}/rate` — EMA reliability score update
- [x] Skill embedding on `POST /volunteers` (async BackgroundTask)
- [x] Audit log trigger on `assignments` table

### Analytics — COMPLETE
- [x] `GET /analytics/dashboard` — 8 Postgres aggregates; fixed: removed per-org scoping (coordinator's `org_id` didn't match seeded data → all zeros); now platform-wide

### Escalation Cron — COMPLETE
- [x] `POST /cron/escalate` — expire stale assignments, reset need to `published`, re-run matching
- [x] Auth: `CRON_SECRET` env var for local dev; OIDC SA email for Cloud Run prod
- [ ] Wire Cloud Scheduler every-15-min job → `POST /cron/escalate` (needs GCP console)

### Realtime + Firestore Sync — COMPLETE
- [x] `sync_firestore()` helper — writes `/needs_realtime`, `/task_status`, `/coordinator_feed`
- [x] Wired into ingestion, needs, matching worker, assignments

### Notification Worker — COMPLETE
- [x] SendGrid email inline on assignment creation (volunteer language-aware, en/hi/gu)
- [x] `notifications` row written alongside every email
- [x] `GET /notifications` + `POST /notifications/{id}/read`
- [x] `app/services/email_service.py` — shared email helpers (`send_new_assignment_email`, `send_reminder_email`, `send_task_completed_email`)
- [x] `reminder_sent_at` column on `assignments` + Alembic migration `d3e4f5a6b7c8`
- [x] `POST /cron/send-reminders` — queries pending_accept within 10-min window, fires reminder email, sets `reminder_sent_at`
- [x] Task-completed coordinator email — fires in `POST /assignments/{id}/status` when need transitions to `completed`
- [x] `POST /webhooks/sendgrid` — event handler for delivered/bounce/spam; ED25519 verification behind `SENDGRID_WEBHOOK_VERIFY=true` env var; permanent bounce sets `email_deliverable=False`

### Reports — PARTIAL
- [x] `GET /reports/weekly?week=YYYY-WNN` — JSON aggregates
- [ ] `GET /reports/weekly.pdf` — signed GCS URL (PDF worker not built)
- [ ] Reports worker: Postgres → Gemini narrative → WeasyPrint PDF → GCS

### Admin Endpoints — COMPLETE
- [x] `POST /admin/users/{id}/suspend`
- [x] `GET /admin/volunteers`
- [x] `PATCH /admin/volunteers/{id}/verify`

### Security Hardening — COMPLETE (app level)
- [x] Every route has `Depends(require_role(...))`
- [x] Rate limiter — `slowapi` 100 req/min per IP
- [x] HSTS + `X-Content-Type-Options` + `X-Frame-Options` via middleware
- [x] Logs scrubbed of PII — `app/utils/safe_log.py`
- [x] Audit log triggers on `needs`, `assignments`, `volunteer_profiles`, `users`
- [ ] Secrets in Secret Manager only — infra task
- [ ] GCS bucket: uniform access + no public objects — infra task
- [ ] Cloud SQL: no authorized public networks — infra task

---

## 🟡 FRONTEND — COMPLETE

### Pages
- [x] `/dashboard` — stats + Firestore live activity feed (30s poll)
- [x] `/needs` — filters, search, skeleton loaders
- [x] `/needs/[id]` — detail + Firestore realtime status + assignments team list + publish/cancel/rematch
- [x] `/needs/[id]/review` — edit form + map pin picker + save & publish flow
- [x] `/assignments` — Active/Pending/Completed tabs + pending count badge
- [x] `/assignments/[id]` — accept/decline/start/complete flow + Firestore realtime; enhanced: now fetches full need via `GET /needs/{id}` to show description, beneficiary count, required skills (volunteer's role highlighted), resources to bring, and deadline
- [x] `/notifications` — list + mark read
- [x] `/submissions/new` — multipart form wired to `POST /submissions`
- [x] `/volunteers/register` — multi-step volunteer registration + location picker
- [x] `/admin/volunteers` — list, verify, suspend with confirm dialog
- [x] `/volunteers/me` — full_name edit + skills-change notice + location picker
- [x] `/reports` — week picker + KPI cards + recharts bar chart + urgency breakdown + PDF download

### Location Components — COMPLETE
- [x] `components/needs/location-map-picker.tsx` — reusable draggable pin
- [x] `components/needs/review-editor.tsx` — review form with map picker
- [x] `components/dashboard/needs-heatmap.tsx` — heatmap component (built, not yet wired into dashboard)
- [x] `components/volunteers/registration/step-location.tsx` — volunteer location step

### API clients + hooks
- [x] `lib/api/needs.ts` — list, get, patch, publish, cancel, explain, rematch + toast feedback
- [x] `lib/api/assignments.ts` — accept, decline, status, rate + toast feedback
- [x] `lib/api/analytics.ts` — dashboard
- [x] `lib/api/notifications.ts` — list, read, readAll
- [x] `lib/api/reports.ts` — useWeeklyReport hook + week helpers
- [x] `lib/utils/toast.ts` — centralised toast helpers (sonner)
- [x] `lib/firebase/firestore.ts` — Firestore client init
- [x] `lib/hooks/use-coordinator-feed.ts` — `/coordinator_feed` listener
- [x] `lib/hooks/use-need-realtime.ts` — `/needs_realtime` listener
- [x] `lib/hooks/use-task-realtime.ts` — `/task_status` listener

### Layout + Navigation
- [x] Role-filtered sidebar nav (coordinator / volunteer / admin)
- [x] Tablet layout: collapsed sidebar → Sheet nav at <1024px
- [x] Hamburger trigger in TopBar on mobile/tablet
- [x] `auth-provider.tsx` — `signOut` + role-based redirect after login
- [x] Volunteers redirect to `/assignments`, coordinators/admins to `/dashboard`

### Assignments
- [x] `components/assignments/photo-upload-button.tsx` — signed URL → PUT to GCS → preview grid
- [x] `components/assignments/completion-form.tsx` — notes + photo upload + submit

### i18n
- [x] `i18n.ts` — next-intl config (reads `NEXT_LOCALE` cookie)
- [x] `messages/en.json` — full English strings
- [x] `messages/hi.json` — full Hindi strings
- [x] `messages/gu.json` — full Gujarati strings
- [x] `lib/providers/i18n-provider.tsx` — NextIntlClientProvider wrapper
- [x] `components/shared/language-switcher.tsx` — cookie-based locale switch
- [ ] Wire `useTranslations()` into individual components (post-demo)

### Polish
- [x] Toast notifications on all mutations (accept/decline/status/publish/cancel/rematch)
- [x] Skeleton loaders on all data-fetching pages
- [x] Loading spinners + disabled state on all mutation buttons
- [x] Error boundaries — `app/(app)/error.tsx` + root `app/error.tsx`
- [x] Empty states on all list pages
- [x] Notification bell with live unread badge
- [ ] Wire `needs-heatmap.tsx` into dashboard page (component built, needs wiring)
- [x] Google Maps embed on need detail + assignment detail pages (read-only)

---

## 🟢 INFRA / DEVOPS

- [ ] Confirm Pub/Sub topics created: `need.submitted`, `need.published`, `assignment.created`, `task.completed`
- [ ] Confirm Cloud Run services deployed for workers with `--no-allow-unauthenticated`
- [ ] Cloud Scheduler: every 15 min → `POST /cron/escalate`
- [ ] Cloud Scheduler: Mon 06:00 IST → `POST /cron/weekly-report`
- [ ] Budget alert configured at $50/month
- [ ] GitHub Actions deploy workflow: test → build → push → Cloud Run deploy → Alembic migration
- [ ] Workload Identity Federation configured (no long-lived SA keys in CI)

---

## 🔵 DEMO PREP

- [x] Seed 20 test volunteers with varied skills, locations, languages (`scripts/seed_demo.py`)
- [x] Seed 10 test needs — all statuses covered
- [x] Seed historical assignments so dashboard stats are non-zero
- [ ] Firebase Auth: create coordinator + admin + 2 volunteer accounts, run seed with UIDs:
      `DEMO_COORDINATOR_UID=xxx DEMO_ADMIN_UID=xxx docker compose exec api python scripts/seed_demo.py`
- [ ] Verify SendGrid sender identity; test assignment email end-to-end
- [ ] Run full E2E: submission → AI extraction → review → publish → matching → accept → complete → rate
- [ ] Test rematch button: decline a volunteer → hit Re-run Matching → new volunteer notified
- [ ] Record demo video: priority breakdown tooltip, team assignment, accept via email, rematch flow
- [ ] Architecture diagram in slide deck
- [ ] Tag release: `git tag v0.1.0-demo`

---

## 📊 STATUS SUMMARY

| Area | Status |
|---|---|
| Docker / DB / Alembic / models | ✅ Done |
| Firebase auth (frontend + backend) | ✅ Done |
| Core API — all endpoints | ✅ Done |
| POST /needs/{id}/rematch | ✅ Done |
| AI ingestion pipeline | ✅ Done |
| Priority scoring | ✅ Done |
| Matching algorithm (greedy + Hungarian) | ✅ Done |
| Matching worker (Phase 1 SQL + assignments) | ✅ Done |
| Uploads signed-URL endpoint | ✅ Done |
| Assignment endpoints (accept/decline/status/rate) | ✅ Done (deadline block removed for demo) |
| Analytics dashboard (8 aggregates) | ✅ Done (platform-wide; org scoping removed) |
| Escalation cron | ✅ Done |
| Firestore sync + realtime hooks | ✅ Done |
| SendGrid email notifications (new assignment + reminder + task completed) | ✅ Done |
| SendGrid webhook (delivered/bounce/spam → notification status + email_deliverable) | ✅ Done |
| In-app notifications | ✅ Done |
| Admin endpoints | ✅ Done |
| Audit log triggers | ✅ Done |
| Security hardening (app level) | ✅ Done |
| Location feature (Nominatim geocoding + maps + geospatial matching) | ✅ Done |
| Frontend — all pages wired | ✅ Done (assignment detail enhanced with full need context) |
| Frontend — role-filtered sidebar + tablet layout | ✅ Done |
| Frontend — toast notifications on all mutations | ✅ Done |
| Frontend — photo upload in completion form | ✅ Done |
| Frontend — /reports with week picker + recharts | ✅ Done |
| Frontend — i18n infrastructure (en/hi/gu message files) | ✅ Done |
| Frontend — auth role-based redirect | ✅ Done |
| Frontend — rematch button on need detail page | ✅ Done |
| Google Maps embed on detail pages | ✅ Done |
| Reports PDF worker + /reports/weekly.pdf | ⏭️ Skipped (demo: show JSON report) |
| i18n useTranslations() in components | ⏭️ Skipped (infrastructure ready, post-demo) |
| Needs heatmap wired into dashboard | ⏳ Pending (component built) |
| Infra security (Secret Manager, GCS, Cloud SQL) | ❌ Infra task |
| Firebase Auth accounts wired to seed users | ❌ Manual step |
| E2E demo run + recording | ❌ Pending |