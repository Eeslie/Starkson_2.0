-- Migration: Update file_path column to TEXT to support longer Cloudinary URLs
-- Cloudinary URLs can be longer than 500 characters, so we need to change from VARCHAR(500) to TEXT

-- Check if column exists and update it
DO $$
BEGIN
  -- Check if the column exists and is VARCHAR(500)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'attachments' 
    AND column_name = 'file_path' 
    AND data_type = 'character varying'
    AND character_maximum_length = 500
  ) THEN
    -- Alter the column to TEXT
    ALTER TABLE attachments ALTER COLUMN file_path TYPE TEXT;
    RAISE NOTICE 'Updated file_path column from VARCHAR(500) to TEXT';
  ELSE
    RAISE NOTICE 'file_path column does not exist or is already TEXT';
  END IF;
END $$;
