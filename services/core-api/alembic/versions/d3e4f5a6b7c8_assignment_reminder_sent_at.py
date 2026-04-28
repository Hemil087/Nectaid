"""assignment reminder_sent_at column

Revision ID: d3e4f5a6b7c8
Revises: c1d2e3f4a5b6
Create Date: 2026-04-27 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "d3e4f5a6b7c8"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assignments",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Index to make the cron query fast
    op.create_index(
        "idx_assign_pending_reminder",
        "assignments",
        ["accept_deadline", "reminder_sent_at"],
        postgresql_where=sa.text("status = 'pending_accept'"),
    )


def downgrade() -> None:
    op.drop_index("idx_assign_pending_reminder", table_name="assignments")
    op.drop_column("assignments", "reminder_sent_at")
