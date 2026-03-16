-- Migration: Username (login) and Fullname (display)
-- Run this in Supabase SQL editor after schema.sql / existing migrations.
-- Login will use username + password; display name is fullname.

-- 1. Add username column (nullable first for backfill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- 2. Backfill existing rows: use email as username so existing users can still sign in
UPDATE users SET username = LOWER(TRIM(email)) WHERE email IS NOT NULL AND (username IS NULL OR username = '');

-- 3. If any username is still null (e.g. no email), use a placeholder based on id
UPDATE users SET username = 'user_' || REPLACE(id::text, '-', '') WHERE username IS NULL OR username = '';

-- 4. Enforce UNIQUE then NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- 5. Rename name -> fullname
ALTER TABLE users RENAME COLUMN name TO fullname;

-- 6. Make email optional (so new accounts can be username-only)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
