-- Migration: Create manageable branches table (Admin can add/delete via Maintenance modal)
-- Run this migration in Supabase SQL editor.
-- Existing branches from constants are seeded. 'ALL' is kept for user assignment.

CREATE TABLE IF NOT EXISTS branches (
  acronym text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed with existing branches from constants
INSERT INTO branches (acronym, name) VALUES
  ('ALL', 'All Branches'),
  ('A1P', 'A1+ - Multifood Packaging, Inc.'),
  ('D01', 'D01 – DISNEY 1'),
  ('D02', 'D02 – DISNEY 2'),
  ('D03', 'D03 – DISNEY 3'),
  ('D04', 'D04 – DISNEY 4'),
  ('D05', 'D05 – DISNEY 5'),
  ('D06', 'D06 – DISNEY 6'),
  ('D07', 'D07 – DISNEY 7'),
  ('D08', 'D08 – DISNEY 8'),
  ('D09', 'D09 – DISNEY 9'),
  ('DGN', 'DGN – DONGGUAN'),
  ('EUA', 'EUA – EURASIA'),
  ('HMF', 'HMF – Happy Alliance Mono Film, Inc.'),
  ('HBO', 'HBO – HASBRO'),
  ('MOR', 'MOR – ONE MARANAO MAIN'),
  ('OMO', 'OMO – ONE MARANAO'),
  ('MTL', 'MTL – MATTEL'),
  ('PLA', 'PLA – PERLANDIA'),
  ('SHI', 'SHI – SHANGHAI'),
  ('SPI', 'SPI – Starkson Packaging INC.'),
  ('SII', 'SII – STARKSON INDUSTRIES INC.'),
  ('SM1', 'SM1 – STARKSON INDUSTRIES INC.'),
  ('WNR', 'WNR – WARNER'),
  ('STO', 'STO – SITIO')
ON CONFLICT (acronym) DO NOTHING;
