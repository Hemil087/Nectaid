#!/usr/bin/env python3
"""
seed_demo.py — Populate Nectaid with realistic demo data.

Usage (inside the api container):
    docker compose exec api python scripts/seed_demo.py

Idempotent: skips if the demo org already exists.

Firebase note:
    Seeded users have placeholder firebase_uid values.
    For accounts you actually want to log in with, create them in the
    Firebase console first, then set these env vars before running:

        DEMO_COORDINATOR_UID=<firebase uid>
        DEMO_ADMIN_UID=<firebase uid>
        DEMO_VOLUNTEER1_UID=<firebase uid>
        DEMO_VOLUNTEER2_UID=<firebase uid>
"""
from __future__ import annotations

import math
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/app")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.need import Need
from app.models.user import Org, User
from app.models.volunteer import VolunteerProfile

# ── DB connection ─────────────────────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"].replace("+asyncpg", "+psycopg2")
engine = create_engine(DATABASE_URL, echo=False)

NOW = datetime.now(timezone.utc)
WEEK_AGO = NOW - timedelta(days=7)

random.seed(42)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ago(**kwargs) -> datetime:
    return NOW - timedelta(**kwargs)


def _priority(urgency: str, need_type: str, beneficiary_count: int) -> float:
    urgency_map = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.1}
    severity_map = {
        "medical": 1.0, "shelter": 0.8, "wash": 0.7, "food": 0.7,
        "education": 0.4, "livelihood": 0.4, "other": 0.3,
    }
    u = urgency_map.get(urgency, 0.4)
    s = severity_map.get(need_type, 0.3)
    b = math.log10(1 + beneficiary_count) / math.log10(1001)
    return round(40 * u + 25 * s + 20 * b, 2)


# ── Seed data ─────────────────────────────────────────────────────────────────

VOLUNTEER_DATA = [
    ("Arjun Mehta",       "arjun.mehta@example.com",   "+919876543210", ["general-doctor", "first-aid"],          "Ahmedabad, Gujarat",   25, 0.88, 12),
    ("Priya Patel",       "priya.patel@example.com",    "+919876543211", ["nurse", "first-aid"],                   "Surat, Gujarat",       30, 0.82, 9),
    ("Ravi Desai",        "ravi.desai@example.com",     "+919876543212", ["pediatrician", "general-doctor"],       "Vadodara, Gujarat",    20, 0.91, 15),
    ("Meera Shah",        "meera.shah@example.com",     "+919876543213", ["surgeon", "general-doctor"],            "Rajkot, Gujarat",      35, 0.75, 7),
    ("Kavita Joshi",      "kavita.joshi@example.com",   "+919876543214", ["teacher-math", "teacher-science"],      "Ahmedabad, Gujarat",   15, 0.79, 8),
    ("Suresh Nair",       "suresh.nair@example.com",    "+919876543215", ["teacher-english", "social-worker"],     "Gandhinagar, Gujarat", 20, 0.84, 11),
    ("Anita Verma",       "anita.verma@example.com",    "+919876543216", ["social-worker", "translator-hindi"],    "Surat, Gujarat",       25, 0.70, 5),
    ("Deepak Rao",        "deepak.rao@example.com",     "+919876543217", ["electrician", "carpenter"],             "Vadodara, Gujarat",    40, 0.77, 6),
    ("Sneha Kulkarni",    "sneha.kulkarni@example.com", "+919876543218", ["physiotherapist", "nurse"],             "Ahmedabad, Gujarat",   20, 0.86, 10),
    ("Rahul Gupta",       "rahul.gupta@example.com",    "+919876543219", ["translator-gujarati", "social-worker"], "Anand, Gujarat",       30, 0.73, 4),
    ("Pooja Iyer",        "pooja.iyer@example.com",     "+919876543220", ["psychiatrist", "social-worker"],        "Surat, Gujarat",       25, 0.81, 8),
    ("Amit Sharma",       "amit.sharma@example.com",    "+919876543221", ["plumber", "carpenter"],                 "Bhavnagar, Gujarat",   35, 0.68, 3),
    ("Nisha Tiwari",      "nisha.tiwari@example.com",   "+919876543222", ["nurse", "translator-hindi"],            "Rajkot, Gujarat",      20, 0.85, 9),
    ("Vijay Krishnan",    "vijay.k@example.com",        "+919876543223", ["general-doctor", "first-aid"],          "Junagadh, Gujarat",    30, 0.78, 7),
    ("Lakshmi Pillai",    "lakshmi.p@example.com",      "+919876543224", ["teacher-math", "teacher-english"],      "Ahmedabad, Gujarat",   15, 0.90, 13),
    ("Mohan Das",         "mohan.das@example.com",      "+919876543225", ["social-worker", "volunteer-general"],   "Surat, Gujarat",       25, 0.65, 2),
    ("Sunita Reddy",      "sunita.r@example.com",       "+919876543226", ["nurse", "physiotherapist"],             "Vadodara, Gujarat",    20, 0.83, 8),
    ("Kiran Bose",        "kiran.bose@example.com",     "+919876543227", ["carpenter", "electrician"],             "Gandhinagar, Gujarat", 30, 0.71, 5),
    ("Rekha Pandey",      "rekha.p@example.com",        "+919876543228", ["teacher-science", "social-worker"],     "Anand, Gujarat",       20, 0.76, 6),
    ("Sanjay Bhatt",      "sanjay.b@example.com",       "+919876543229", ["general-doctor", "psychiatrist"],       "Ahmedabad, Gujarat",   25, 0.87, 11),
]

NEEDS_DATA = [
    # (title, need_type, urgency, description, beneficiary_count, required_skills, required_team_size, status, days_ago_created)
    (
        "Emergency medical camp — flood survivors",
        "medical", "critical",
        "Flood-affected families in Kathlal need urgent medical attention. Many children showing signs of waterborne illness.",
        150, ["general-doctor", "nurse", "first-aid"], 3,
        "published", 1,
    ),
    (
        "Paediatric care unit — Kheda district",
        "medical", "high",
        "District hospital overwhelmed with child patients. Paediatric doctors and nurses needed for 3-day relief camp.",
        80, ["pediatrician", "nurse"], 2,
        "matching_complete", 2,
    ),
    (
        "Temporary school — displaced children",
        "education", "high",
        "200+ displaced children out of school for 2 weeks. Need teachers for math, science, and English.",
        200, ["teacher-math", "teacher-science", "teacher-english"], 3,
        "assigned", 3,
    ),
    (
        "Mental health support — relief camp",
        "medical", "medium",
        "Trauma counselling needed for adults and children at Anand relief camp. Hindi/Gujarati speaking preferred.",
        60, ["psychiatrist", "social-worker"], 2,
        "pending_review", 0,
    ),
    (
        "Shelter repair — Bhavnagar",
        "shelter", "high",
        "40 homes with damaged roofs and walls after cyclone. Carpenters and electricians needed urgently.",
        120, ["carpenter", "electrician"], 2,
        "published", 2,
    ),
    (
        "Water purification training",
        "wash", "medium",
        "Train 50 community volunteers on water purification and hygiene protocols.",
        50, ["social-worker", "volunteer-general"], 1,
        "in_progress", 5,
    ),
    (
        "Community health screening — Rajkot",
        "medical", "medium",
        "Routine health screening for elderly residents in 3 villages. Blood pressure, diabetes, vision checks.",
        90, ["general-doctor", "nurse"], 2,
        "completed", 10,
    ),
    (
        "Physiotherapy camp — post-flood recovery",
        "medical", "low",
        "Rehabilitation physiotherapy for 30 patients recovering from flood injuries.",
        30, ["physiotherapist"], 1,
        "pending_review", 1,
    ),
    (
        "Document recovery assistance",
        "livelihood", "medium",
        "Help flood survivors recover and replace lost identity documents and ration cards.",
        75, ["social-worker", "translator-gujarati"], 2,
        "cancelled", 6,
    ),
    (
        "Night shelter — migrant workers",
        "shelter", "high",
        "Temporary shelter for 100 displaced migrant workers in Surat industrial area.",
        100, ["social-worker", "volunteer-general"], 1,
        "matching_complete", 4,
    ),
]


def seed(session: Session) -> None:
    # ── Guard: skip if already seeded ─────────────────────────────────────────
    existing = session.execute(
        text("SELECT id FROM orgs WHERE name = 'Gujarat Relief Network' LIMIT 1")
    ).fetchone()
    if existing:
        print("✓ Demo data already present — skipping.")
        return

    print("Seeding demo data...")

    # ── Org ───────────────────────────────────────────────────────────────────
    org = Org(
        name="Gujarat Relief Network",
        description="Coordinating disaster relief and community support across Gujarat.",
        contact_email="coord@gujarat-relief.example.com",
        verified=True,
    )
    session.add(org)
    session.flush()
    print(f"  org: {org.name} ({org.id})")

    # ── Coordinator ───────────────────────────────────────────────────────────
    coordinator = User(
        firebase_uid=os.getenv("DEMO_COORDINATOR_UID", f"demo-coordinator-{uuid.uuid4().hex[:8]}"),
        role="coordinator",
        full_name="Priya Sharma",
        email="coordinator@nectaid.demo",
        phone="+919000000001",
        preferred_language="en",
        org_id=org.id,
    )
    session.add(coordinator)

    admin = User(
        firebase_uid=os.getenv("DEMO_ADMIN_UID", f"demo-admin-{uuid.uuid4().hex[:8]}"),
        role="admin",
        full_name="Admin Nectaid",
        email="admin@nectaid.demo",
        phone="+919000000002",
        preferred_language="en",
        org_id=org.id,
    )
    session.add(admin)
    session.flush()
    print(f"  coordinator: {coordinator.full_name} (firebase_uid={coordinator.firebase_uid})")
    print(f"  admin: {admin.full_name} (firebase_uid={admin.firebase_uid})")

    # ── Volunteers (20) ───────────────────────────────────────────────────────
    vol_uids = [
        os.getenv("DEMO_VOLUNTEER1_UID", f"demo-vol-{uuid.uuid4().hex[:8]}"),
        os.getenv("DEMO_VOLUNTEER2_UID", f"demo-vol-{uuid.uuid4().hex[:8]}"),
    ]
    volunteers: list[User] = []

    for i, (name, email, phone, skills, address, km, score, completed) in enumerate(VOLUNTEER_DATA):
        uid = vol_uids[i] if i < len(vol_uids) else f"demo-vol-{uuid.uuid4().hex[:8]}"
        lang = ["en", "hi", "gu"][i % 3]
        user = User(
            firebase_uid=uid,
            role="volunteer",
            full_name=name,
            email=email,
            phone=phone,
            preferred_language=lang,
            org_id=org.id,
        )
        session.add(user)
        session.flush()

        profile = VolunteerProfile(
            user_id=user.id,
            skills=skills,
            skills_text=" | ".join(skills),
            home_address=address,
            max_travel_km=km,
            verified=True,
            active=True,
            reliability_score=score,
            total_tasks_completed=completed,
            notification_prefs={"email": True, "in_app": True},
        )
        session.add(profile)
        volunteers.append(user)

    session.flush()
    print(f"  volunteers: {len(volunteers)} created")

    # ── Needs (10) ────────────────────────────────────────────────────────────
    needs: list[Need] = []
    for (title, need_type, urgency, description, bcount, skills, team_size, status, days_ago) in NEEDS_DATA:
        p = _priority(urgency, need_type, bcount)
        deadline = NOW + timedelta(days=random.randint(2, 14)) if status not in ("cancelled", "completed") else None
        published_at = _ago(days=days_ago) if status not in ("pending_review",) else None

        need = Need(
            org_id=org.id,
            need_type=need_type,
            title=title,
            description=description,
            urgency=urgency,
            beneficiary_count=bcount,
            required_skills=skills,
            required_team_size=team_size,
            status=status,
            priority_score=p,
            priority_breakdown={
                "urgency_component": round(40 * {"critical":1.0,"high":0.7,"medium":0.4,"low":0.1}[urgency], 2),
                "severity_component": round(25 * {"medical":1.0,"shelter":0.8,"wash":0.7,"food":0.7,"education":0.4,"livelihood":0.4,"other":0.3}.get(need_type, 0.3), 2),
                "beneficiary_component": round(20 * math.log10(1 + bcount) / math.log10(1001), 2),
                "time_pressure_component": 5.0,
                "resource_difficulty_component": -1.5,
                "total": p,
            },
            location_text=f"{random.choice(['Ahmedabad','Surat','Vadodara','Rajkot','Anand','Kheda','Bhavnagar','Junagadh'])}, Gujarat",
            deadline=deadline,
            created_by=coordinator.id,
            reviewed_by=coordinator.id if status != "pending_review" else None,
            reviewed_at=_ago(days=days_ago) if status != "pending_review" else None,
            published_at=published_at,
            completed_at=_ago(days=1) if status == "completed" else None,
            created_at=_ago(days=days_ago + 1),
            updated_at=_ago(days=days_ago),
        )
        session.add(need)
        needs.append(need)

    session.flush()
    print(f"  needs: {len(needs)} created ({', '.join(n.status for n in needs)})")

    # ── Assignments — historical (completed need + some actives) ──────────────
    completed_need = next(n for n in needs if n.status == "completed")
    in_progress_need = next(n for n in needs if n.status == "in_progress")
    assigned_need = next(n for n in needs if n.status == "assigned")
    matching_needs = [n for n in needs if n.status == "matching_complete"]

    assignment_rows: list[tuple[Need, User, str, float, str, int]] = []

    # Completed assignments (historical — 1 week ago)
    for vol, role in zip(volunteers[:2], ["general-doctor", "nurse"]):
        assignment_rows.append((completed_need, vol, role, round(random.uniform(0.72, 0.95), 3), "completed", -10))

    # In-progress
    assignment_rows.append((in_progress_need, volunteers[5], "social-worker", 0.81, "in_progress", -5))

    # Assigned (accepted)
    for vol, role in zip(volunteers[3:6], completed_need.required_skills or ["volunteer"]):
        assignment_rows.append((assigned_need, vol, role, round(random.uniform(0.65, 0.90), 3), "accepted", -3))

    # Matching complete — pending accept
    for mn in matching_needs:
        for vol, role in zip(
            random.sample(volunteers[6:], min(mn.required_team_size, len(volunteers[6:]))),
            (mn.required_skills or ["volunteer-general"])[:mn.required_team_size],
        ):
            assignment_rows.append((mn, vol, role, round(random.uniform(0.60, 0.88), 3), "pending_accept", -1))

    created_assignments = 0
    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for need, vol, role, score, a_status, days_offset in assignment_rows:
        pair = (need.id, vol.id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        assigned_at = NOW + timedelta(days=days_offset)
        responded_at = assigned_at + timedelta(minutes=random.randint(3, 45)) if a_status in ("accepted", "in_progress", "completed") else None
        started_at = responded_at + timedelta(hours=1) if a_status in ("in_progress", "completed") else None
        completed_at = started_at + timedelta(hours=random.randint(2, 8)) if a_status == "completed" else None

        a = Assignment(
            need_id=need.id,
            volunteer_id=vol.id,
            role_in_team=role,
            match_score=score,
            match_breakdown={
                "similarity": round(score * 0.6, 3),
                "location_score": round(random.uniform(0.5, 1.0), 3),
                "reliability": round(score * 0.15, 3),
                "experience": round(random.uniform(0.0, 0.1), 3),
                "recency_penalty": 0.0,
            },
            status=a_status,
            assigned_at=assigned_at,
            accept_deadline=assigned_at + timedelta(minutes=15),
            responded_at=responded_at,
            started_at=started_at,
            completed_at=completed_at,
            coordinator_rating=random.randint(4, 5) if a_status == "completed" else None,
        )
        session.add(a)
        created_assignments += 1

    session.flush()
    print(f"  assignments: {created_assignments} created")

    session.commit()
    print("\n✅ Seed complete.")
    print(f"\n  Coordinator firebase_uid : {coordinator.firebase_uid}")
    print(f"  Admin firebase_uid       : {admin.firebase_uid}")
    print(f"  Volunteer 1 firebase_uid : {volunteers[0].firebase_uid}")
    print(f"  Volunteer 2 firebase_uid : {volunteers[1].firebase_uid}")
    print("\n  → Update these in Firebase Auth console if you want to log in as these users.")


if __name__ == "__main__":
    with Session(engine) as session:
        seed(session)
