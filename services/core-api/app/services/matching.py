"""
Matching service — pure Python, no AI, no GCP.

Phase 1: Hard filtering happens in SQL (see needs.py handler).
Phase 2: Scoring — weighted match_score per candidate.
Phase 3: Team formation — greedy skill coverage, Hungarian fallback.

This module only does Phase 2 + 3. It receives pre-filtered candidates
as plain dataclasses so it can be unit-tested without a DB connection.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
from scipy.optimize import linear_sum_assignment

# ── Match score weights ────────────────────────────────────────────────────
W_SIMILARITY   = 0.50
W_LOCATION     = 0.20
W_RELIABILITY  = 0.15
W_EXPERIENCE   = 0.10
W_RECENCY      = 0.05   # (1 - recency_penalty)


@dataclass
class CandidateVolunteer:
    """
    Populated from the SQL query result in the needs router.
    All numeric fields are pre-computed by the query.
    """
    user_id: str
    full_name: str
    skills: list[str]
    reliability_score: float
    similarity: float          # 1 - cosine_distance (from pgvector)
    distance_km: float
    max_travel_km: int
    tasks_this_week: int       # from subquery
    experience_in_type: int    # from subquery
    match_score: float = 0.0
    loc_score: float = 0.0
    recency_penalty: float = 0.0
    experience_score: float = 0.0


@dataclass
class AssignedMember:
    volunteer: CandidateVolunteer
    role: str
    match_breakdown: dict[str, Any] = field(default_factory=dict)


# ── Phase 2: Scoring ───────────────────────────────────────────────────────

def score_candidate(vol: CandidateVolunteer) -> CandidateVolunteer:
    """
    Compute match_score for a single candidate.
    Mutates vol in place and returns it for chaining.
    """
    vol.loc_score = max(0.0, 1.0 - (vol.distance_km / vol.max_travel_km))
    vol.recency_penalty = min(vol.tasks_this_week / 5.0, 1.0)
    vol.experience_score = min(vol.experience_in_type / 10.0, 1.0)

    vol.match_score = round(
        W_SIMILARITY  * vol.similarity
      + W_LOCATION    * vol.loc_score
      + W_RELIABILITY * vol.reliability_score
      + W_EXPERIENCE  * vol.experience_score
      + W_RECENCY     * (1.0 - vol.recency_penalty),
        4,
    )
    return vol


def score_candidates(candidates: list[CandidateVolunteer]) -> list[CandidateVolunteer]:
    """Score and sort descending by match_score."""
    for c in candidates:
        score_candidate(c)
    return sorted(candidates, key=lambda v: v.match_score, reverse=True)


def build_match_breakdown(vol: CandidateVolunteer) -> dict[str, Any]:
    return {
        "similarity":       round(vol.similarity, 4),
        "location_score":   round(vol.loc_score, 4),
        "reliability":      round(vol.reliability_score, 4),
        "experience":       round(vol.experience_score, 4),
        "recency_penalty":  round(vol.recency_penalty, 4),
        "total":            vol.match_score,
    }


# ── Phase 3a: Greedy team formation ───────────────────────────────────────

def greedy_team(
    candidates: list[CandidateVolunteer],
    required_skills: list[str],
    team_size: int,
) -> tuple[list[AssignedMember], bool]:
    """
    Greedy skill-coverage assignment.
    Returns (team, skills_fully_covered).
    """
    assigned: list[AssignedMember] = []
    remaining_skills = list(required_skills)
    assigned_ids: set[str] = set()

    # First pass — fill required skill slots
    for vol in candidates:
        if not remaining_skills:
            break
        for skill in remaining_skills:
            if skill in vol.skills:
                assigned.append(AssignedMember(
                    volunteer=vol,
                    role=skill,
                    match_breakdown=build_match_breakdown(vol),
                ))
                assigned_ids.add(vol.user_id)
                remaining_skills.remove(skill)
                break

    # Second pass — fill remaining team_size slots with best available
    remaining_candidates = [c for c in candidates if c.user_id not in assigned_ids]
    for vol in remaining_candidates:
        if len(assigned) >= team_size:
            break
        assigned.append(AssignedMember(
            volunteer=vol,
            role="support",
            match_breakdown=build_match_breakdown(vol),
        ))
        assigned_ids.add(vol.user_id)

    coverage_ok = len(remaining_skills) == 0
    return assigned, coverage_ok


# ── Phase 3b: Hungarian fallback ──────────────────────────────────────────

def hungarian_team(
    candidates: list[CandidateVolunteer],
    required_skills: list[str],
) -> list[AssignedMember]:
    """
    Optimal skill-to-volunteer assignment using the Hungarian algorithm.
    Called only when greedy fails to cover all required skills.
    """
    if not candidates or not required_skills:
        return []

    n_skills = len(required_skills)
    n_cands = len(candidates)

    # Cost matrix: rows = skill slots, cols = candidates
    # Cost = -match_score if candidate has skill, else large penalty
    LARGE = 1e6
    cost = np.full((n_skills, n_cands), LARGE)

    for i, skill in enumerate(required_skills):
        for j, vol in enumerate(candidates):
            if skill in vol.skills:
                cost[i][j] = -vol.match_score

    row_idx, col_idx = linear_sum_assignment(cost)

    team: list[AssignedMember] = []
    assigned_ids: set[str] = set()

    for r, c in zip(row_idx, col_idx):
        if cost[r][c] < LARGE * 0.9:  # valid match
            vol = candidates[c]
            if vol.user_id not in assigned_ids:
                team.append(AssignedMember(
                    volunteer=vol,
                    role=required_skills[r],
                    match_breakdown=build_match_breakdown(vol),
                ))
                assigned_ids.add(vol.user_id)

    return team


# ── Public entry point ─────────────────────────────────────────────────────

def form_team(
    candidates: list[CandidateVolunteer],
    required_skills: list[str] | None,
    team_size: int,
) -> list[AssignedMember]:
    """
    Main entry point. Returns the best team for a need.

    Algorithm:
    1. Score all candidates.
    2. team_size == 1 → return top-1.
    3. multi-skill → greedy first, Hungarian if greedy fails to cover skills.
    4. single-skill multi-person → top-N by score.
    """
    if not candidates:
        return []

    scored = score_candidates(candidates)
    skills = list(required_skills or [])

    # Single assignment
    if team_size == 1:
        vol = scored[0]
        return [AssignedMember(
            volunteer=vol,
            role=skills[0] if skills else "volunteer",
            match_breakdown=build_match_breakdown(vol),
        )]

    # No specific skill requirements — just pick top-N
    if not skills:
        return [
            AssignedMember(
                volunteer=vol,
                role="volunteer",
                match_breakdown=build_match_breakdown(vol),
            )
            for vol in scored[:team_size]
        ]

    # Single skill, multiple people needed
    if len(set(skills)) == 1:
        skill = skills[0]
        result = []
        for vol in scored:
            if len(result) >= team_size:
                break
            result.append(AssignedMember(
                volunteer=vol,
                role=skill,
                match_breakdown=build_match_breakdown(vol),
            ))
        return result

    # Multi-skill team — greedy first
    team, covered = greedy_team(scored, skills, team_size)
    if covered:
        return team

    # Greedy failed → Hungarian fallback
    hungarian = hungarian_team(scored, skills)
    if hungarian:
        # Fill remaining slots (up to team_size) with next best
        assigned_ids = {m.volunteer.user_id for m in hungarian}
        extras = [
            AssignedMember(volunteer=v, role="support", match_breakdown=build_match_breakdown(v))
            for v in scored
            if v.user_id not in assigned_ids
        ]
        combined = hungarian + extras
        return combined[:team_size]

    # Last resort — return whatever greedy produced
    return team