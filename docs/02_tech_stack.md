# 02 — Tech Stack (Detailed)

## Frontend

### Base
- **Next.js 15** (App Router) + **React 19** + **TypeScript 5.4+**
- **TailwindCSS 4** + **shadcn/ui** (Radix primitives) — accessible components out of the box
- **TanStack Query (React Query) v5** — server state management
- **Zod** — runtime validation on form inputs
- **react-hook-form** — forms with minimal re-renders

### No PWA / No Offline
We explicitly are NOT building a PWA for MVP. No service worker, no Workbox, no Dexie, no IndexedDB queue. Coordinators work at desks with stable internet; volunteers use email. No user needs offline capability. See README §1 for the rationale.

### Realtime
- **Firebase SDK** (client) — `firebase/auth`, `firebase/firestore` for realtime listeners on the mirror collections

### i18n
- **`next-intl`** — bundled translations for `en`, `hi`, `gu`
- RTL not needed for MVP

### Maps
- **Leaflet** + **OpenStreetMap tiles** (free) — avoids Google Maps billing for the heatmap

### Frontend `package.json` skeleton
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.4.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "tailwindcss": "^4.0.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.400.0",
    "next-intl": "^3.17.0",
    "firebase": "^10.12.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "date-fns": "^3.6.0"
  }
}
```

## Backend

### Base
- **Python 3.12**
- **FastAPI 0.110+** — async, OpenAPI auto-gen
- **Pydantic v2** — validation and serialization
- **SQLAlchemy 2.x** (async) — ORM
- **Alembic** — migrations
- **Uvicorn + Gunicorn** — ASGI server
- **`asyncpg`** — Postgres async driver

### Google Cloud SDKs
- **`google-cloud-aiplatform`** — Vertex AI (Gemini + embeddings)
- **`google-cloud-firestore`**
- **`google-cloud-storage`**
- **`google-cloud-pubsub`**
- **`google-cloud-secret-manager`**
- **`firebase-admin`** — token verification

We removed: `google-cloud-tasks` (not needed — Pub/Sub + Cloud Scheduler cover our timer needs), `google-cloud-documentai` (not needed — Gemini handles forms).

### Utilities
- **`pgvector`** (Python) — pgvector type for SQLAlchemy
- **`GeoAlchemy2`** — PostGIS types
- **`scipy`** — for Hungarian algorithm (`scipy.optimize.linear_sum_assignment`)
- **`loguru`** — structured logs
- **`opentelemetry-instrumentation-fastapi`** — tracing
- **`tenacity`** — retries
- **`httpx`** — async HTTP client for outbound webhooks and SendGrid API
- **`sendgrid`** — official SendGrid Python SDK for transactional email
- **`weasyprint`** — PDF reports

### Backend `requirements.txt` skeleton
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
gunicorn==22.0.0
pydantic==2.9.0
pydantic-settings==2.5.0
sqlalchemy[asyncio]==2.0.30
alembic==1.13.0
asyncpg==0.29.0
pgvector==0.3.0
geoalchemy2==0.15.0
scipy==1.14.0
firebase-admin==6.5.0
google-cloud-aiplatform==1.70.0
google-cloud-firestore==2.18.0
google-cloud-storage==2.18.0
google-cloud-pubsub==2.25.0
google-cloud-secret-manager==2.20.0
loguru==0.7.2
opentelemetry-instrumentation-fastapi==0.47b0
tenacity==8.5.0
httpx==0.27.0
sendgrid==6.11.0
weasyprint==62.3
python-multipart==0.0.9
```

## Database Extensions (Postgres)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";
```

**Important:** The stock `postgis/postgis:16-3.4` Docker image does NOT include pgvector. For local development, use the `pgvector/pgvector:pg16` image and install PostGIS on top, OR build a custom Dockerfile (see [`08_deployment.md §10`](./08_deployment.md)). On Cloud SQL, both extensions are available via `cloudsql.enable_pgvector` and PostGIS flags — no custom image needed.

## Infra / DevOps

- **Docker** + multi-stage builds for all services
- **GitHub Actions** → `gcloud` CLI → Cloud Run
- **Cloud Scheduler** for cron (no Cloud Tasks)
- **Terraform** (recommended after MVP) — reproducible infra

## Dev Tooling

- **`ruff`** + **`black`** — Python lint + format
- **`mypy`** — type checks
- **`pytest`** + **`pytest-asyncio`** — tests
- **`eslint`** + **`prettier`** — JS/TS
- **`husky`** + **`lint-staged`** — pre-commit hooks

## Third-Party Integrations

| Service | Purpose | Free Tier / Cost |
|---|---|---|
| Firebase Auth | Email/password + Google sign-in | Free up to 50k MAU |
| SendGrid | Transactional email (assignment notifications, reminders, rating requests) | Free tier: 100 emails/day forever |
| Sentry (optional) | Error tracking | Free dev tier |

## Recommended VS Code Extensions

- Python, Pylance, Ruff
- ESLint, Prettier, Tailwind CSS IntelliSense
- Thunder Client (API testing)
- GitLens
- Error Lens

## Why Not Alternatives?

| Rejected | Why Not |
|---|---|
| Node.js backend | Python ecosystem for AI is superior; Vertex AI SDK is best in Python |
| Django | Heavier, ORM less async-friendly than SQLAlchemy 2.0 |
| MongoDB | We need geospatial + vector + relational joins; Postgres does all three |
| OpenAI API | Google Cloud credits cover Vertex AI; avoids multi-vendor billing |
| Supabase | Firebase + Cloud SQL already cover auth + DB |
| Kubernetes (GKE) | Overkill for MVP. Cloud Run is sufficient and cheaper |
| Separate vector DB (Pinecone/Weaviate) | pgvector is good enough for <100k vectors |
| **BigQuery + Datastream CDC** | Overkill at MVP scale; Postgres aggregates are instant for <10k rows |
| **Document AI** | Gemini 2.5 Flash handles forms well enough; two LLMs for one job is noise |
| **PWA / service workers** | Coordinators work at desks with stable internet; no real user needs offline capability |
| **FCM push** | No mobile app → no native push needed. Email covers the volunteer notification use case. |
| **WhatsApp Business Cloud API** | Meta verification delays, per-message costs since July 2025, webhook HMAC complexity. For 11 days, integration risk without proportional user value. Email + in-app inbox is cleaner. |
| **Twilio SMS** | Paid per-message channel; was originally a fallback to WhatsApp. Email covers the use case for free on SendGrid's tier. |
| **Cloud Tasks** | Pub/Sub retries + Cloud Scheduler cron cover our timer needs |
| **Amazon SES** | Requires more DNS setup than SendGrid; no meaningful cost advantage at MVP scale |
