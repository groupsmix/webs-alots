-- Migration: Database-Level Audit Triggers
-- Description: Creates a low-level audit log table and triggers to catch any data changes
-- that bypass the application-layer (e.g., direct SQL modifications by super_admin).

CREATE TABLE IF NOT EXISTS db_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id UUID,
    clinic_id UUID,
    old_data JSONB,
    new_data JSONB,
    db_user TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Only postgres can read
ALTER TABLE db_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Postgres can access db_audit_log" ON db_audit_log FOR ALL TO postgres USING (true);

-- Trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    rec_id UUID;
    c_id UUID;
    old_record JSONB := NULL;
    new_record JSONB := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        rec_id := OLD.id;
        old_record := to_jsonb(OLD);
        BEGIN
            c_id := OLD.clinic_id;
        EXCEPTION WHEN undefined_column THEN
            c_id := NULL;
        END;
    ELSIF TG_OP = 'UPDATE' THEN
        rec_id := NEW.id;
        old_record := to_jsonb(OLD);
        new_record := to_jsonb(NEW);
        BEGIN
            c_id := NEW.clinic_id;
        EXCEPTION WHEN undefined_column THEN
            c_id := NULL;
        END;
    ELSIF TG_OP = 'INSERT' THEN
        rec_id := NEW.id;
        new_record := to_jsonb(NEW);
        BEGIN
            c_id := NEW.clinic_id;
        EXCEPTION WHEN undefined_column THEN
            c_id := NULL;
        END;
    END IF;

    INSERT INTO db_audit_log(table_name, action, record_id, clinic_id, old_data, new_data, db_user)
    VALUES (TG_TABLE_NAME, TG_OP, rec_id, c_id, old_record, new_record, current_user);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to sensitive tables
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY['users', 'appointments', 'consultation_notes', 'prescriptions', 'invoices'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', tbl, tbl);
            EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()', tbl, tbl);
        END IF;
    END LOOP;
END;
$$;
