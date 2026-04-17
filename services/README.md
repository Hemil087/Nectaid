# Services

## core-api
FastAPI REST API — all synchronous endpoints, auth middleware, Postgres via SQLAlchemy async.

## workers
Background Pub/Sub subscribers:
- **ingestion** — AI extraction via Vertex AI / Gemini
- **matching** — volunteer matching + team formation
- **notification** — SendGrid email sender
- **reports** — weekly PDF generator (WeasyPrint)
