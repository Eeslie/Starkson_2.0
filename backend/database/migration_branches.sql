-- Migration: Add branches support (single admin, user branch assignment, ticket/incident per-branch numbering)
-- Run this migration in Supabase SQL editor.

-- 1. Users: which branches a user is assigned to (admin has no branches; only one admin allowed in app logic)
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_acronyms text[] DEFAULT '{}';

-- 2. Tickets: each ticket belongs to one branch (number format: D01-000001)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS branch_acronym text;

-- 3. Incidents: each incident belongs to one branch (number format: INC-D01-000001)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS branch_acronym text;

-- Optional: backfill existing rows so existing tickets/incidents still work (use a default branch or leave null and handle in code)
-- UPDATE tickets SET branch_acronym = 'SPI' WHERE branch_acronym IS NULL;
-- UPDATE incidents SET branch_acronym = 'SPI' WHERE branch_acronym IS NULL;

-- Optional: assign branches to existing users (run after column exists). Replace user email with the real one.
-- Example: give one branch to a user so they can create tickets
-- UPDATE users SET branch_acronyms = ARRAY['D01']::text[] WHERE email = 'ranz@gmail.com';
-- Example: give "All Branches" to a user
-- UPDATE users SET branch_acronyms = ARRAY['ALL']::text[] WHERE email = 'someone@example.com';
