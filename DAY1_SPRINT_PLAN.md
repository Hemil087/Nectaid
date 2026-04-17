# Day 1 Sprint Plan: Project Setup & GitHub Push

**Date:** April 17, 2026 (Thursday)  
**Duration:** 8 hours  
**Team Size:** 3-5 people  
**Goal:** Everyone can `git clone`, `docker compose up`, and see a working local environment by end of day

---

## Pre-Sprint Checklist (Team Lead Only - 1 hour)

### Task 1.0: GCP Project & Credentials
**Owner:** DevOps lead  
**Duration:** 30 min  
**Deliverable:** Project ID, billing enabled, free credits claimed

```bash
export PROJECT_ID="nectaid-prod"
export REGION="asia-south1"

gcloud projects create $PROJECT_ID --name="Nectaid"
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ID
```

**Exit Criteria:** `gcloud config get-value project` returns `nectaid-prod`

### Task 1.1: Enable APIs (All at Once)
**Duration:** 5 min (actual) + 10 min (propagation wait)

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com
```

**Exit Criteria:** All 12 APIs show "Enabled" in console

### Task 1.2: Create Firebase Project
**Duration:** 15 min  
1. Go to https://console.firebase.google.com
2. Add project → select existing GCP project `nectaid-prod`
3. Authentication → Sign-in method → Enable Email/Password + Google
4. Project Settings → Service Accounts → Generate new private key
5. Save as `firebase-service-account.json` (gitignored — NEVER commit)

---

## Sprint Tasks

### Task 2.1: Backend Scaffold ✅ (Done in setup)
FastAPI app running on port 8080 with health endpoint.

### Task 2.2: Frontend Scaffold
**Owner:** Frontend lead  
**Duration:** 2 hours

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
npm install @tanstack/react-query zod react-hook-form @hookform/resolvers \
  next-intl firebase leaflet react-leaflet date-fns lucide-react clsx
```

Add to `next.config.js`:
```javascript
const nextConfig = { output: 'standalone' }
module.exports = nextConfig
```

**Exit Criteria:** `npm run dev` shows Next.js on localhost:3000

### Task 2.3: Database Setup ✅ (Done in setup)
Custom Postgres image with pgvector + PostGIS, docker-compose configured.

### Task 2.4: Database Schema (Alembic)
**Owner:** Backend lead  
**Duration:** 1.5 hours

```bash
# Inside running API container:
docker compose exec api alembic init alembic
# Edit alembic.ini: set sqlalchemy.url
docker compose exec api alembic revision -m "initial_schema"
# Paste schema from docs/03_database_schema.md into the migration
docker compose exec api alembic upgrade head
```

**Exit Criteria:** `alembic upgrade head` runs, all tables visible via `\dt`

### Task 2.5: CI/CD ✅ (Done in setup)
GitHub Actions workflow in `.github/workflows/ci.yml`

---

## End-of-Day Checklist

- [ ] `docker compose up --build` — all services healthy
- [ ] `curl http://localhost:8080/health` returns `{"status":"ok",...}`
- [ ] `docker compose exec db psql -U nectaid -c '\dx'` shows 4 extensions
- [ ] Push to `dev` branch, CI passes
- [ ] No secrets in git: `git log --all --oneline` shows no .env files

---

## Troubleshooting

**"pgvector extension not found"** — using stock postgres image; ensure docker-compose uses `build: ./infra/postgres-dev`  
**"Port 5432 already in use"** — change to `5433:5432` in docker-compose.yml  
**"CI fails missing deps"** — check npm ci / pip install steps in workflow
