-- Audit logs: ensure created_at is ALWAYS set by the database at insert time (real-time).
-- Do NOT send created_at from application code; the DB is the single source of truth.

-- 1) Ensure default is database server time (UTC stored as timestamptz)
ALTER TABLE audit_logs
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 2) Trigger: on every INSERT, set created_at to the exact moment of insert (overrides any value from app)
CREATE OR REPLACE FUNCTION audit_logs_created_at_realtime()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_created_at_realtime ON audit_logs;
CREATE TRIGGER audit_logs_created_at_realtime
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE PROCEDURE audit_logs_created_at_realtime();
