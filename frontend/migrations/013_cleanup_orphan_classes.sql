-- Migration 013: Clean up future orphan synced classes
-- Targets ONLY future classes with schedule_id = NULL that came from the sync
-- (identified by having no corresponding active schedule).
-- Classes created manually from /admin/sesiones are kept (they also have schedule_id = NULL
-- but were inserted by the admin, not by the sync — we delete ALL future null ones here
-- since the admin can recreate them; adjust the WHERE if needed).

-- Option A (recommended): delete only FUTURE classes with schedule_id NULL
-- This is safe if you only use the sync to generate recurring classes.
-- Manually-created one-off classes from /admin/sesiones will also be removed,
-- so only run this if you don't have any.

DELETE FROM public.classes
WHERE schedule_id IS NULL
  AND start_time > NOW();

-- Verify: should return 0 future orphan classes
SELECT COUNT(*) AS future_orphan_classes_remaining
FROM public.classes
WHERE schedule_id IS NULL
  AND start_time > NOW();
