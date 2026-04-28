-- Migration 014: Fix resources_gym_name_unique constraint
-- The constraint UNIQUE(gym_id, name) prevents having resources with the
-- same name (e.g. "Bicicleta 1") in different rooms of the same gym.
-- The position constraint UNIQUE(room_id, position_row, position_col) is
-- sufficient to prevent duplicates — drop the overly-restrictive name constraint.

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_gym_name_unique;

-- Verify: list remaining constraints on resources table
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.resources'::regclass
ORDER BY conname;
