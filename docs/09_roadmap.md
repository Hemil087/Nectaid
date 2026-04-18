# 09 — 11-Day Implementation Roadmap

**Deadline:** April 28, 2026, 23:59 IST
**Start:** April 17, 2026
**Team size assumed:** 3–5 members
**Platform:** Desktop web app only (no PWA, no mobile app)

## What We're Building vs. What We Are NOT Building

Before reading the day-by-day, internalize the scope lines:

**In scope (P0):** Desktop web app for coordinators/admins + volunteer web views. FastAPI backend. Gemini extraction. pgvector matching. Coordinator web-form ingestion + SendGrid email notifications. Postgres-only analytics with a weekly PDF report.

**Out of scope (explicitly dropped):** PWA / service workers / offline queue. Mobile app. WhatsApp Business API. Twilio SMS. Firebase Cloud Messaging (no native push). BigQuery / Datastream CDC. Document AI. Cloud Tasks. Audio ingestion.

See [`02_tech_stack.md §"What We're NOT Using"`](./02_tech_stack.md) for why each was dropped.

---

## Daily Breakdown (with exit criteria)

### Day 1 — Thursday, April 17
**Theme: Set up everything that takes waiting**

- [ ] Create GCP project; claim free credits
- [ ] Create Firebase project, link to GCP
- [ ] Create Cloud SQL Postgres 16 instance with `cloudsql.enable_pgvector=on` and PostGIS flags — *takes ~10 min, do first*
- [ ] Enable extensions: `uuid-ossp`, `pgcrypto`, `postgis`, `vector`
- [ ] Create GCS buckets, Artifact Registry, Pub/Sub topics (see [`08_deployment.md`](./08_deployment.md))
- [ ] Sign up for SendGrid free tier and verify sender identity (~15 min — DNS propagation for domain auth can take hours, so do this early)
- [ ] Create GitHub repo with folders: `services/core-api`, `services/workers`, `apps/web`, `infra`
- [ ] Write Dockerfiles, `docker-compose.yml` (with custom Postgres image that has both pgvector + postgis), basic CI skeleton
- [ ] Draft Alembic initial migration from [schema doc](./03_database_schema.md)
- [ ] Team: decide roles (backend/AI, frontend, data/DevOps, UX+demo)

**Exit:** Everyone can run `docker compose up` locally, hit `/health`, and `psql` shows `vector` + `postgis` extensions both enabled. SendGrid dashboard shows verified sender.

### Day 2 — Friday, April 18
**Theme: Auth + minimal CRUD**

- [ ] Firebase Auth wired in Next.js (email/password for all user types — coordinators, volunteers, admins)
- [ ] Firebase Admin SDK in FastAPI; `get_current_user` and `require_role()` dependencies working
- [ ] Seed 2 test accounts (1 coordinator, 1 volunteer) + 1 test org
- [ ] Implement: `POST /volunteers`, `GET /volunteers/me`, `GET /auth/me`, `DELETE /volunteers/me`
- [ ] Implement: `GET /needs` (returns empty list), `POST /submissions` (stores raw only, server sets `source='webform'`)
- [ ] Frontend skeleton: login screen + role-specific landing page
- [ ] Deploy API to Cloud Run (staging), frontend to Cloud Run (staging)

**Exit:** Login in browser → see role-specific landing page. Submit a text-only submission from the coordinator UI, it lands in `raw_submissions` table with `source='webform'`.

### Day 3 — Saturday, April 19
**Theme: AI extraction happy path**

- [ ] Pub/Sub topic `need.submitted` + push subscription to `ingestion-worker`
- [ ] `ingestion-worker` Cloud Run service (not public)
- [ ] Wire Gemini 2.5 Flash with structured output + JSON schema
- [ ] Pydantic `NeedExtraction` model + schema validation
- [ ] Generate embedding via `text-embedding-004`, store in `needs.embedding`
- [ ] Store extracted `needs` row in `pending_review` state
- [ ] Write `coordinator_feed` entry in Firestore via `sync_firestore()` helper
- [ ] Frontend: pending-review list for coordinators (read-only)
- [ ] Quick Gemini eval: 10 realistic sample submissions (mixed languages, text + photo) → check extraction outputs

**Exit:** Coordinator submits an image + caption via webform → ~10–15 seconds later sees the extracted need in the pending-review list, with the original text side-by-side.

### Day 4 — Sunday, April 20
**Theme: Review → Publish flow**

- [ ] `PATCH /needs/{id}` — coordinator edit (only allowed while status is `pending_review`)
- [ ] `POST /needs/{id}/publish` → emits `need.published` event
- [ ] Frontend: need-review screen with editable fields side-by-side with original submission + image thumbnails
- [ ] `GET /needs` with filters (status, urgency, need_type, near_lat/lng/radius_km)
- [ ] Audit log trigger on `needs` table
- [ ] `GET /needs/{id}/explain` returns priority breakdown (even if scoring not fully wired yet)

**Exit:** Coordinator can review, edit, and publish a need. Published needs appear in the main feed.

### Day 5 — Monday, April 21
**Theme: Priority Scoring + Matching**

- [ ] Implement `compute_priority()` + store breakdown JSONB on publish
- [ ] `time_pressure` computed on read (not persisted) — return it in API responses
- [ ] `matching-worker` Cloud Run service, subscribed to `need.published`
- [ ] Implement candidate SQL (PostGIS + pgvector + `availability_slots` JOIN + not-double-booked with `COALESCE(completed_at, 'infinity')` + not-previously-declined)
- [ ] Implement `match_score()` ranking in Python
- [ ] Implement greedy team formation; Hungarian fallback
- [ ] Insert `assignments` with `pending_accept` status + `accept_deadline = now() + 15min`
- [ ] Transition `needs.status` to `matching_complete` on successful matching
- [ ] Frontend: priority score tooltip showing breakdown
- [ ] Frontend: volunteer dashboard showing their pending assignments

**Exit:** Publishing a need auto-creates assignments. Priority score and match score both visible with breakdown on hover. A coordinator can see "2 of 2 volunteers assigned" state.

### Day 6 — Tuesday, April 22
**Theme: Volunteer lifecycle end-to-end**

- [ ] Volunteer onboarding form: skills, location picker (Leaflet), availability (recurring slots), notification prefs
- [ ] Skills embedding generated on registration/update
- [ ] `GET /volunteers/me/assignments` with need details
- [ ] Accept/decline endpoints + UI; acceptance transitions `needs.status` to `assigned` when all roles accepted
- [ ] Status update (`in_progress` → `completed`) with photo upload via signed URL
- [ ] Photo upload flow: frontend calls `POST /uploads/signed-url` with `purpose='completion'`, uploads directly to GCS, then submits the key in the status-update call
- [ ] Coordinator rating screen after completion
- [ ] Reliability score update on completion (EMA)

**Exit:** A volunteer can see an assignment → accept → mark in progress → complete with photo → coordinator rates them → reliability score updates.

### Day 7 — Wednesday, April 23
**Theme: Realtime UI + Escalation**

- [ ] Firestore listeners on frontend: `/coordinator_feed/{uid}/feed`, `/task_status/{assignment_id}`
- [ ] Backend `sync_firestore()` helper called from every status-mutating handler
- [ ] Cloud Scheduler cron hitting `POST /cron/escalate-stale` (internal, OIDC-authed) every 15 minutes
- [ ] Escalation endpoint: finds `pending_accept` assignments past deadline, marks them `expired`, re-emits `need.published` for under-assigned needs, tracks prior-attempted volunteers via `assignments` table query
- [ ] Cloud Scheduler cron hitting `POST /cron/reliability-decay` (weekly) — optional
- [ ] Frontend: toast + badge when new events arrive via Firestore listener (no page refresh needed)

**Exit:** Coordinator dashboard updates live when a volunteer accepts/declines. A declined assignment triggers re-match to the next candidate within 15 min, visible without refresh.

### Day 8 — Thursday, April 24
**Theme: Email notifications + intake polish**

- [ ] `notification-worker` Cloud Run service, subscribed to `assignment.created`
- [ ] SendGrid SDK integrated; sender identity verified and DNS records applied in production
- [ ] Email templates (rendered via Jinja2, plain-text + HTML multipart):
  - "You have a new assignment" — sent on `assignment.created` with need title, urgency, location, accept deadline, deep link to `/assignments/{id}`
  - "Reminder: assignment pending" — sent 10 minutes before `accept_deadline` if still `pending_accept`
  - "Task completed — please rate" — sent to coordinator when assignment status moves to `completed`
- [ ] All email links deep-link into the app; volunteer must be logged in to accept/decline (no magic-link tokens for MVP)
- [ ] i18n: email subject + body localized in Hindi/Gujarati/English based on volunteer's `preferred_language`
- [ ] Coordinator submission form polish: drag-and-drop for up to 5 images, paste-from-clipboard for images, preview thumbnails, live character count on the text field
- [ ] In-app notification row written alongside every email send (so `/notifications` endpoint reflects delivery regardless of email state)
- [ ] SendGrid webhook subscribed (`delivered`, `bounced`, `spam_report`) → updates `notifications.status` in Postgres

**Exit:** Matched volunteer gets an email in their preferred language with a working deep link. Clicks the link → login → one-tap accept → assignment moves to `accepted` → need moves to `assigned`. Coordinator sees live status flip in the dashboard.

### Day 9 — Friday, April 25
**Theme: Analytics dashboard + Weekly reports**

- [ ] `GET /analytics/dashboard` — direct Postgres aggregate queries:
  - open needs count, critical needs count, pending review count
  - active volunteers (last 30 days)
  - avg response time (minutes to first accept)
  - beneficiaries served this week
  - heatmap (group by geohash-6)
- [ ] Coordinator dashboard UI: cards + Leaflet heatmap + recent-activity list
- [ ] `reports-worker` Cloud Run service + Cloud Scheduler (weekly Mon 06:00 IST)
- [ ] Weekly report: Postgres aggregate SQL → Gemini narrative → Jinja2 HTML → WeasyPrint PDF → upload to GCS
- [ ] `GET /reports/weekly.pdf` returns signed URL (15-min TTL)
- [ ] Seed 2 weeks of historical data so the report actually has content for the demo

**Exit:** Dashboard shows real metrics from live data. Trigger the weekly report manually via admin endpoint → PDF appears in GCS → coordinator downloads it → it looks publishable.

### Day 10 — Saturday, April 26
**Theme: i18n + Polish**

- [ ] i18n strings for Hindi + Gujarati on all coordinator/volunteer screens via `next-intl`
- [ ] Language switcher in user settings
- [ ] Desktop layout audit: sidebars, data tables, responsive breakpoints down to tablet (~768px)
- [ ] Loading skeletons on all data-fetching pages
- [ ] Toast notifications for success/error states
- [ ] Empty states for every list (e.g., "No needs pending review — nice work")
- [ ] React error boundaries
- [ ] All server errors return the standard error envelope + get logged with request_id
- [ ] Accessibility pass: alt text on images, aria-labels, keyboard nav, color contrast AA
- [ ] Gemini extraction eval on 50 samples; document accuracy numbers in README

**Exit:** App is usable in Hindi/Gujarati. Every screen has a proper loading state and empty state. Eval numbers ready to cite in the demo.

### Day 11 — Sunday, April 27
**Theme: Demo prep + final deploy**

- [ ] End-to-end test with seed data: 20 volunteers (varied skills + locations), 10 needs (varied urgency + team sizes)
- [ ] Final deploy to prod Cloud Run project
- [ ] Smoke test every flow: coordinator login → web-form submission → AI extraction → review → publish → match → volunteer email received → login → accept → status update → rating → weekly report
- [ ] Record demo video: 4–5 min showing happy path + one decline → re-match
- [ ] Finalize project deck (use the mandatory template)
- [ ] README finalized, GitHub repo public
- [ ] Memorize the 3 demo talking points per rubric criterion (see below)
- [ ] Backup demo video uploaded somewhere reachable from the demo laptop (internet can fail on stage)

**Exit:** Deck done, video recorded, live prototype working, submission draft ready to hit "send."

### April 28 — Submission Day (before 23:59 IST)

- [ ] Final review of deck and prototype link in an incognito window (catches "it works on my machine" bugs)
- [ ] Submit: problem statement, solution overview, prototype link, project deck, GitHub URL, demo video
- [ ] Celebrate regardless of outcome; you shipped

---

## Scope Ladder (cut from bottom if behind)

If Day 5 ends without matching working end-to-end, cut in this order:

**Cut first (P2):**
1. Hungarian algorithm fallback (keep greedy only — will still work for most demo cases)
2. Reliability-score EMA update (hard-code to 0.5 for all volunteers in demo)
3. Email i18n (English-only emails, UI still translated)
4. SendGrid delivery webhook (notifications stay in `queued` state; not demo-critical)
5. Reminder email 10 min before deadline (send only the initial assignment email)
6. Weekly report PDF (show an HTML report instead; screenshot for slides)

**Cut next (P1):**
7. Hindi/Gujarati i18n in the UI (English-only demo, call it out honestly in the deck)
8. Heatmap on dashboard (show the aggregate cards only)
9. Coordinator feed realtime (require page refresh)
10. Admin verification flow (auto-verify all volunteers in demo)

**Never cut (P0 — core demo):**
- Auth + role-based access
- Web-form ingestion with images
- Gemini extraction with schema validation
- Review/publish
- Priority scoring with breakdown tooltip
- 1:1 matching (team formation can degrade to 1:1 if greedy fails)
- Email notification on assignment
- Accept/decline flow
- Status updates
- Desktop-responsive UI
- README + deck + demo video

---

## Team Allocation

### 5 people
| Role | Owns |
|---|---|
| **Backend/AI Lead** | FastAPI, Vertex AI integration, priority scoring, matching worker, ingestion worker |
| **Frontend Lead** | Next.js, Firestore listeners, i18n, desktop-responsive layouts, coordinator submission form UX |
| **Data/DevOps** | DB schema + migrations, Cloud Run deploys, CI/CD, observability, Cloud Scheduler crons |
| **Integrations + Notifications** | SendGrid integration, email templates (multilingual), notification worker, in-app inbox |
| **UX + Demo Director** | Design reviews, demo script, video, deck, README, accessibility, eval set construction |

### 3 people (tight)
- **Backend/AI + Integrations** = 1 person
- **Frontend + UX + Demo** = 1 person
- **Data/DevOps + reports + i18n** = 1 person

In either setup, the UX/Demo role is not optional. A technically-correct project with a bad demo loses to a scrappier project with a polished demo.

---

## Demo-Day Talking Points (memorize these)

### Technical Merit (40%)
1. "We use Vertex AI in **three distinct ways**, each with a justified purpose — Gemini 2.5 Flash for multimodal multilingual extraction with schema-validated JSON output, `text-embedding-004` for cross-lingual semantic matching in pgvector, and Gemini again for the weekly report narrative. We deliberately did not add Document AI or a separate vector DB — one LLM vendor, one database, less to break."
2. "Priority scoring is **deterministic and auditable** — here's the breakdown tooltip. When judges ask 'why does this need score 78.4 and not 77?' we can show them the exact formula, inputs, and weights. No LLM is in the scoring loop."
3. "Matching uses **PostGIS + pgvector + availability + prior-attempt filtering in a single SQL query**, then applies a weighted Python scorer. Team formation runs greedy skill-coverage first, falls back to the Hungarian algorithm when greedy can't cover all required skills. All in one Postgres — no separate vector DB, no separate warehouse."

### Alignment with Cause (25%)
1. "We built this for the reality of NGO field operations — field workers phone HQ with what they've seen; coordinators at desks do the paperwork. We upgrade the intake process from paper logbooks to an AI-assisted dashboard. We don't try to replace how field comms actually happen."
2. "Every AI-extracted need goes through a coordinator review queue before going live. AI isn't infallible — publishing a wrong beneficiary count or wrong village name would destroy trust. Human-in-the-loop is not optional in social work."
3. "Weekly impact reports show real operational metrics — beneficiaries served, median time-to-accept by urgency, volunteer-hours by region — not vanity numbers. Aimed at NGO leadership who report upwards to funders."

### Innovation & Creativity (25%)
1. "Multimodal multilingual extraction: the coordinator uploads a photo of a handwritten Gujarati survey and types a one-line note — Gemini 2.5 Flash returns a fully structured, translated, priority-scored need in under 15 seconds, with strict JSON schema validation. Shows real AI integration, not just an LLM wrapper."
2. "Cross-lingual semantic matching: a need described in Hindi ('बच्चों के डॉक्टर चाहिए') matches a volunteer profile listed as 'Pediatrician' in English, because we match on embedding similarity, not keywords. This only works because we put both into vector space."
3. "We form **teams**, not just 1:1 assignments. A need requiring 'doctor + nurse + translator' gets three matched volunteers assembled in one pass, with the Hungarian algorithm guaranteeing optimal coverage when greedy heuristics can't."

### User Experience (10%)
1. "Desktop-first design because that's where coordinators actually work. Clean data-dense layouts — no cramped mobile compromises."
2. "Every coordinator action has a confirmation — publishing a need shows the full extracted data and priority breakdown before sending it out. Errors are recoverable; every change is audit-logged."
3. "Volunteers get clean professional email notifications in their preferred language — Hindi, Gujarati, or English — with one-click deep link to the accept screen. No SMS spam, no unfamiliar app to install."

Rehearse the demo live at least twice before submission day. Time it — if it's over 5 minutes you're losing the judges.
