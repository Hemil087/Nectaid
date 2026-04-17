# Project Setup Guardrails

## Critical Rules (NEVER VIOLATE)

### 1. Scope Discipline
- **NO PWA, NO service workers, NO offline capability**
  - Rationale: Coordinators work at desks with stable internet
  - If anyone suggests "offline mode," refer them to README §1
  
- **NO WhatsApp Business API, NO Twilio SMS, NO FCM push**
  - Rationale: 11-day timeline, SendGrid email is sufficient
  - Email is the professional channel for professional volunteers
  
- **NO BigQuery, NO Datastream, NO Document AI, NO Cloud Tasks**
  - Rationale: Overengineering for MVP scale
  - Postgres handles everything we need
  
- **NO mobile app development**
  - Rationale: Desktop-first, mobile web browser is enough

### 2. Technology Stack (LOCKED)

#### Frontend (MUST USE)
```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "typescript": "^5.4.0",
  "tailwindcss": "^4.0.0",
  "next-intl": "^3.17.0",
  "@tanstack/react-query": "^5.0.0",
  "firebase": "^10.12.0",
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1"
}
```

#### Backend (MUST USE)
```txt
fastapi==0.115.0
pydantic==2.9.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
pgvector==0.3.0
geoalchemy2==0.15.0
google-cloud-aiplatform==1.70.0
google-cloud-firestore==2.18.0
google-cloud-storage==2.18.0
google-cloud-pubsub==2.25.0
sendgrid==6.11.0
```

**DO NOT add alternatives or "better" libraries without team consensus.**

### 3. Database Schema (IMMUTABLE RULES)

- **Postgres is ALWAYS source of truth**
- **Firestore is ONLY for realtime mirrors** (written by sync_firestore() helper)
- **NEVER store PII in logs**
- **NEVER trust client-supplied `source` field** (server sets it based on endpoint)
- **Every mutation MUST call sync_firestore() after Postgres commit**

### 4. Security (ZERO TOLERANCE)

- **NEVER hard-code secrets in code or .env files in git**
  - All secrets go in Secret Manager
  - Local dev uses .env.local (gitignored)
  
- **NEVER skip Firebase token verification**
  - Every API endpoint (except /health) checks auth
  
- **NEVER allow role self-assignment**
  - Roles set only by admin via Firebase custom claims
  
- **NEVER log PII** (phone, email, name, address)
  - Hash user IDs in logs: `sha256(user.id + salt)[:12]`

### 5. AI Integration (QUALITY GATES)

- **Schema validation REQUIRED on every Gemini response**
  - If validation fails → retry once → dead-letter queue
  
- **Prompt injection defense REQUIRED**
  - User text only in `user` messages
  - Scan extracted fields for suspicious patterns
  
- **Evaluation REQUIRED before demo**
  - 50 sample submissions
  - Target: >80% accuracy on need_type, urgency, location
  - Target: 0% PII leakage

### 6. Git Workflow (ENFORCED)

```
main (protected)
  ↑
dev (integration branch)
  ↑
feature/xxx (individual work)
```

- **NEVER push directly to main**
- **NEVER commit without testing locally first**
- **NEVER commit package-lock.json conflicts** (regenerate it)
- **Conventional Commits REQUIRED:**
  - `feat: add volunteer registration endpoint`
  - `fix: correct availability_slots JOIN in matching query`
  - `docs: update API spec with new endpoint`
  - `refactor: extract sync_firestore into shared module`

### 7. Code Review Checklist (MANDATORY)

Before ANY PR is merged:

- [ ] Runs locally without errors
- [ ] Every new endpoint has `Depends(require_role(...))`
- [ ] PII fields use pgcrypto if stored
- [ ] Secrets pulled from Secret Manager (not env files)
- [ ] Firestore write uses sync_firestore() helper
- [ ] TypeScript has no `any` types (except external lib types)
- [ ] Python passes `mypy --strict`
- [ ] No console.log or print() in production code
- [ ] Loading states and error states on every UI fetch
- [ ] Mobile-responsive (tested at 768px breakpoint minimum)

### 8. Testing Requirements

- **Backend:** pytest with >70% coverage on core logic (not CRUD boilerplate)
- **Frontend:** critical paths only (login, submission, accept/decline)
- **E2E:** 1 full happy-path flow before demo day
- **Load:** NOT REQUIRED for MVP (mention it in "future work")

### 9. Deployment (IMMUTABLE SEQUENCE)

```bash
# NEVER deploy without this sequence
1. Run tests locally
2. Run db migrations in staging
3. Deploy to staging Cloud Run
4. Smoke test in staging (hit /health, login, create 1 submission)
5. If all green → deploy to prod
6. Smoke test in prod
7. Tag release: git tag v0.1.0-demo
```

### 10. "I Think We Should..." Decision Tree

When someone suggests a change:

```
Is it in the original spec? 
  ──▶ YES → Implement it
  ──▶ NO → Is it CRITICAL to demo?
           ──▶ YES → Team vote required (3/5 majority)
           ──▶ NO → Add to "Future Work" doc, don't build it
```

**Examples of things to REJECT:**
- "Let's use GraphQL instead of REST" → NO (too late to change)
- "Let's add a chat feature between volunteers" → NO (out of scope)
- "Let's use OpenAI instead of Vertex AI" → NO (locked into GCP)
- "Let's support 10 languages" → NO (we have 3: en, hi, gu)

## Emergency Stops

If any of these happen, STOP WORK and call a team meeting:

1. **Secret committed to git** → Immediate rotation + force-push history rewrite
2. **Production database corrupted** → Restore from backup, investigate root cause
3. **Google Cloud credits exhausted** → Halt all deployments, audit costs
4. **Team member drops out** → Reassign their tasks via priority ladder (see roadmap §"Cut-Order")
5. **Demo day moved earlier** → Cut from P2 scope immediately

## Daily Standup Structure (10 min MAX)

Each person answers:
1. What I shipped yesterday (merged PRs only)
2. What I'm shipping today (1 concrete deliverable)
3. Blockers (technical only; scheduling = offline)

**NO discussing solutions in standup.** Flag blockers, solve them 1-on-1 after.

## Success Metrics (Check Daily)

- [ ] All CI builds green
- [ ] All team members pushed ≥1 commit in last 24h
- [ ] Local docker-compose up works for everyone
- [ ] Staging deploy is ≤1 day behind main
- [ ] Zero secrets in git history
- [ ] Demo script rehearsed by Day 10

## When to Ask for Help

**Ask Claude/GPT when:**
- Stuck on a specific error for >30 min
- Need to generate boilerplate (Alembic migration, Pydantic model)
- Optimizing a slow SQL query
- Writing test fixtures

**Ask the team when:**
- Unclear on requirements
- API contract ambiguity between frontend/backend
- Need to change something locked in guardrails

**Ask Google Cloud support when:**
- Quota limits hit
- IAM permissions mysteriously failing
- Billing issues

## Forbidden Phrases

These phrases trigger a guardrails review:

- "Let's just quickly add..." → Scope creep detector
- "I found a better way..." → Must justify against locked stack
- "This is too hard, let's simplify..." → Check roadmap cut-order first
- "We don't need tests for this..." → Tests are not optional
- "It works on my machine..." → Fix the docker-compose.yml

## Celebration Milestones

When these happen, take a 15-min break:

- ✅ First end-to-end flow works in local dev
- ✅ First successful Gemini extraction
- ✅ First volunteer accepts an assignment via email
- ✅ First weekly report PDF generated
- ✅ All 5 services deployed to prod
- ✅ Demo video recorded
- ✅ Submission uploaded before deadline

---

**Print this document and put it on the wall. Reference it in EVERY pull request discussion.**
