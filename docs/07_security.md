# 07 — Security & Privacy

## Threat Model (STRIDE Summary)

| Threat | Example | Mitigation |
|---|---|---|
| **Spoofing** | Attacker pretends to be a coordinator | Firebase ID token verification; role via custom claims set server-side only; row-level ownership checks |
| **Tampering** | Modified need data in transit | HTTPS-only; backend re-validates every field server-side with Pydantic |
| **Repudiation** | Coordinator denies editing a need | Append-only `audit_log` with before/after JSON; actor set via `SET LOCAL app.current_user` before every mutation |
| **Information Disclosure** | Beneficiary PII leaks | Column-level encryption (pgcrypto); signed GCS URLs with short TTL; no PII in logs |
| **Denial of Service** | Spam webhook; brute force login | ED25519 signature verification on SendGrid webhook; Cloud Armor + per-user rate limits; Firebase Auth's built-in throttling |
| **Elevation of Privilege** | Volunteer accesses coordinator-only endpoints | FastAPI role dependency on every route; row-level ownership check inside the handler |

## Authentication

### Firebase Authentication

- **Email/password** (all user types: coordinators, volunteers, admins)
- **Google sign-in** (optional; same Firebase Auth endpoint)

Roles stored as **custom claims** on the Firebase user, set via a Cloud Function or admin endpoint after signup + admin approval:
```javascript
await admin.auth().setCustomUserClaims(uid, { role: 'volunteer' });
```

Critical: the frontend MUST NEVER set claims. Claims are set only by backend code running with admin credentials. If you let clients mutate claims, you've lost your entire authz model.

### Server-Side Verification

Every API request:
```python
from firebase_admin import auth

async def get_current_user(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    try:
        decoded = auth.verify_id_token(token, check_revoked=True)
    except Exception:
        raise HTTPException(401, "invalid_token")
    user = await db.get_user_by_firebase_uid(decoded["uid"])
    if user is None or user.deleted_at is not None:
        raise HTTPException(401, "user_not_found")
    return user
```

Role check:
```python
def require_role(*roles):
    def dep(user=Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(403, "forbidden")
        return user
    return dep

@router.post("/needs/{id}/publish")
async def publish(id: UUID, user=Depends(require_role("coordinator","admin"))):
    ...
```

Row-level ownership check:
```python
# Volunteer can only read their own assignments
assignment = await db.get_assignment(id)
if user.role == "volunteer" and assignment.volunteer_id != user.id:
    raise HTTPException(403, "forbidden")
```

### Internal (Worker / Cron) Requests

Workers are Cloud Run services marked `--no-allow-unauthenticated`. Pub/Sub and Cloud Scheduler invoke them using OIDC tokens; Cloud Run enforces IAM before the request ever reaches the handler.

For `/cron/*` routes on `core-api` (which is public), the handler itself must verify the OIDC token's service account matches `scheduler-invoker@...`. See [`08_deployment.md §4`](./08_deployment.md).

## Transport Security

- All endpoints HTTPS-only (Cloud Run default + redirect)
- HSTS header: `max-age=31536000; includeSubDomains; preload`
- CSP, X-Frame-Options, X-Content-Type-Options set via FastAPI middleware

## Input Validation

- **Pydantic v2** models on every request body; strict mode on (`model_config = ConfigDict(extra='forbid')`)
- File uploads: MIME type check + size cap (5 MB per image, 10 MB for PDFs)
- String fields bounded (`max_length` on every text field)
- SQL: **only parameterized queries via SQLAlchemy** — no string concatenation
- AI responses validated against Pydantic schema; schema mismatch → reject + log + retry once, dead-letter if still failing

## PII Handling

| PII Field | Storage | Access |
|---|---|---|
| Beneficiary name | `pgcrypto` encrypted column | Coordinator, admin only |
| Beneficiary phone | `pgcrypto` encrypted column | Coordinator only |
| Volunteer email | Plain (used for auth + email notifications) | Self, admin only |
| Volunteer phone (optional) | Plain | Self, admin only |
| Uploaded images | GCS, bucket-private | Signed URL, 15-min TTL |

Example `pgcrypto` usage:
```sql
-- Encrypt on write (backend passes the key from Secret Manager)
INSERT INTO beneficiaries (name_encrypted)
VALUES (pgp_sym_encrypt('Rajesh Kumar', current_setting('app.pii_key')));

-- Decrypt on read
SELECT pgp_sym_decrypt(name_encrypted, current_setting('app.pii_key')) FROM beneficiaries;
```

Backend sets the key once per connection via `SET LOCAL app.pii_key = <secret>;` pulled from Secret Manager.

## Logging (No PII)

Structured JSON logs stripped of PII:
```python
PII_FIELDS = {"phone", "name", "email", "aadhaar", "address", "beneficiary_name"}

def safe_log(payload):
    return {k: ("***" if k in PII_FIELDS else v) for k, v in payload.items()}
```

User identifiers in logs use **hashed user IDs** (`sha256(user.id + salt)[:12]`). Raw UUIDs stay in the database and audit log only.

## Rate Limiting & Abuse

- **Cloud Armor** rate-limit policy: 600 req/min per IP
- **Per-user rate limit** in application: 100 req/min (in-memory sliding window is fine for MVP; move to Redis if we scale to multiple API replicas)
- **SendGrid event webhook**: verified via SendGrid's ED25519 signature scheme. SendGrid signs every event payload with its private key; we verify using the public key stored in Secret Manager as `SENDGRID_WEBHOOK_PUBLIC_KEY`:

```python
from ecdsa import VerifyingKey, BadSignatureError
from ecdsa.util import sigdecode_der
import base64

def verify_sendgrid(signature_b64: str, timestamp: str, raw_body: bytes, public_key_pem: str) -> bool:
    try:
        vk = VerifyingKey.from_pem(public_key_pem)
        signature = base64.b64decode(signature_b64)
        payload = timestamp.encode() + raw_body
        vk.verify(signature, payload, sigdecode=sigdecode_der)
        return True
    except BadSignatureError:
        return False
```

Reject any webhook request whose signature doesn't match. Do NOT log the raw body on failure (it may contain recipient email addresses).

- **Email-link anti-abuse**: assignment deep links (`/assignments/{id}`) require an authenticated session. There are NO magic-link accept tokens — a volunteer must log in with email/password first, then the one-tap "Accept" button works. This prevents link-leakage attacks (e.g., a volunteer forwards their email) from granting someone else the ability to accept on their behalf.

## Secrets Management

Never in code, `.env` files checked into git, or CI env vars. Secret Manager stores:
- DB connection string (`DATABASE_URL`)
- Firebase service account JSON (`FIREBASE_SA`)
- SendGrid API key (`SENDGRID_API_KEY`)
- SendGrid webhook verification public key (`SENDGRID_WEBHOOK_PUBLIC_KEY`)
- PII encryption key (`PII_KEY`)

Cloud Run services mount secrets as env vars via IAM binding to the service account.

## Audit Log

Triggers on mutations of sensitive tables:
```sql
CREATE TRIGGER trg_audit_needs
AFTER INSERT OR UPDATE OR DELETE ON needs
FOR EACH ROW EXECUTE FUNCTION audit_row_change('needs');
```

The `audit_row_change()` function writes a row to `audit_log` with actor, action, and JSON diff. Actor comes from `SET LOCAL app.current_user = '<uuid>';` issued by the backend before any mutation.

Install the triggers on: `needs`, `assignments`, `volunteer_profiles`, `users`.

## DPDP Act (India) Compliance

- **Consent:** captured at registration and at beneficiary-data entry. UI shows purpose in plain Hindi/Gujarati/English.
- **Purpose limitation:** data only used for volunteer coordination and anonymized analytics.
- **Data minimization:** only required fields collected. **No Aadhaar stored.**
- **Right to erasure:** `DELETE /api/v1/volunteers/me` — soft-deletes + scrubs PII (replaces name/phone/email with nulls, keeps anonymous aggregates for reporting integrity). See [`04_api_specification.md`](./04_api_specification.md).
- **Notification of processing:** privacy policy linked from every screen; shown in full at signup.
- **Data residency:** `asia-south1` (Mumbai) region for all compute and storage.

## OWASP Top 10 Coverage Checklist

- [x] A01 Broken Access Control → role check + ownership check on every route
- [x] A02 Cryptographic Failures → TLS in transit; pgcrypto at rest for PII
- [x] A03 Injection → parameterized queries; no raw SQL; Pydantic validation
- [x] A04 Insecure Design → threat model reviewed (this doc)
- [x] A05 Security Misconfiguration → CSP, HSTS, no default creds, Secret Manager for all secrets
- [x] A06 Vulnerable Components → Dependabot enabled; pinned versions; monthly review
- [x] A07 Authentication Failures → Firebase Auth, no custom password store
- [x] A08 Software and Data Integrity → signed container images in Artifact Registry
- [x] A09 Logging Failures → structured logs, PII-stripped, Cloud Logging retention
- [x] A10 SSRF → no user-provided URL fetching server-side; webhook handlers only accept allowlisted origins

## Prompt Injection Defense (AI-specific)

User-supplied text goes only in `user` messages, never in the system prompt. AI output is schema-validated against a strict Pydantic model. A secondary scan checks extracted fields for injection-pattern strings (`"ignore previous"`, `"system:"`, etc.) and flags for manual review. See [`05_ai_pipeline.md §7`](./05_ai_pipeline.md) for code.

## Incident Response (MVP)

Minimum viable runbook:
1. **Suspected breach** → rotate Firebase service account + SendGrid API key via Secret Manager. Force-invalidate all sessions with `auth.revoke_refresh_tokens()`.
2. **DB compromise** → point-in-time restore to pre-incident timestamp; rotate PII encryption key and re-encrypt in a batch job.
3. **SendGrid outage** → notifications queue up in the `notifications` table (status=`queued`); volunteers see assignments on next login via in-app inbox. Backfill emails after SendGrid recovers by replaying queued rows.
4. **Spam/phishing of our sender domain** → rotate SendGrid API key, re-verify sender, publish DMARC record, alert admin.
5. **Abuse** → admin endpoint `POST /admin/users/{id}/suspend` sets `deleted_at`.

## Security Checklist Before Submission

- [ ] Every route has `Depends(require_role(...))` or explicit "public" annotation
- [ ] Every multipart upload validates MIME + size
- [ ] Secrets are only in Secret Manager — not in git, not in env files, not in CI secrets (CI pulls them from Secret Manager on deploy)
- [ ] GCS bucket has uniform access + no public objects
- [ ] Cloud SQL has no authorized public networks; connects only via Cloud SQL Connector
- [ ] Audit log triggers installed on `needs`, `assignments`, `volunteer_profiles`, `users`
- [ ] Rate limiter enabled (app-level + Cloud Armor)
- [ ] HTTPS redirect + HSTS header in middleware
- [ ] PII fields encrypted with pgcrypto; `PII_KEY` pulled from Secret Manager
- [ ] Logs scrubbed of PII (verified by grepping recent logs for email-pattern strings)
- [ ] SendGrid event webhook signature verified (tested with both valid and invalid signatures)
- [ ] SendGrid sender domain has SPF + DKIM + DMARC records published
- [ ] `/admin/*` routes require `role=admin`
- [ ] `/cron/*` routes verify OIDC token is from `scheduler-invoker` SA
- [ ] Worker Cloud Run services are `--no-allow-unauthenticated`
- [ ] `DELETE /api/v1/volunteers/me` tested — confirms PII is scrubbed while aggregates remain
