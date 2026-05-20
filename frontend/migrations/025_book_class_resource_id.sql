-- Migration 025: Add resource_id support to book_class RPC
-- Allows assigned-seat studios to record which resource (bike, reformer, etc.)
-- a user selects when booking a class.
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- ── 1. Ensure bookings.resource_id column exists ───────────────────
-- (Migration 008 should have added it, this is a safety guard)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL;

-- ── 2. Unique constraint: one user per resource per class ──────────
-- Constraint already exists from migration 008 — no-op.
-- ALTER TABLE public.bookings ADD CONSTRAINT bookings_class_resource_unique ...

-- ── 3. Rewrite book_class RPC with optional resource_id ────────────
DROP FUNCTION IF EXISTS public.book_class(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.book_class(UUID, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.book_class(
    p_class_id    UUID,
    p_user_id     UUID,
    p_gym_id      UUID,
    p_resource_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_class          RECORD;
    v_membership     RECORD;
    v_booking_id     UUID;
    v_credits_left   INT;
BEGIN
    -- Lock the class row to prevent race conditions on capacity
    SELECT * INTO v_class
    FROM public.classes
    WHERE id = p_class_id AND gym_id = p_gym_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'class_not_found');
    END IF;

    -- Check capacity
    IF v_class.current_enrolled >= v_class.capacity THEN
        RETURN json_build_object('success', false, 'error', 'class_full');
    END IF;

    -- Prevent duplicate booking by same user
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'already_booked');
    END IF;

    -- If a resource was requested, check it is not already taken
    IF p_resource_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.bookings
            WHERE class_id    = p_class_id
              AND resource_id = p_resource_id
              AND status      IN ('confirmed', 'completed')
        ) THEN
            RETURN json_build_object('success', false, 'error', 'resource_taken');
        END IF;
    END IF;

    -- Fetch active membership
    SELECT m.* INTO v_membership
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.gym_id  = p_gym_id
      AND m.status  = 'active'
    ORDER BY m.created_at DESC
    LIMIT 1;

    -- ── Access logic by plan_type ─────────────────────────────────
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'no_membership');
    END IF;

    IF v_membership.plan_type = 'ilimitado' THEN
        NULL; -- always allow

    ELSIF v_membership.plan_type = 'membresia' THEN
        IF v_membership.end_date < CURRENT_DATE THEN
            RETURN json_build_object('success', false, 'error', 'membership_expired');
        END IF;

    ELSE
        -- creditos (default)
        SELECT credits INTO v_credits_left
        FROM public.profiles
        WHERE id = p_user_id;

        IF COALESCE(v_credits_left, 0) <= 0 THEN
            RETURN json_build_object('success', false, 'error', 'no_credits');
        END IF;

        UPDATE public.profiles
        SET credits = credits - 1
        WHERE id = p_user_id;

        v_credits_left := v_credits_left - 1;
    END IF;

    -- ── Create booking ────────────────────────────────────────────
    INSERT INTO public.bookings (class_id, user_id, gym_id, status, resource_id)
    VALUES (p_class_id, p_user_id, p_gym_id, 'confirmed', p_resource_id)
    RETURNING id INTO v_booking_id;

    UPDATE public.classes
    SET current_enrolled = current_enrolled + 1
    WHERE id = p_class_id;

    RETURN json_build_object(
        'success',           true,
        'booking_id',        v_booking_id,
        'credits_remaining', COALESCE(v_credits_left, null),
        'plan_type',         v_membership.plan_type,
        'resource_id',       p_resource_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
