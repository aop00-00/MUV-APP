-- =============================================================================
-- Migration 011: Add schedule_id + room_id to classes, coach_id + room_id to schedules
-- Required for syncGymClassesFromSchedules() to link horarios → sesiones
-- =============================================================================

-- 1. Link classes back to their parent schedule template
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL;

-- 2. Allow classes to reference a room directly
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS room_id UUID;

-- 3. Store coach name as text on classes (avoids PostgREST schema-cache join issues)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS coach_name TEXT;

-- 4. Store coach FK on schedules (in addition to coach_name text)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS coach_id UUID;

-- 5. Store room FK on schedules (in addition to room_name text)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS room_id UUID;

-- 6. Index for fast sync queries (delete + insert by schedule_id)
CREATE INDEX IF NOT EXISTS classes_schedule_id_idx
  ON public.classes(schedule_id)
  WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS classes_gym_start_time_idx
  ON public.classes(gym_id, start_time);

-- 7. Force PostgREST to reload schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';

-- 8. Verification — should return 3 rows if migration succeeded
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'classes'
  AND column_name IN ('schedule_id', 'room_id', 'coach_name');
