-- Migration: Allow ticket status 'converted_to_incident' so tickets remain visible after conversion
-- Run this before changing the convert flow to stop deleting tickets.

-- Drop existing status check (constraint name may be tickets_status_check in Postgres)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

-- Add constraint including converted_to_incident
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'converted_to_incident'));
