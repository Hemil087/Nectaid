# 06 — Matching Algorithm & Priority Scoring

This is the part judges will dig into hardest. Be ready to defend every number.

## Part 1: Priority Scoring (Deterministic, Explainable)

### Formula
```
priority_score = W_u × urgency_value
               + W_s × severity_value
               + W_b × beneficiary_value
               + W_t × time_pressure_value
               − W_r × resource_difficulty_value
```

Weights (tunable via admin config, defaults shown):

| Symbol | Meaning | Default Weight |
|---|---|---|
| W_u | urgency | 40 |
| W_s | severity | 25 |
| W_b | beneficiary scale | 20 |
| W_t | time pressure | 10 |
| W_r | resource difficulty penalty | 5 |

### Component definitions

**urgency_value**
```
critical → 1.0
high     → 0.7
medium   → 0.4
low      → 0.1
```

**severity_value** (derived from need_type + subcategory)
```python
SEVERITY = {
    "medical": {"emergency": 1.0, "preventive": 0.5, "default": 0.7},
    "food":    {"famine": 1.0, "supplemental": 0.4, "default": 0.6},
    "shelter": {"post-disaster": 1.0, "default": 0.6},
    "education": {"dropout-prevention": 0.6, "default": 0.4},
    "wash":     {"outbreak": 0.9, "default": 0.5},
    "livelihood": {"default": 0.3},
    "other":    {"default": 0.3},
}
```

**beneficiary_value** = `log10(1 + beneficiary_count) / log10(1001)`
Normalizes up to 1.0 at ~1000 beneficiaries; prevents extreme values from swamping.

**time_pressure_value** — **computed on read, not persisted**
```python
def time_pressure(deadline):
    if deadline is None:
        return 0.1
    hours_left = (deadline - datetime.utcnow()).total_seconds() / 3600
    if hours_left <= 24: return 1.0
    if hours_left <= 72: return 0.7
    if hours_left <= 168: return 0.4  # 1 week
    return 0.1
```

**resource_difficulty_value** (penalty term)
```python
RARITY = {
    "pediatrician": 0.9, "surgeon": 0.95, "psychiatrist": 0.9,
    "physiotherapist": 0.6, "general-doctor": 0.4, "nurse": 0.3,
    "teacher-math": 0.5, "teacher-english": 0.4, "volunteer-general": 0.1,
    # ...
}
difficulty = sum(RARITY.get(skill, 0.3) for skill in required_skills) / max(1, len(required_skills))
```

### Output & Persistence

We persist the **stable** components (urgency, severity, beneficiary, resource) to `needs.priority_score` and `needs.priority_breakdown`. We do NOT persist `time_pressure` — it's recomputed every time the API returns the need. This means no cron job is needed to keep scores fresh.

```python
class PriorityBreakdown(BaseModel):
    urgency_component: float
    severity_component: float
    beneficiary_component: float
    time_pressure_component: float   # computed fresh on read
    resource_difficulty_component: float
    total: float

def compute_stable_components(need: Need) -> dict:
    """Called once when need is created/updated — stored in DB."""
    return {
        "urgency_component": W_U * URGENCY[need.urgency],
        "severity_component": W_S * severity_for(need.need_type, need.category),
        "beneficiary_component": W_B * beneficiary_value(need.beneficiary_count),
        "resource_difficulty_component": -W_R * resource_difficulty(need.required_skills),
    }

def compute_full_score(need: Need, stored_breakdown: dict) -> PriorityBreakdown:
    """Called on every read — adds fresh time_pressure."""
    t = W_T * time_pressure(need.deadline)
    total = sum(stored_breakdown.values()) + t
    return PriorityBreakdown(
        **stored_breakdown,
        time_pressure_component=t,
        total=total,
    )
```

**Why this matters:** A naive design would require an hourly cron job re-scanning all `published` needs to update scores as deadlines shift. By computing time_pressure on-read, we avoid a background job entirely. The stored `priority_score` is used for coarse ordering (good enough for index scans); the fresh score is returned to the UI.

### Recomputation Triggers (for stable components only)
- On `POST /needs/{id}/publish`
- On any `PATCH /needs/{id}` that changes scoring inputs (urgency, need_type, beneficiary_count, required_skills)

No cron job.

---

## Part 2: Matching Volunteers to Needs

### Two Modes

| Mode | When | Algorithm |
|---|---|---|
| **Single assignment** | `required_team_size == 1` | Top-1 ranked candidate |
| **Team formation** | `required_team_size > 1` OR distinct required_skills | Greedy skill-covering; Hungarian fallback if greedy leaves skills uncovered |

### Phase 1: Hard Filter (single SQL query)

The full SQL is in [`05_ai_pipeline.md §4`](./05_ai_pipeline.md). Key constraints, in order:

1. Volunteer `active = TRUE`, `verified = TRUE`, and `users.deleted_at IS NULL`
2. Within `max_travel_km` radius (PostGIS `ST_DWithin`)
3. **Has a `availability_slots` row overlapping the need's time window** (EXISTS subquery — this JOIN was missing in an earlier draft, now fixed)
4. **Not double-booked** — NOT EXISTS against `assignments` using `tstzrange` with `COALESCE(completed_at, 'infinity'::timestamptz)` for open-ended ranges (NULL handling fixed from earlier draft)
5. **Not previously declined/expired on this specific need** — NOT EXISTS against `assignments` where `need_id=$6 AND status IN ('declined','expired','no_show')`. No separate `attempted_volunteer_ids` column needed — the assignments table is the record.

The query also includes two derived columns for the scoring step:
- `tasks_this_week` — COUNT of recent assignments (for recency_penalty)
- `experience_in_type` — COUNT of completed assignments with same `need_type`

Returns top 50 candidates ordered by cosine distance.

### Phase 2: Scoring (Python)

```python
def match_score(vol, need, distance_km, similarity, tasks_this_week, experience_in_type):
    loc_score = max(0, 1 - (distance_km / vol.max_travel_km))
    recency_penalty = min(tasks_this_week / 5, 1)   # overload protection
    experience_score = min(experience_in_type / 10, 1)
    return (
        0.50 * similarity
      + 0.20 * loc_score
      + 0.15 * vol.reliability_score
      + 0.10 * experience_score
      + 0.05 * (1 - recency_penalty)
    )
```

`tasks_this_week` and `experience_in_type` come from the SQL query (Phase 1), not stored columns.

### Phase 3: Team Formation

#### Single-skill team
When required_skills has just one skill but team_size > 1: just pick top-N by match_score.

#### Multi-skill team (realistic case)
Example: need requires `[pediatrician, nurse, translator-gujarati]`, team_size = 3.

**Greedy with skill coverage constraint:**
```python
def greedy_team(candidates, required_skills, team_size):
    assigned = []
    remaining_skills = list(required_skills)

    for vol in sorted(candidates, key=lambda v: v.match_score, reverse=True):
        if not remaining_skills:
            break
        for skill in remaining_skills:
            if skill in vol.skills:
                assigned.append({"volunteer": vol, "role": skill})
                remaining_skills.remove(skill)
                break

    while len(assigned) < team_size and candidates:
        assigned_ids = {a["volunteer"].user_id for a in assigned}
        next_best = max(
            (c for c in candidates if c.user_id not in assigned_ids),
            key=lambda v: v.match_score,
            default=None
        )
        if next_best is None:
            break
        assigned.append({"volunteer": next_best, "role": "support"})

    coverage_ok = len(remaining_skills) == 0
    return assigned, coverage_ok
```

If greedy fails to cover all required skills → **fall back to Hungarian algorithm**:

```python
from scipy.optimize import linear_sum_assignment
import numpy as np

def hungarian_team(candidates, required_skills):
    # Build cost matrix: rows = required skill slots, cols = candidates
    # Cost = -match_score if candidate has this skill, else large value
    cost = np.full((len(required_skills), len(candidates)), 1e6)
    for i, skill in enumerate(required_skills):
        for j, vol in enumerate(candidates):
            if skill in vol.skills:
                cost[i][j] = -vol.match_score
    row_idx, col_idx = linear_sum_assignment(cost)
    team = []
    for r, c in zip(row_idx, col_idx):
        if cost[r][c] < 1e5:  # valid match
            team.append({"volunteer": candidates[c], "role": required_skills[r]})
    return team
```

### Phase 4: Persist Assignments

```python
async with db.transaction():
    for member in team:
        await db.execute(
            insert(Assignment).values(
                need_id=need.id,
                volunteer_id=member["volunteer"].user_id,
                role_in_team=member["role"],
                match_score=member["volunteer"].match_score,
                match_breakdown={
                    "similarity": member["volunteer"].similarity,
                    "location_score": member["volunteer"].loc_score,
                    "reliability": member["volunteer"].reliability_score,
                    "experience": member["volunteer"].experience_score,
                    "recency_penalty": member["volunteer"].recency_penalty,
                },
                status="pending_accept",
                accept_deadline=datetime.utcnow() + timedelta(minutes=15),
            )
        )
    # Transition need status
    await db.execute(
        update(Need).where(Need.id == need.id).values(status="matching_complete")
    )
    await sync_firestore("needs", need.id)
    for member in team:
        await sync_firestore("assignments", ...)  # one per
await pubsub.publish("assignment.created", {...})
```

### Phase 5: Acceptance & Escalation

**No Cloud Tasks** — we use Cloud Scheduler instead.

- Cloud Scheduler hits `POST /cron/escalate` every hour
- The endpoint finds `pending_accept` assignments past their `accept_deadline`, marks them `expired`
- For any need that still needs more accepted volunteers, it re-publishes `need.published`
- The matching worker re-runs its query, which naturally excludes the previously-expired/declined volunteers (via the NOT EXISTS filter in Phase 1)
- After 3 full matching cycles with no successful team → need is flagged for coordinator manual pick (needs.status stays `published`, coordinator dashboard highlights it)

### Edge Cases Handled

| Case | Handling |
|---|---|
| No candidates match | Need stays `published`, coordinator dashboard shows "no matches — expand radius?" |
| All candidates declined | Notify coordinator; suggest relaxing constraints (radius, verification) |
| Volunteer accepts but doesn't show up | Coordinator marks `no_show`, reliability_score decremented, need re-enters matching |
| Emergency re-prioritization | Coordinator `POST /needs/{id}/cancel` + create new need with higher urgency |

## Part 3: Reliability Score Update

After each task completion (triggered by `POST /assignments/{id}/rate`):
```python
# Exponential moving average
alpha = 0.2
if rating is not None:
    normalized = (rating - 1) / 4  # maps 1..5 → 0..1
    vol.reliability_score = alpha * normalized + (1 - alpha) * vol.reliability_score
elif status == "no_show":
    vol.reliability_score = alpha * 0 + (1 - alpha) * vol.reliability_score
```

Bounded to `[0.05, 1.0]` to keep bad-streak volunteers eligible for eventual redemption.

## Part 4: Demo Talking Points

When you demo matching, show:
1. **The priority breakdown tooltip** — "this need scored 78.4 because..."
2. **The match breakdown tooltip** — "this volunteer scored 0.87 = 0.5×similarity(0.92) + 0.2×loc(0.85) + 0.15×reliability(0.9) + ..."
3. **A team formation case** — one need requiring `[doctor, nurse, translator]` and show three volunteers getting assigned
4. **An escalation** — decline → next candidate via hourly cron (or force-trigger via admin endpoint for the demo)

These four demos directly speak to Technical Merit + Innovation scores.
