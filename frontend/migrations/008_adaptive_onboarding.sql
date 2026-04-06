-- ══════════════════════════════════════════════════════════════════
-- Migration 008: Adaptive Post-Checkout Onboarding System
-- ══════════════════════════════════════════════════════════════════
--
-- This migration adds support for adaptive onboarding that customizes
-- the booking experience based on studio type (Pilates, Cycling, Yoga, etc.)
--
-- Changes:
-- 1. Add 9 new fields to gyms table for onboarding tracking and configuration
-- 2. Create resources table for assigned equipment (Reformers, Bikes, etc.)
-- 3. Add booking_mode overrides to class_types
-- 4. Add resource_id to bookings for seat assignments
-- 5. Mark existing gyms as onboarding_completed = true (backward compatibility)
--
-- Author: Claude AI
-- Date: 2026-03-23
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. ADD NEW FIELDS TO GYMS TABLE
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS studio_type TEXT
    CHECK (studio_type IN ('pilates', 'cycling', 'yoga', 'barre', 'dance', 'hiit', 'martial')),

  ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'capacity_only'
    CHECK (booking_mode IN ('assigned_resource', 'capacity_only', 'capacity_or_none')),

  ADD COLUMN IF NOT EXISTS default_capacity INTEGER DEFAULT 15
    CHECK (default_capacity > 0 AND default_capacity <= 100),

  ADD COLUMN IF NOT EXISTS has_capacity_limit BOOLEAN DEFAULT true,

  ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS brand_color TEXT,

  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,

  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0
    CHECK (onboarding_step >= 0 AND onboarding_step <= 10);

-- Add comments for documentation
COMMENT ON COLUMN public.gyms.studio_type IS 'Type of studio: determines booking mode and UI customization';
COMMENT ON COLUMN public.gyms.booking_mode IS 'How bookings work: assigned_resource (seats), capacity_only (count), capacity_or_none (unlimited)';
COMMENT ON COLUMN public.gyms.default_capacity IS 'Default capacity for classes (NULL = unlimited for capacity_or_none mode)';
COMMENT ON COLUMN public.gyms.has_capacity_limit IS 'Whether classes have capacity limits (false = unlimited for capacity_or_none mode)';
COMMENT ON COLUMN public.gyms.layout_config IS 'JSON config for room layout (rows, cols, resources) - used by assigned_resource mode';
COMMENT ON COLUMN public.gyms.brand_color IS 'Hex color code for gym branding (selected in onboarding)';
COMMENT ON COLUMN public.gyms.onboarding_completed IS 'Whether post-checkout setup wizard has been completed';
COMMENT ON COLUMN public.gyms.onboarding_completed_at IS 'Timestamp when onboarding was completed';
COMMENT ON COLUMN public.gyms.onboarding_step IS 'Current step in onboarding (0-7) - allows resuming after browser close';

-- ─────────────────────────────────────────────────────────────────
-- 2. CREATE RESOURCES TABLE (for assigned_resource mode)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  position_row INTEGER NOT NULL CHECK (position_row >= 0 AND position_row < 20),
  position_col INTEGER NOT NULL CHECK (position_col >= 0 AND position_col < 20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS resources_gym_id_idx ON public.resources(gym_id);
CREATE INDEX IF NOT EXISTS resources_room_id_idx ON public.resources(room_id);
CREATE INDEX IF NOT EXISTS resources_active_idx ON public.resources(gym_id, is_active) WHERE is_active = true;

-- Unique constraints
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_room_position_unique,
  ADD CONSTRAINT resources_room_position_unique
    UNIQUE(room_id, position_row, position_col);

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_gym_name_unique,
  ADD CONSTRAINT resources_gym_name_unique
    UNIQUE(gym_id, name);

-- Comments
COMMENT ON TABLE public.resources IS 'Physical equipment/seats for assigned_resource mode (Reformers, Bikes, etc.)';
COMMENT ON COLUMN public.resources.resource_type IS 'Type of resource: reformer, bike, mat, etc.';
COMMENT ON COLUMN public.resources.position_row IS 'Row position in grid layout (0-indexed)';
COMMENT ON COLUMN public.resources.position_col IS 'Column position in grid layout (0-indexed)';

-- ─────────────────────────────────────────────────────────────────
-- 3. ENABLE RLS ON RESOURCES TABLE
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (same pattern as other tables)
DROP POLICY IF EXISTS resources_tenant_isolation ON public.resources;
CREATE POLICY resources_tenant_isolation ON public.resources
  FOR ALL
  USING (gym_id::text = current_setting('app.current_gym_id', true));

-- ─────────────────────────────────────────────────────────────────
-- 4. ADD TRIGGER FOR UPDATED_AT
-- ─────────────────────────────────────────────────────────────────

-- Reuse existing set_updated_at function (created in migration 001)
DROP TRIGGER IF EXISTS resources_updated_at ON public.resources;
CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 5. ADD BOOKING_MODE OVERRIDE TO CLASS_TYPES
-- ─────────────────────────────────────────────────────────────────

-- Allow per-class override of booking mode (e.g., Pilates studio with Mat Pilates class)
ALTER TABLE public.class_types
  ADD COLUMN IF NOT EXISTS booking_mode_override TEXT
    CHECK (booking_mode_override IN ('assigned_resource', 'capacity_only', 'capacity_or_none') OR booking_mode_override IS NULL),

  ADD COLUMN IF NOT EXISTS capacity_override INTEGER
    CHECK (capacity_override IS NULL OR (capacity_override > 0 AND capacity_override <= 100));

COMMENT ON COLUMN public.class_types.booking_mode_override IS 'If set, overrides gym.booking_mode for this class type';
COMMENT ON COLUMN public.class_types.capacity_override IS 'If set, overrides gym.default_capacity for this class type';

-- ─────────────────────────────────────────────────────────────────
-- 6. ADD RESOURCE_ID TO BOOKINGS
-- ─────────────────────────────────────────────────────────────────

-- For assigned_resource mode: track which specific resource (seat/bike/reformer) is booked
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL;

-- Index for performance (queries like "which resources are booked for class X")
CREATE INDEX IF NOT EXISTS bookings_resource_id_idx ON public.bookings(resource_id) WHERE resource_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.resource_id IS 'For assigned_resource mode: specific equipment/seat booked (NULL for capacity_only/capacity_or_none)';

-- ─────────────────────────────────────────────────────────────────
-- 7. ADD UNIQUE CONSTRAINT: ONE RESOURCE PER CLASS
-- ─────────────────────────────────────────────────────────────────

-- Prevent double-booking: same resource can't be booked twice in same class
DROP INDEX IF EXISTS bookings_class_resource_unique;
CREATE UNIQUE INDEX bookings_class_resource_unique
  ON public.bookings(class_id, resource_id)
  WHERE status = 'confirmed' AND resource_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 8. BACKWARD COMPATIBILITY: MARK EXISTING GYMS AS COMPLETED
-- ─────────────────────────────────────────────────────────────────

-- All gyms created before this migration are grandfathered in
-- They bypass the new onboarding flow
UPDATE public.gyms
SET
  onboarding_completed = true,
  onboarding_completed_at = NOW(),
  onboarding_step = 7
WHERE created_at < NOW()
  AND onboarding_completed IS NOT true;

-- ══════════════════════════════════════════════════════════════════
-- ROLLBACK SCRIPT (execute if migration fails)
-- ══════════════════════════════════════════════════════════════════
--
-- DROP INDEX IF EXISTS bookings_class_resource_unique;
-- DROP INDEX IF EXISTS bookings_resource_id_idx;
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS resource_id;
--
-- ALTER TABLE public.class_types
--   DROP COLUMN IF EXISTS booking_mode_override,
--   DROP COLUMN IF EXISTS capacity_override;
--
-- DROP TRIGGER IF EXISTS resources_updated_at ON public.resources;
-- DROP POLICY IF EXISTS resources_tenant_isolation ON public.resources;
-- DROP INDEX IF EXISTS resources_active_idx;
-- DROP INDEX IF EXISTS resources_room_id_idx;
-- DROP INDEX IF EXISTS resources_gym_id_idx;
-- DROP TABLE IF EXISTS public.resources;
--
-- ALTER TABLE public.gyms
--   DROP COLUMN IF EXISTS onboarding_step,
--   DROP COLUMN IF EXISTS onboarding_completed_at,
--   DROP COLUMN IF EXISTS onboarding_completed,
--   DROP COLUMN IF EXISTS brand_color,
--   DROP COLUMN IF EXISTS layout_config,
--   DROP COLUMN IF EXISTS has_capacity_limit,
--   DROP COLUMN IF EXISTS default_capacity,
--   DROP COLUMN IF EXISTS booking_mode,
--   DROP COLUMN IF EXISTS studio_type;
-- ══════════════════════════════════════════════════════════════════
