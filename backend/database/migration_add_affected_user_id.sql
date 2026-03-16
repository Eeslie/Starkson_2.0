-- Add affected_user_id to link incident to the user who created the source ticket (by id).
-- Affected user name is resolved from users table when displaying.
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS affected_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN incidents.affected_user_id IS 'User who created the source ticket (ticket creator). Resolved from DB when displaying.';
