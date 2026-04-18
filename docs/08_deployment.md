# 08 — Deployment Guide

## 1. GCP Project Setup (One-Time, ~30 min)

### 1.1 Create project + enable APIs
```bash
export PROJECT_ID="nectaid-prod"
export REGION="asia-south1"

gcloud projects create $PROJECT_ID --name="Nectaid"
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ID

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

**APIs we explicitly do NOT enable:** `documentai`, `bigquery`, `datastream`, `cloudtasks`, `fcm`. Keeps the dependency surface small. See [`02_tech_stack.md §"What We're NOT Using"`](./02_tech_stack.md).

### 1.2 Service accounts
```bash
# Per-service SA for least-privilege
gcloud iam service-accounts create core-api --display-name="Core API"
gcloud iam service-accounts create ingestion-worker
gcloud iam service-accounts create matching-worker
gcloud iam service-accounts create notification-worker
gcloud iam service-accounts create reports-worker
gcloud iam service-accounts create pubsub-invoker  # used by Pub/Sub to call Cloud Run workers
gcloud iam service-accounts create scheduler-invoker  # used by Cloud Scheduler to call /cron/* endpoints

# Grant roles (example for core-api)
SA="core-api@$PROJECT_ID.iam.gserviceaccount.com"
for role in \
  roles/cloudsql.client \
  roles/datastore.user \
  roles/storage.objectAdmin \
  roles/pubsub.publisher \
  roles/secretmanager.secretAccessor \
  roles/aiplatform.user
do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA" --role=$role
done

# Matching worker needs to re-publish need.published (for escalation re-match)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:matching-worker@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/pubsub.publisher
```

### 1.3 Cloud SQL (Postgres + PostGIS + pgvector)
```bash
gcloud sql instances create nectaid-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-type=SSD \
  --database-flags=cloudsql.enable_pgvector=on

gcloud sql databases create nectaid --instance=nectaid-db
gcloud sql users create nectaid \
  --instance=nectaid-db --password=$(openssl rand -base64 24)

# Connect and enable extensions
gcloud sql connect nectaid-db --user=nectaid --database=nectaid
# Then at the psql prompt:
#   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
#   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
#   CREATE EXTENSION IF NOT EXISTS "postgis";
#   CREATE EXTENSION IF NOT EXISTS "vector";
```

Cloud SQL on GCP supports both PostGIS and pgvector in the same instance — you do not need a custom image. The `--database-flags=cloudsql.enable_pgvector=on` flag is required to allow `CREATE EXTENSION vector`.

### 1.4 Firestore
```bash
gcloud firestore databases create --location=$REGION --type=firestore-native
```

### 1.5 GCS buckets
```bash
gsutil mb -l $REGION -p $PROJECT_ID gs://nectaid-prod-uploads
gsutil mb -l $REGION -p $PROJECT_ID gs://nectaid-prod-reports
gsutil mb -l $REGION -p $PROJECT_ID gs://nectaid-prod-backups

gsutil uniformbucketlevelaccess set on gs://nectaid-prod-uploads
gsutil versioning set on gs://nectaid-prod-uploads

# Lifecycle: move submission uploads to Nearline after 30 days
cat > /tmp/lifecycle.json <<EOF
{ "rule": [ { "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
              "condition": {"age": 30, "matchesPrefix": ["submissions/"]} } ] }
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://nectaid-prod-uploads
```

### 1.6 Pub/Sub topics & subscriptions
```bash
# Topics we actually use. (We dropped need.extracted — status transitions happen
# inline during the handler, and Firestore sync is via sync_firestore() helper.)
for topic in need.submitted need.published assignment.created task.completed; do
  gcloud pubsub topics create $topic
  gcloud pubsub topics create ${topic}.dlq  # dead-letter queue
done

# Push subscriptions are created AFTER worker Cloud Run deploys below, because
# the push-endpoint URL is only known post-deploy.
```

### 1.7 Artifact Registry
```bash
gcloud artifacts repositories create nectaid \
  --repository-format=docker --location=$REGION
```

### 1.8 Secrets
```bash
printf "%s" "postgresql+asyncpg://nectaid:PASS@/nectaid?host=/cloudsql/$PROJECT_ID:$REGION:nectaid-db" \
  | gcloud secrets create DATABASE_URL --data-file=-

printf "%s" "$(cat firebase-service-account.json)" \
  | gcloud secrets create FIREBASE_SA --data-file=-

printf "%s" "SG.xxxxx.yyyyyyyyy" \
  | gcloud secrets create SENDGRID_API_KEY --data-file=-  # from SendGrid dashboard: Settings → API Keys

# SendGrid webhook verification public key (from Settings → Mail Settings → Signed Event Webhook)
printf "%s" "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..." \
  | gcloud secrets create SENDGRID_WEBHOOK_PUBLIC_KEY --data-file=-

# 32-byte key for pgcrypto PII column encryption
openssl rand -hex 32 | gcloud secrets create PII_KEY --data-file=-
```

### 1.9 SendGrid Setup (do on Day 1 — DNS can take hours to propagate)

1. Sign up at https://sendgrid.com/ (free tier: 100 emails/day forever)
2. **Verify a single sender** for demos (fastest path, under 5 minutes):
   - Settings → Sender Authentication → Verify a Single Sender
   - Enter a reply-to address you control (e.g., `notifications@yourdomain.org` or even your personal Gmail for demo)
   - Click the confirmation email
3. **(Production) Domain authentication** — better deliverability, required if you own a domain:
   - Settings → Sender Authentication → Authenticate Your Domain
   - SendGrid gives you three CNAME records to add to DNS
   - After DNS propagates (minutes to hours), click "Verify"
4. **Create an API key**: Settings → API Keys → Create API Key → "Restricted Access" → enable only "Mail Send" and "Email Webhook" scopes. Copy the key into `SENDGRID_API_KEY` secret above.
5. **Enable Signed Event Webhook**: Settings → Mail Settings → Signed Event Webhook → toggle on. Copy the "Verification Key" (PEM-encoded ED25519 public key) into `SENDGRID_WEBHOOK_PUBLIC_KEY` secret above. Set the HTTP Post URL to `https://<core-api-url>/webhooks/sendgrid` once the service is deployed.
6. **Publish DMARC record** (production, recommended): Add `_dmarc.yourdomain.org TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.org"`. Keeps your emails out of spam folders.

## 2. Docker Images

### 2.1 Backend Dockerfile (FastAPI)
```dockerfile
# services/core-api/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "2", "-b", "0.0.0.0:8080", "app.main:app"]
```

### 2.2 Frontend Dockerfile (Next.js)
```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
CMD ["node", "server.js"]
```

### 2.3 Local-dev Postgres image (pgvector + PostGIS in one)
The stock `postgis/postgis:16-3.4` image does NOT include pgvector, and the stock `pgvector/pgvector:pg16` image does NOT include PostGIS. For local dev, we need both, so build a small custom image:

```dockerfile
# infra/postgres-dev/Dockerfile
FROM pgvector/pgvector:pg16

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-postgis-3 postgresql-16-postgis-3-scripts \
 && rm -rf /var/lib/apt/lists/*
```

This image is used by `docker-compose.yml` (see §10). Cloud SQL in production does not need this — it supports both extensions natively.

## 3. Cloud Run Deploy

Example for `core-api`:
```bash
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/nectaid/core-api:$(git rev-parse --short HEAD)"

gcloud builds submit --tag $IMAGE services/core-api

gcloud run deploy core-api \
  --image $IMAGE \
  --region $REGION \
  --service-account core-api@$PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances $PROJECT_ID:$REGION:nectaid-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,FIREBASE_SA=FIREBASE_SA:latest,PII_KEY=PII_KEY:latest \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION,GCS_UPLOADS_BUCKET=nectaid-prod-uploads \
  --min-instances=0 --max-instances=5 --concurrency=80 --cpu=1 --memory=512Mi \
  --allow-unauthenticated \
  --ingress=all
```

Workers are deployed similarly but with `--no-allow-unauthenticated` and invoked via Pub/Sub push:
```bash
# Example for ingestion-worker
gcloud run deploy ingestion-worker \
  --image $IMAGE_WORKER \
  --region $REGION \
  --service-account ingestion-worker@$PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances $PROJECT_ID:$REGION:nectaid-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION \
  --no-allow-unauthenticated

# Grant Pub/Sub the invoker role for this service
gcloud run services add-iam-policy-binding ingestion-worker \
  --region $REGION \
  --member=serviceAccount:pubsub-invoker@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.invoker

# Create push subscription with dead-letter
gcloud pubsub subscriptions create ingestion-worker-sub \
  --topic=need.submitted \
  --push-endpoint=$(gcloud run services describe ingestion-worker --region $REGION --format 'value(status.url)')/handle \
  --push-auth-service-account=pubsub-invoker@$PROJECT_ID.iam.gserviceaccount.com \
  --ack-deadline=60 --message-retention-duration=7d \
  --dead-letter-topic=need.submitted.dlq \
  --max-delivery-attempts=5
```

Repeat for `matching-worker` (subscribes to `need.published`) and `reports-worker` (no subscription — triggered by Cloud Scheduler).

For **`notification-worker`**, add the SendGrid secrets to its deploy command:
```bash
gcloud run deploy notification-worker \
  --image $IMAGE_WORKER \
  --region $REGION \
  --service-account notification-worker@$PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances $PROJECT_ID:$REGION:nectaid-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,SENDGRID_API_KEY=SENDGRID_API_KEY:latest \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION,FROM_EMAIL=notifications@yourdomain.org,FROM_NAME=Nectaid \
  --no-allow-unauthenticated

# core-api also needs SENDGRID_WEBHOOK_PUBLIC_KEY to verify incoming /webhooks/sendgrid events
# (add SENDGRID_WEBHOOK_PUBLIC_KEY=SENDGRID_WEBHOOK_PUBLIC_KEY:latest to the core-api --set-secrets list above)
```

## 4. Cloud Scheduler Cron Jobs

We use Cloud Scheduler for *all* scheduled/delayed work. (No Cloud Tasks — Pub/Sub retries + Scheduler sweeps cover everything we need.)

```bash
# Get core-api URL
CORE_API_URL=$(gcloud run services describe core-api --region $REGION --format 'value(status.url)')

# Every 15 min: escalate stale pending_accept assignments, re-match if need under-assigned
gcloud scheduler jobs create http escalate-stale \
  --location=$REGION \
  --schedule="*/15 * * * *" \
  --uri="$CORE_API_URL/cron/escalate-stale" \
  --http-method=POST \
  --oidc-service-account-email=scheduler-invoker@$PROJECT_ID.iam.gserviceaccount.com \
  --oidc-token-audience="$CORE_API_URL"

# Weekly Monday 06:00 IST = 00:30 UTC: generate weekly reports
gcloud scheduler jobs create http weekly-reports \
  --location=$REGION \
  --schedule="30 0 * * 1" \
  --time-zone="Asia/Kolkata" \
  --uri="$(gcloud run services describe reports-worker --region $REGION --format 'value(status.url)')/run" \
  --http-method=POST \
  --oidc-service-account-email=scheduler-invoker@$PROJECT_ID.iam.gserviceaccount.com
```

Grant the scheduler invoker permission to hit core-api's `/cron/*` routes (core-api should internally check that requests to `/cron/*` carry a valid OIDC token from the scheduler SA):
```bash
gcloud run services add-iam-policy-binding core-api \
  --region $REGION \
  --member="serviceAccount:scheduler-invoker@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/run.invoker
```

## 5. Database Migrations

Use Alembic for schema changes. Run as a Cloud Run Job on every deploy:
```bash
gcloud run jobs create db-migrate \
  --image $IMAGE \
  --region $REGION \
  --service-account core-api@$PROJECT_ID.iam.gserviceaccount.com \
  --set-cloudsql-instances $PROJECT_ID:$REGION:nectaid-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --command alembic,upgrade,head

gcloud run jobs execute db-migrate --region $REGION --wait
```

## 6. GitHub Actions CI/CD

`.github/workflows/deploy.yml`:
```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  backend:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider
          service_account: deployer@${{ secrets.GCP_PROJECT }}.iam.gserviceaccount.com
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build & deploy core-api
        run: |
          IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/nectaid/core-api:${{ github.sha }}
          gcloud builds submit --tag $IMAGE services/core-api
          gcloud run deploy core-api --image $IMAGE --region $REGION --quiet
          gcloud run jobs execute db-migrate --region $REGION --wait
        env:
          PROJECT_ID: ${{ secrets.GCP_PROJECT }}
          REGION: asia-south1
```

## 7. Domain & HTTPS

- Register a domain OR use free `run.app` for MVP
- For custom domain: `gcloud beta run domain-mappings create --service=core-api --domain=api.nectaid.org --region=$REGION`
- Cloud Run provisions managed SSL automatically

## 8. Monitoring & Alerts

```bash
# Example: alert when p95 latency > 2s
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="core-api p95 latency high" \
  --condition-display-name="p95 > 2s for 5m" \
  --condition-threshold-value=2000 \
  --condition-threshold-duration=300s
```

Dashboard widgets worth creating: request rate, error rate, p95 latency, Pub/Sub backlog per topic, Pub/Sub DLQ depth (should stay 0), Cloud SQL CPU, Vertex AI token usage.

## 9. Cost Controls

- **Budget alert**: $50/month total with 50%/75%/100% email alerts
- **Cloud Run** min-instances = 0 for all services during MVP
- **Cloud SQL**: `db-f1-micro` is ~$9/month
- **Vertex AI**: implement a per-hour call counter in the ingestion worker; short-circuit with a clear error if it exceeds the budget ceiling
- **Pub/Sub DLQ alerts**: alert if any DLQ has depth > 0 — it means something is failing silently

## 10. Local Development (Docker Compose)

```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    build:
      context: ./infra/postgres-dev  # custom image: pgvector + postgis
    environment:
      POSTGRES_USER: nectaid
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: nectaid
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nectaid"]
      interval: 5s
      timeout: 3s
      retries: 10

  db-init:
    image: postgres:16
    depends_on:
      db: { condition: service_healthy }
    command: >
      psql -h db -U nectaid -d nectaid -c "
        CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
        CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
        CREATE EXTENSION IF NOT EXISTS postgis;
        CREATE EXTENSION IF NOT EXISTS vector;"
    environment:
      PGPASSWORD: dev

  api:
    build: ./services/core-api
    environment:
      DATABASE_URL: postgresql+asyncpg://nectaid:dev@db/nectaid
      PROJECT_ID: nectaid-dev
      PII_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
    ports: ["8080:8080"]
    depends_on:
      db-init: { condition: service_completed_successfully }

  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080
    ports: ["3000:8080"]
    depends_on: [api]

volumes:
  pgdata:
```

## 11. Rollback Plan

- Cloud Run keeps previous revisions automatically
- `gcloud run services update-traffic core-api --to-revisions=PREV=100 --region=$REGION`
- Database: Alembic `downgrade -1` + point-in-time recovery if needed

## 12. Demo-Day Checklist

- [ ] All services deployed and reachable on `*.run.app`
- [ ] Seed data: 20 test volunteers with varied skills + 10 test needs (mix of urgencies and team sizes)
- [ ] Firebase Auth configured with test accounts (1 coordinator, 1 admin, 2 volunteers)
- [ ] SendGrid sender identity verified; test email sends successfully end-to-end
- [ ] At least one week's worth of historical data seeded so the weekly report has content
- [ ] Weekly report PDF generated for a historical week (pre-seeded)
- [ ] Demo video recorded as fallback (internet can fail on stage)
- [ ] Architecture diagram printed + in slide deck
- [ ] Priority-breakdown tooltip visible and working in UI
- [ ] All Pub/Sub DLQs empty before recording the demo
