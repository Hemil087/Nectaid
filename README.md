# Nectaid

A data-driven volunteer coordination platform that turns scattered NGO field reports into prioritized, assigned action.

## Local Development

### Prerequisites

- Docker Desktop
- Node.js 20+
- npm
- Git

### What Runs Where

- `docker compose` starts:
  - `db` - PostgreSQL 16 with `pgvector` and PostGIS
  - `api` - FastAPI backend on `http://localhost:8080`
- The web app runs separately from `apps/web` on `http://localhost:3000`

## Quick Start From Scratch

### 1. Clone the repo

```bash
git clone https://github.com/Hemil087/Nectaid.git
cd Nectaid
```

### 2. Create the frontend env file

```bash
cp apps/web/.env.example apps/web/.env.local
```

The default frontend API URL is:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Start the backend stack

From the repo root:

```bash
docker compose up --build -d
```

This starts:

- PostgreSQL on `localhost:5432`
- FastAPI on `localhost:8080`

### 4. Run database migrations

Once the containers are healthy:

```bash
docker compose exec api sh -c "alembic upgrade head"
```

### 5. Start the frontend

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

### 6. Open the app

- API docs: `http://localhost:8080/api/v1/docs`
- API health: `http://localhost:8080/health`
- Web app: `http://localhost:3000`

## Verify Setup

Check running containers:

```bash
docker compose ps
```

Check the current migration:

```bash
docker compose exec api sh -c "alembic current"
```

List database tables:

```bash
docker compose exec db sh -c "psql -U nectaid -d nectaid -c '\dt'"
```

You should see application tables such as `users`, `orgs`, `volunteer_profiles`, `raw_submissions`, `needs`, `assignments`, `notifications`, and `audit_log`.

## Daily Development Commands

Start existing containers:

```bash
docker compose up -d
```

Stop containers:

```bash
docker compose down
```

Rebuild the backend image after changing `services/core-api/requirements.txt` or `services/core-api/Dockerfile`:

```bash
docker compose build api
docker compose up -d
```

Run migrations after adding a new revision:

```bash
docker compose exec api sh -c "alembic upgrade head"
```

Create a new Alembic migration:

```bash
docker compose exec api sh -c "alembic revision --autogenerate -m 'your_message'"
```

## Environment Variables

### Frontend

`apps/web/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Backend

For Docker-based local development, backend environment variables are currently defined directly in `docker-compose.yml`.

If you run the backend on the host instead of inside Docker, use `services/core-api/.env.example` as your starting point.

Example host-run backend values:

```bash
DATABASE_URL=postgresql+asyncpg://nectaid:dev_password_change_in_prod@localhost:5432/nectaid
PROJECT_ID=nectaid-dev
REGION=asia-south1
```

Never commit `.env.local` files.

## Project Structure

```text
Nectaid/
|- apps/
|  |- web/                  # Next.js 16 frontend
|- docs/                    # Product, API, schema, and architecture docs
|- infra/
|  |- postgres-dev/         # Postgres dev image with pgvector + PostGIS
|- services/
|  |- core-api/
|  |  |- alembic/           # Alembic migrations
|  |  |- app/
|  |  |  |- api/            # Route handlers
|  |  |  |- models/         # SQLAlchemy models
|  |  |  |- services/       # Business logic
|  |  |  |- utils/
|  |  |  |- main.py
|  |  |- alembic.ini
|  |  |- Dockerfile
|  |  |- requirements.txt
|  |- workers/              # Background workers
|- docker-compose.yml
```

## Notes

- Alembic is already initialized. Do not run `alembic init`.
- Migration files live in `services/core-api/alembic/versions/` and should be committed to git.
- `services/core-api/alembic` is bind-mounted into the API container, so new migration files created in the container appear on the host automatically.
- `docker compose up --build` is mainly for first run or rebuilds. Most of the time `docker compose up -d` is enough.

## Troubleshooting

### `alembic upgrade head` fails because Alembic files are missing in the container

Check that `docker-compose.yml` mounts:

```yaml
volumes:
  - ./services/core-api/app:/app/app
  - ./services/core-api/alembic:/app/alembic
```

Then recreate the API container:

```bash
docker compose up -d --force-recreate api
```

### Port `5432` is already in use

Change the DB port mapping in `docker-compose.yml`, for example:

```yaml
ports:
  - "5433:5432"
```

### Backend dependencies changed but the container still uses old packages

Rebuild the API image:

```bash
docker compose build api
docker compose up -d
```

### Git Bash and Docker command quoting are awkward

Use:

```bash
docker compose exec api sh -c "your command here"
```

instead of trying to call complex commands directly.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.x, Alembic |
| Database | PostgreSQL 16, pgvector, PostGIS |
| Auth | Firebase Authentication |
| AI | Vertex AI / Gemini |
| Infra | Docker, GCP Cloud Run, Cloud Storage, Pub/Sub |
| Email | SendGrid |

## Further Reading

- [GUARDRAILS.md](./GUARDRAILS.md)
- [docs/](./docs/)
