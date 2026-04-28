-- Migration 012: Add color column to schedules and classes
-- Required so the class type color propagates to the calendar

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#7c3aed';

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#7c3aed';

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('schedules', 'classes')
  AND column_name = 'color';
