"""
Priority scoring service — deterministic, explainable, no AI.

Formula:
    priority = W_u * urgency_value
             + W_s * severity_value
             + W_b * beneficiary_value
             + W_t * time_pressure_value   ← computed on-read, NOT persisted
             - W_r * resource_difficulty_value

Weights are module-level constants — swap them for admin-configurable
values post-MVP if needed.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from app.models.need import Need

# ── Weights ────────────────────────────────────────────────────────────────
W_U = 40.0   # urgency
W_S = 25.0   # severity
W_B = 20.0   # beneficiary scale
W_T = 10.0   # time pressure (read-only, never stored)
W_R = 5.0    # resource difficulty (penalty)

# ── Urgency → normalised value ─────────────────────────────────────────────
URGENCY_VALUE: dict[str, float] = {
    "critical": 1.0,
    "high":     0.7,
    "medium":   0.4,
    "low":      0.1,
}

# ── Severity by need_type + optional category ──────────────────────────────
SEVERITY: dict[str, dict[str, float]] = {
    "medical":     {"emergency": 1.0, "preventive": 0.5, "default": 0.7},
    "food":        {"famine": 1.0, "supplemental": 0.4, "default": 0.6},
    "shelter":     {"post-disaster": 1.0, "default": 0.6},
    "education":   {"dropout-prevention": 0.6, "default": 0.4},
    "wash":        {"outbreak": 0.9, "default": 0.5},
    "livelihood":  {"default": 0.3},
    "other":       {"default": 0.3},
}

# ── Skill rarity (higher = harder to find) ─────────────────────────────────
SKILL_RARITY: dict[str, float] = {
    "surgeon":            0.95,
    "pediatrician":       0.9,
    "psychiatrist":       0.9,
    "physiotherapist":    0.6,
    "general-doctor":     0.4,
    "nurse":              0.3,
    "teacher-math":       0.5,
    "teacher-english":    0.4,
    "teacher-science":    0.5,
    "translator-gujarati": 0.5,
    "translator-hindi":   0.4,
    "carpenter":          0.4,
    "electrician":        0.4,
    "plumber":            0.4,
    "social-worker":      0.3,
    "volunteer-general":  0.1,
}
DEFAULT_SKILL_RARITY = 0.3


# ── Component functions ────────────────────────────────────────────────────

def _urgency_value(urgency: str) -> float:
    return URGENCY_VALUE.get(urgency.lower(), 0.1)


def _severity_value(need_type: str, category: str | None) -> float:
    type_map = SEVERITY.get(need_type.lower(), {"default": 0.3})
    if category:
        return type_map.get(category.lower(), type_map["default"])
    return type_map["default"]


def _beneficiary_value(count: int) -> float:
    """log10(1 + count) / log10(1001) → 0..1 for count 0..1000"""
    if count <= 0:
        return 0.0
    return math.log10(1 + count) / math.log10(1001)


def _time_pressure_value(deadline: datetime | None) -> float:
    """Computed on every read — never persisted."""
    if deadline is None:
        return 0.1
    now = datetime.now(tz=timezone.utc)
    # Make deadline tz-aware if it isn't
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    hours_left = (deadline - now).total_seconds() / 3600
    if hours_left <= 24:
        return 1.0
    if hours_left <= 72:
        return 0.7
    if hours_left <= 168:  # 1 week
        return 0.4
    return 0.1


def _resource_difficulty_value(required_skills: list[str] | None) -> float:
    if not required_skills:
        return 0.0
    rarities = [SKILL_RARITY.get(s.lower(), DEFAULT_SKILL_RARITY) for s in required_skills]
    return sum(rarities) / len(rarities)


# ── Public API ─────────────────────────────────────────────────────────────

def compute_stable_components(need: Need) -> dict[str, float]:
    """
    Compute the components that don't change over time.
    Called once on publish (and on PATCH if scoring inputs change).
    Persisted to needs.priority_breakdown.
    Does NOT include time_pressure.
    """
    u = W_U * _urgency_value(need.urgency)
    s = W_S * _severity_value(need.need_type, need.category)
    b = W_B * _beneficiary_value(need.beneficiary_count)
    r = W_R * _resource_difficulty_value(need.required_skills)

    return {
        "urgency_component":              round(u, 2),
        "severity_component":             round(s, 2),
        "beneficiary_component":          round(b, 2),
        "resource_difficulty_component":  round(-r, 2),  # stored as negative
    }


def compute_stable_score(components: dict[str, float]) -> float:
    """Sum of stable components — stored in needs.priority_score."""
    return round(sum(components.values()), 2)


def compute_full_breakdown(
    stored_breakdown: dict[str, Any],
    deadline: datetime | None,
) -> dict[str, float]:
    """
    Returns the full breakdown including fresh time_pressure.
    Used in GET /needs and GET /needs/{id}/explain responses.
    """
    t = round(W_T * _time_pressure_value(deadline), 2)
    total = round(sum(stored_breakdown.values()) + t, 2)
    return {
        **stored_breakdown,
        "time_pressure_component": t,
        "total": total,
    }


def compute_full_score(need: Need) -> float:
    """
    Full priority score including time_pressure.
    Used when returning need data to the frontend.
    """
    if need.priority_breakdown:
        stable_sum = sum(need.priority_breakdown.values())
    elif need.priority_score is not None:
        stable_sum = need.priority_score
    else:
        components = compute_stable_components(need)
        stable_sum = sum(components.values())

    t = W_T * _time_pressure_value(need.deadline)
    return round(stable_sum + t, 2)