-- =============================================================================
-- Migration 004: Add metadata column to profiles for tags and custom fields
-- =============================================================================
-- This adds a JSONB metadata column to store user tags and other custom data
-- Safe to run multiple times (uses IF NOT EXISTS)
-- =============================================================================

-- Add metadata column to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster JSON queries on tags
CREATE INDEX IF NOT EXISTS idx_profiles_metadata_tags
ON public.profiles USING GIN ((metadata->'tags'));

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'metadata';
