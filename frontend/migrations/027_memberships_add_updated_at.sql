-- Migration 027: Add updated_at to memberships if missing
-- Root cause: the memberships table was created before migration 003
-- so "CREATE TABLE IF NOT EXISTS" was skipped, but the trigger
-- memberships_updated_at was still installed — referencing a column
-- that didn't exist and causing UPDATE queries to fail.
-- Safe to run even if the column already exists.

ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows to avoid nulls (default now() covers new rows)
UPDATE public.memberships SET updated_at = created_at WHERE updated_at IS NULL;

-- Also ensure the trigger exists (idempotent)
DROP TRIGGER IF EXISTS memberships_updated_at ON public.memberships;
CREATE TRIGGER memberships_updated_at
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
