# Nectaid — Master TODO

> **Current status (Apr 22, 2026):** Backend ≈ Day 2, Frontend ≈ Day 3. Deadline: Apr 28 23:59 IST.
> Items are ordered by dependency chain — don't skip ahead.

---

## 🔴 BACKEND

### AI / Ingestion Pipeline (Day 3 — MOST CRITICAL BLOCKER)

- [ ] Create Pub/Sub topic `need.submitted` + push subscription pointing to `ingestion-worker`
- [ ] Scaffold `services/workers/ingestion/` as a real FastAPI/Cloud Run app (not just `__init__.py`)
- [ ] Wire Gemini 2.5 Flash multimodal call with structured output + strict JSON schema
- [ ] Define `NeedExtraction` Pydantic model (title, description_en, location, need_type, urgency, beneficiaries, required_skills, deadline, confidence)
- [ ] Add schema validation on every Gemini response; retry once on failure, dead-letter on second fail
- [ ] Add prompt injection defense: scan extracted fields for suspicious patterns (`"ignore previous"`, `"system:"`)
- [ ] Generate need embedding via `text-embedding-004` (768-dim) from extracted text
- [ ] Write `needs` row to Postgres in `pending_review` state
- [ ] Call `sync_firestore('needs', id)` so coordinator's review queue listener fires
- [ ] Implement `sync_firestore()` shared helper (if not already in shared package)
- [ ] Run Gemini eval: 10 realistic sample submissions (mixed languages, text + photo) → check extraction outputs

### Uploads Endpoint (Day 3)

- [ ] `POST /uploads/signed-url` — generate 15-min GCS signed URL
  - Accept `purpose` param: `submission` | `completion`
  - Validate MIME type + enforce 5MB cap
  - Return signed URL + GCS key for use in subsequent API calls

### Needs Endpoints (Day 4)

- [ ] `GET /needs/{id}` — single need detail (coordinator/admin only)
- [ ] `PATCH /needs/{id}` — coordinator edits extracted fields (only allowed while `status = pending_review`)
- [ ] `POST /needs/{id}/publish` — transition to `published`, emit `need.published` Pub/Sub event
- [ ] `POST /needs/{id}/cancel` — coordinator cancels a need (any non-terminal state)
- [ ] `GET /needs/{id}/explain` — return priority breakdown JSON (even before full scoring is wired)
- [ ] Install audit log trigger on `needs` table (before/after state capture)

### Priority Scoring (Day 5)

- [ ] Implement `compute_priority()` in Python (deterministic formula using urgency, severity, beneficiaries, deadline, resource_difficulty)
- [ ] `time_pressure` computed on-read from `deadline`, NOT persisted
- [ ] Store priority breakdown JSONB on publish
- [ ] Return `time_pressure` + full breakdown in all `GET /needs` and `GET /needs/{id}` responses

### Matching Worker (Day 5 — CRITICAL)

- [ ] Scaffold `services/workers/matching/` as a real Cloud Run service
- [ ] Subscribe to `need.published` Pub/Sub topic
- [ ] Implement full candidate SQL query (PostGIS `ST_DWithin` + pgvector cosine + `availability_slots` JOIN + not-double-booked with `COALESCE(completed_at, 'infinity')` + not-previously-declined/expired)
- [ ] Implement `match_score()` Python ranking (weighted: similarity, distance, reliability, recency_penalty, experience_in_type)
- [ ] Implement greedy team formation; Hungarian algorithm fallback
- [ ] Insert `assignments` rows with `status = pending_accept` + `accept_deadline = now() + 15min`
- [ ] Transition `needs.status` to `matching_complete` on success (or back to `published` if no candidates)
- [ ] Call `sync_firestore('assignments', id)` for each assignment created
- [ ] Emit `assignment.created` Pub/Sub event per assignment

### Volunteer Assignment Endpoints (Day 6)

- [ ] `PATCH /volunteers/me` — update volunteer profile fields
- [ ] `GET /volunteers/me/assignments` — paginated list of volunteer's own assignments
- [ ] `POST /assignments/{id}/accept` — transition to `accepted`; check `accept_deadline` not passed
- [ ] `POST /assignments/{id}/decline` — transition to `declined`
- [ ] `POST /assignments/{id}/status` — update to `in_progress` or `completed` (with optional photo GCS key)
- [ ] `POST /assignments/{id}/rate` — coordinator rates volunteer (1–5 stars); update `reliability_score`
- [ ] Generate skill embedding on `POST /volunteers` registration (async after profile creation)
- [ ] Regenerate skill embedding on `PATCH /volunteers/me` when `skills` field changes
- [ ] Install audit log trigger on `assignments` table

### Realtime + Escalation (Day 7)

- [ ] Verify `sync_firestore()` correctly writes to `/coordinator_feed/{org_id}/feed`
- [ ] Verify `sync_firestore()` writes to `/needs_realtime/{need_id}` on status changes
- [ ] Verify `sync_firestore()` writes to `/task_status/{assignment_id}` on assignment status changes
- [ ] `POST /cron/escalate` endpoint (OIDC-authenticated, Cloud Scheduler)
  - Find all `pending_accept` assignments past `accept_deadline`
  - Mark them `expired`
  - Re-publish `need.published` for any under-assigned need (matching worker excludes previously expired)
- [ ] Wire Cloud Scheduler hourly job → `/cron/escalate`

### Notification Worker (Day 8)

- [ ] Scaffold `services/workers/notification/` as a real Cloud Run service
- [ ] Subscribe to `assignment.created` Pub/Sub topic
- [ ] Render Jinja2 email template in volunteer's `preferred_language` (en/hi/gu)
- [ ] Send via SendGrid transactional email API (include deep link to `/assignments/{id}`)
- [ ] Write `notifications` row to Postgres (`status = queued` → `delivered`/`bounced`)
- [ ] `POST /webhooks/sendgrid` — verify ED25519 signature, update `notifications.status`
- [ ] On permanent bounce: flag volunteer record + notify admin

### Notification API Endpoints (Day 8)

- [ ] `GET /notifications` — paginated in-app notification feed for current user
- [ ] `POST /notifications/{id}/read` — mark as read

### Analytics & Reports (Day 9)

- [ ] `GET /analytics/dashboard` — coordinator aggregates from Postgres (open_needs_count, critical_needs_count, pending_review_count, active_volunteers, avg_response_time_minutes, beneficiaries_served_this_week, heatmap array)
- [ ] `GET /reports/weekly?week=YYYY-WNN` — weekly report JSON
- [ ] `GET /reports/weekly.pdf` — return 15-min signed GCS URL to PDF
- [ ] Scaffold `services/workers/reports/` as a real Cloud Run service
- [ ] Reports worker: query Postgres aggregates → call Gemini for narrative → render PDF (WeasyPrint) → upload to GCS → write signed URL to coordinator's in-app inbox
- [ ] `POST /cron/weekly-report` endpoint (OIDC-authenticated) → emit Pub/Sub to reports worker
- [ ] Wire Cloud Scheduler weekly job (Mon 06:00 IST) → `/cron/weekly-report`

### Admin Endpoints

- [ ] `POST /admin/users/{id}/suspend` — set `deleted_at` (admin only)
- [ ] `GET /admin/volunteers` — list all volunteers with filter + pagination (admin/coordinator)
- [ ] `PATCH /admin/volunteers/{id}/verify` — set `volunteer_profiles.verified = true`

### Security Hardening (Before Submission)

- [ ] Every route has `Depends(require_role(...))` or explicit "public" annotation
- [ ] Every multipart upload validates MIME + size
- [ ] Secrets in Secret Manager only — not in git, not in .env files
- [ ] GCS bucket: uniform access + no public objects
- [ ] Cloud SQL: no authorized public networks; connect only via Cloud SQL Connector
- [ ] Audit log triggers installed on `needs`, `assignments`, `volunteer_profiles`, `users`
- [ ] Rate limiter enabled (app-level 100 req/min per user + Cloud Armor 600 req/min per IP)
- [ ] HTTPS redirect + HSTS header in FastAPI middleware
- [ ] PII fields (`beneficiary_name`, `beneficiary_phone`) encrypted with pgcrypto; key from Secret Manager
- [ ] Logs scrubbed of PII using `safe_log()` helper
- [ ] SendGrid webhook signature verified in handler
- [ ] SendGrid sender domain has SPF + DKIM + DMARC records
- [ ] `/admin/*` routes require `role=admin`
- [ ] `/cron/*` routes verify OIDC token is from `scheduler-invoker` SA
- [ ] Worker Cloud Run services deployed with `--no-allow-unauthenticated`
- [ ] `DELETE /api/v1/volunteers/me` tested — confirms PII scrubbed, aggregates intact

---

## 🟡 FRONTEND

### Needs List + Review Flow (Day 4)

- [ ] `lib/api/needs.ts` — typed API client for needs endpoints
- [ ] `lib/hooks/use-needs.ts` — TanStack Query hook with filter/pagination support
- [ ] `/needs` page with `NeedsTable` + `NeedsFilters`
- [ ] `components/needs/needs-table.tsx` — filterable, sortable table
- [ ] `components/needs/needs-filters.tsx` — status, urgency, type filters wired to URL params
- [ ] `components/shared/need-type-icon.tsx`
- [ ] `components/shared/deadline-display.tsx` — clock + relative time (date-fns)
- [ ] `components/shared/location-display.tsx` — MapPin + text
- [ ] `/needs/[id]/review` page
- [ ] `components/needs/review-editor.tsx` — editable extraction fields + original side-by-side
- [ ] `components/needs/extraction-diff.tsx` — original vs AI-extracted comparison
- [ ] `components/needs/publish-confirm-dialog.tsx` — full breakdown before publishing
- [ ] `lib/utils/priority.ts` — `time_pressure` + full score preview util

### Priority + Need Detail (Day 5)

- [ ] `components/shared/priority-score-display.tsx` — score + Tooltip breakdown
- [ ] `components/shared/match-score-display.tsx` — match score breakdown Tooltip
- [ ] `/needs/[id]` page — `NeedDetailPanel` + `AssignmentTeamView`
- [ ] `components/needs/need-status-stepper.tsx` — visual status progression bar
- [ ] `components/needs/assignment-team-view.tsx` — all volunteers assigned to a need
- [ ] Priority breakdown bars inside PriorityScoreCard
- [ ] Wire `GET /needs/{id}/explain` on tooltip hover

### Volunteer UX (Day 6)

- [ ] `/volunteers/register` multi-step form (4 steps: skills, location, availability, preferences)
  - Step 1: `step-skills.tsx` — multi-select skills picker
  - Step 2: `step-location.tsx` — Leaflet map location picker
  - Step 3: `step-availability.tsx` — availability slot builder
  - Step 4: `step-preferences.tsx` — notification prefs + language
- [ ] `lib/firebase/firestore.ts` — Firebase Firestore client init
- [ ] `lib/hooks/use-realtime-assignment.ts` — Firestore listener for assignment status
- [ ] `/assignments` page — `AssignmentList` + `AssignmentCard`
- [ ] `components/assignments/assignment-list.tsx`
- [ ] `components/assignments/assignment-card.tsx`
- [ ] `components/assignments/deadline-countdown.tsx` — live countdown timer
- [ ] `components/assignments/accept-decline-buttons.tsx` — CTA block
- [ ] `/assignments/[id]` page — full detail with actions
- [ ] `components/assignments/assignment-detail.tsx`
- [ ] `components/assignments/completion-form.tsx` — status update + photo upload
- [ ] `components/shared/photo-upload-button.tsx` — signs URL with `purpose=completion`
- [ ] Role-filter the sidebar nav (coordinator vs volunteer vs admin items)

### Realtime + Notifications (Day 7)

- [ ] `lib/hooks/use-coordinator-feed.ts` — Firestore listener on `/coordinator_feed/{org_id}/feed`
- [ ] `lib/hooks/use-realtime-need.ts` — Firestore listener on `/needs_realtime/{need_id}`
- [ ] Wire Firestore status into `NeedDetailPanel` (live status updates without polling)
- [ ] `components/dashboard/activity-feed.tsx` — recent events list from Firestore
- [ ] `components/notifications/notification-bell.tsx` — bell icon with unread count badge
- [ ] `/notifications` page + `components/notifications/notification-item.tsx`
- [ ] `lib/api/notifications.ts` — typed client for notifications endpoints
- [ ] Wire `POST /notifications/{id}/read` on item click
- [ ] Toast notifications on accept/decline/status update (sonner)

### Dashboard + Reports (Day 8)

- [ ] `lib/api/analytics.ts` + `lib/hooks/use-analytics.ts`
- [ ] `/dashboard` page fully wired to real API data
- [ ] `components/dashboard/stat-card.tsx` + `components/dashboard/stats-row.tsx`
- [ ] `components/dashboard/needs-heatmap.tsx` — Leaflet + react-leaflet, SSR-safe (dynamic import)
- [ ] `components/dashboard/critical-needs-alert.tsx` — banner for unassigned critical needs
- [ ] `/reports` page + `components/reports/report-card.tsx`
- [ ] PDF download flow — open signed GCS URL in new tab

### Admin + Volunteer Profile (Day 9)

- [ ] `/admin/volunteers` page — volunteer management list
- [ ] `/admin/volunteers/[id]` page — volunteer detail + verify button
- [ ] `/volunteers/me` edit profile page
- [ ] `components/volunteers/availability-manager.tsx` — view/add/remove time slots
- [ ] `components/volunteers/skills-editor.tsx` — add/remove skill tags
- [ ] `components/volunteers/reliability-score-display.tsx` — score + history tooltip
- [ ] Settings page — language switcher wired to `PATCH /volunteers/me` + cookie

### Polish + i18n (Day 10)

- [ ] Skeleton loaders on every data-fetching page
- [ ] Loading states on every mutation button (disable + spinner)
- [ ] Error boundaries on all pages
- [ ] Persist `NeedsFilters` to URL params (`useSearchParams`)
- [ ] `messages/hi.json` — Hindi translation strings
- [ ] `messages/gu.json` — Gujarati translation strings
- [ ] Wire `next-intl` provider with locale switching
- [ ] Desktop layout review at 1280px and 1440px
- [ ] Tablet layout: collapsed sidebar → Sheet nav at <1024px
- [ ] Accessibility pass: alt text, aria-labels, form labels, focus rings
- [ ] Clipboard paste for images in SubmissionForm

---

## 🟢 INFRA / DEVOPS

### GCP Setup (verify / complete)

- [ ] Confirm Pub/Sub topics created: `need.submitted`, `need.published`, `assignment.created`, `task.completed`
- [ ] Confirm DLQ configured per topic (dead-letter after 3 retries)
- [ ] Confirm Cloud Run services deployed for all 4 workers (ingestion, matching, notification, reports) with `--no-allow-unauthenticated`
- [ ] Confirm `scheduler-invoker` service account created with Cloud Run Invoker IAM role
- [ ] Cloud Scheduler job: hourly → `POST /cron/escalate`
- [ ] Cloud Scheduler job: Mon 06:00 IST → `POST /cron/weekly-report`
- [ ] Budget alert configured at $50/month (50%/75%/100% email alerts)
- [ ] Vertex AI per-hour call counter in ingestion worker with budget circuit-breaker
- [ ] Cloud Monitoring dashboard: request rate, error rate, p95 latency, Pub/Sub backlog, DLQ depth, Cloud SQL CPU, Vertex AI token usage
- [ ] Alert policy: DLQ depth > 0 → immediate alert
- [ ] Alert policy: core-api p95 latency > 2s for 5min → alert

### CI/CD

- [ ] GitHub Actions deploy workflow: test → build → push to Artifact Registry → Cloud Run deploy → run Alembic migration job
- [ ] Confirm Workload Identity Federation configured (no long-lived service account keys in CI)
- [ ] All secrets in Secret Manager; CI pulls at deploy time (not stored in GitHub Secrets)

---

## 🔵 DEMO PREP (Day 11)

- [ ] Seed 20 test volunteers with varied skills, locations, languages
- [ ] Seed 10 test needs (mix of urgencies and team sizes, pre-published)
- [ ] Firebase Auth: create 1 coordinator account, 1 admin account, 2 volunteer accounts
- [ ] Verify SendGrid sender identity; test email sends end-to-end
- [ ] Seed at least 1 week of historical data so weekly report has content
- [ ] Pre-generate weekly PDF report for a historical week
- [ ] Run full happy-path E2E: submission → AI extraction → coordinator review → publish → matching → assignment email → volunteer accept → in_progress → complete
- [ ] Record screen demo as fallback (internet can fail on stage):
  - PriorityScore tooltip with full breakdown
  - MatchScore tooltip
  - Team-of-3 assignment flow
- [ ] Gemini eval: 50 sample submissions → target >80% accuracy on need_type, urgency, location; 0% PII leakage
- [ ] All Pub/Sub DLQs empty before recording
- [ ] Architecture diagram in slide deck
- [ ] Final mobile/tablet layout check
- [ ] Tag release: `git tag v0.1.0-demo` after final prod deploy
- [ ] Deploy sequence: run tests → staging migrations → staging deploy → smoke test → prod deploy → smoke test → tag

---

## 📊 STATUS SUMMARY

| Area | Status |
|---|---|
| Docker / DB / Alembic / models | ✅ Done |
| Firebase auth (frontend + backend) | ✅ Done |
| Core API auth + volunteer + submissions endpoints | ✅ Done |
| Frontend login / shell / submission form | ✅ Done |
| Volunteer self-registration (signup flow) | ✅ Done |
| Frontend — all app pages built | ✅ Done |
| Pub/Sub + ingestion worker (Gemini + embeddings) | ❌ Missing |
| Uploads signed-URL endpoint | ❌ Missing |
| Needs review + publish endpoints | ❌ Missing |
| Priority scoring | ❌ Missing |
| Matching worker | ❌ Missing |
| Volunteer assignment endpoints | ❌ Missing |
| Realtime Firestore sync from backend | ❌ Missing |
| Escalation cron | ❌ Missing |
| Notification worker + SendGrid | ❌ Missing |
| Analytics + reports endpoints | ❌ Missing |
| Reports worker + PDF | ❌ Missing |
| Frontend realtime hooks (Firestore listeners) | ❌ Missing |
| i18n (hi + gu) | ❌ Missing |
| Security hardening checklist | ❌ Missing |
| Demo seed data + E2E test | ❌ Missing |