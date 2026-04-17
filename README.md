# Nectaid

A data-driven volunteer coordination platform that turns scattered NGO field reports into prioritized, assigned action. Where community needs meet volunteer skills.

## Quick Start (Local Dev)

### Prerequisites
- Docker Desktop
- Node.js 20+
- Python 3.12+
- Git

### Setup
```bash
# Clone repo
git clone https://github.com/Hemil087/Nectaid.git
cd Nectaid

# Start all services
docker compose up --build

# In another terminal, run migrations
docker compose exec api alembic upgrade head

# Visit:
# - API docs: http://localhost:8080/api/v1/docs
# - Web:      http://localhost:3000
```

### Project Structure
```
nectaid/
├── services/
│   ├── core-api/          # FastAPI REST API
│   └── workers/           # Background Pub/Sub workers
├── apps/
│   └── web/               # Next.js 15 frontend
├── infra/
│   ├── postgres-dev/      # Custom DB image (pgvector + PostGIS)
│   └── terraform/         # IaC (post-MVP)
├── docs/                  # Detailed specs
├── .github/workflows/     # CI/CD
└── docker-compose.yml     # Local dev orchestration
```

### Environment Variables

Create `services/core-api/.env.local` (copy from `.env.example`):
```bash
DATABASE_URL=postgresql+asyncpg://nectaid:dev_password_change_in_prod@localhost:5432/nectaid
PROJECT_ID=nectaid-dev
REGION=asia-south1
```

Create `apps/web/.env.local` (copy from `.env.example`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

> **NEVER commit `.env.local` files to git.**

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Python 3.12, SQLAlchemy async |
| Database | PostgreSQL 16 + pgvector + PostGIS |
| Auth | Firebase Authentication |
| AI | Vertex AI / Gemini |
| Infra | GCP Cloud Run, Cloud Storage, Pub/Sub |
| Email | SendGrid |

### Next Steps
- See [GUARDRAILS.md](./GUARDRAILS.md) for development rules
- See [DAY1_SPRINT_PLAN.md](./DAY1_SPRINT_PLAN.md) for setup tasks
- See [docs/](./docs/) for detailed specs
