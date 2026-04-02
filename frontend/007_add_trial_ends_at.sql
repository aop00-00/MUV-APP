-- =============================================================================
-- Migration 007: Add trial_ends_at to gyms table for 7-day trial tracking
-- =============================================================================

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill: existing trial gyms that have no trial_ends_at get 7 days from now
UPDATE public.gyms
SET trial_ends_at = now() + interval '7 days'
WHERE plan_status = 'trial' AND trial_ends_at IS NULL;

-- Index for efficient trial-expiry queries
CREATE INDEX IF NOT EXISTS gyms_trial_ends_at_idx
  ON public.gyms(trial_ends_at)
  WHERE plan_status = 'trial';
