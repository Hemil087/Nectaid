# Day 1 Sprint Plan: Project Setup & GitHub Push

**Date:** April 17, 2026 (Thursday)
**Status:** ✅ COMPLETED

---

## What Was Actually Done

### GCP & Firebase
- GCP project created, billing linked, free credits claimed
- 12 APIs enabled (run.googleapis.com, aiplatform.googleapis.com, etc.)
- Firebase project created, Email/Password auth enabled
- `firebase-service-account.json` generated and gitignored

### Backend
- FastAPI scaffold in `services/core-api/app/`
- `requirements.txt` with all dependencies including `psycopg2-binary` for Alembic
- SQLAlchemy 2.0 async models written for all 9 tables:
  - `orgs`, `users`, `volunteer_profiles`, `availability_slots`
  - `raw_submissions`, `needs`, `assignments`
  - `notifications`, `audit_log`
- Alembic initialized and configured:
  - `alembic.ini` points to `postgresql+psycopg2://` (sync, for migrations)
  - `alembic/env.py` imports all models via `Base.metadata`
  - `alembic/versions/` is volume-mounted so migration files persist on host
- Initial migration generated and applied — all tables created in DB

### Database
- Custom Postgres image built from `infra/postgres-dev/Dockerfile`
  - Based on `pgvector/pgvector:pg16` with PostGIS installed on top
  - `init.sql` enables: `uuid-ossp`, `pgcrypto`, `postgis`, `vector`
- `docker-compose.yml` has two services: `db` and `api`
  - `db` waits for healthcheck before `api` starts
  - `alembic/` directory volume-mounted into api container

### Frontend
- Next.js 15 scaffold in `apps/web/`
- Tailwind CSS v4 configured (CSS-first, no `tailwind.config.js`)
- Not in docker-compose yet — runs via `npm run dev` locally

### CI/CD
- GitHub Actions workflow stubbed in `.github/workflows/`

---

## Key Decisions Made

| Decision | Reason |
|---|---|
| Alembic uses `psycopg2` not `asyncpg` | Alembic is sync; app runtime uses asyncpg |
| `COPY . .` in Dockerfile (not just `app/`) | Alembic needs `alembic.ini` and `alembic/` inside the container |
| `alembic/` volume-mounted in docker-compose | Migration files generated in container appear on host and get committed |
| `ivfflat lists=10` not 100 | `lists=100` requires 300+ rows minimum; will increase post-MVP |
| Frontend not dockerized yet | No need until staging deploy; runs fine with `npm run dev` |

---

## To Onboard a New Team Member

```bash
git clone https://github.com/Hemil087/Nectaid.git
cd Nectaid
cp services/core-api/.env.example services/core-api/.env.local
cp apps/web/.env.example apps/web/.env.local
docker compose up --build
# In second terminal:
docker compose exec api sh -c "alembic upgrade head"
```

That's it. All tables will be created automatically.

---

## Do NOT Do These

- Do NOT run `alembic init` — already done
- Do NOT run `alembic revision --autogenerate` unless you've changed models
- Do NOT edit migration files inside the container — edit on host, they sync via volume mount
- Do NOT use `winpty` with `docker compose exec` unless the command needs a TTY
- Do NOT use Git Bash path syntax (`/app/...`) directly in docker exec — use `sh -c "..."` wrapper