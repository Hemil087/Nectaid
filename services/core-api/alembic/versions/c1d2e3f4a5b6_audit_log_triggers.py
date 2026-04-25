"""audit log triggers on needs, assignments, volunteer_profiles, users

Revision ID: c1d2e3f4a5b6
Revises: abcd0b71c7eb
Create Date: 2026-04-25

"""
from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "abcd0b71c7eb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Trigger function ──────────────────────────────────────────────────────
    op.execute("""
    CREATE OR REPLACE FUNCTION audit_log_trigger_fn()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
        v_actor_id  UUID;
        v_entity_id UUID;
        v_actor_str TEXT;
    BEGIN
        -- Read caller's user ID from session variable (non-fatal if absent)
        v_actor_str := current_setting('app.current_user_id', true);
        IF v_actor_str IS NOT NULL AND v_actor_str <> '' THEN
            BEGIN
                v_actor_id := v_actor_str::UUID;
            EXCEPTION WHEN others THEN
                v_actor_id := NULL;
            END;
        END IF;

        -- Resolve primary-key column per table
        IF TG_TABLE_NAME = 'volunteer_profiles' THEN
            v_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
        ELSE
            v_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
        END IF;

        INSERT INTO audit_log (
            actor_user_id, action, entity_type, entity_id,
            before_state, after_state, created_at
        ) VALUES (
            v_actor_id,
            TG_OP,
            TG_TABLE_NAME,
            v_entity_id,
            CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::JSONB ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END,
            NOW()
        );

        RETURN NULL;
    END;
    $$;
    """)

    # ── Per-table triggers ────────────────────────────────────────────────────
    for tbl in ("users", "needs", "assignments", "volunteer_profiles"):
        op.execute(f"""
        CREATE TRIGGER {tbl}_audit
        AFTER INSERT OR UPDATE OR DELETE ON {tbl}
        FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
        """)


def downgrade() -> None:
    for tbl in ("users", "needs", "assignments", "volunteer_profiles"):
        op.execute(f"DROP TRIGGER IF EXISTS {tbl}_audit ON {tbl};")
    op.execute("DROP FUNCTION IF EXISTS audit_log_trigger_fn();")
