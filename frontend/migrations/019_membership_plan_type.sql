-- Migration 019: Support membership-based access (no credits)
-- Adds plan_type to memberships table and rewrites book_class RPC
-- to skip credit deduction for membresia / ilimitado plans.
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- ── 1. Add plan_type to memberships ───────────────────────────────
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'creditos';

ALTER TABLE public.memberships
    DROP CONSTRAINT IF EXISTS memberships_plan_type_check;

ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_plan_type_check
    CHECK (plan_type IN ('creditos', 'membresia', 'ilimitado'));

-- Back-fill existing rows: if credits_included = 0 treat as membresia,
-- otherwise keep creditos (safe default — can be corrected per-gym later).
UPDATE public.memberships
SET plan_type = 'membresia'
WHERE plan_type = 'creditos' AND (credits_included IS NULL OR credits_included = 0);

-- ── 2. Rewrite book_class RPC ──────────────────────────────────────
-- Behaviour:
--   plan_type = 'creditos'   → deduct 1 credit, block if credits = 0
--   plan_type = 'membresia'  → allow if end_date >= today, no credit deduction
--   plan_type = 'ilimitado'  → always allow (no date or credit check)
--   No active membership     → block with 'no_membership'

DROP FUNCTION IF EXISTS public.book_class(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.book_class(
    p_class_id UUID,
    p_user_id  UUID,
    p_gym_id   UUID
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
    -- Lock the class row for update to prevent race conditions
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

    -- Prevent duplicate booking
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'already_booked');
    END IF;

    -- Fetch active membership (most recent active one)
    SELECT m.* INTO v_membership
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.gym_id  = p_gym_id
      AND m.status  = 'active'
    ORDER BY m.created_at DESC
    LIMIT 1;

    -- ── Access logic by plan_type ─────────────────────────────────

    -- No membership at all
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'no_membership');
    END IF;

    IF v_membership.plan_type = 'ilimitado' THEN
        -- Unlimited: always allow, no checks
        NULL;

    ELSIF v_membership.plan_type = 'membresia' THEN
        -- Membership-based: check end_date
        IF v_membership.end_date < CURRENT_DATE THEN
            RETURN json_build_object('success', false, 'error', 'membership_expired');
        END IF;

    ELSE
        -- Credits-based (default)
        SELECT credits INTO v_credits_left
        FROM public.profiles
        WHERE id = p_user_id;

        IF COALESCE(v_credits_left, 0) <= 0 THEN
            RETURN json_build_object('success', false, 'error', 'no_credits');
        END IF;

        -- Deduct 1 credit
        UPDATE public.profiles
        SET credits = credits - 1
        WHERE id = p_user_id;

        v_credits_left := v_credits_left - 1;
    END IF;

    -- ── Create booking ────────────────────────────────────────────
    INSERT INTO public.bookings (class_id, user_id, gym_id, status)
    VALUES (p_class_id, p_user_id, p_gym_id, 'confirmed')
    RETURNING id INTO v_booking_id;

    -- Increment enrolled count
    UPDATE public.classes
    SET current_enrolled = current_enrolled + 1
    WHERE id = p_class_id;

    RETURN json_build_object(
        'success',           true,
        'booking_id',        v_booking_id,
        'credits_remaining', COALESCE(v_credits_left, null),
        'plan_type',         v_membership.plan_type
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class TO service_role;

-- ── 3. Rewrite cancel_booking RPC ─────────────────────────────────
-- Only refund credit if plan_type = 'creditos' AND class is >2h away.

DROP FUNCTION IF EXISTS public.cancel_booking(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id UUID,
    p_user_id    UUID,
    p_gym_id     UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking    RECORD;
    v_class      RECORD;
    v_membership RECORD;
    v_refund     BOOLEAN := false;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND user_id = p_user_id AND gym_id = p_gym_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'booking_not_found');
    END IF;

    SELECT * INTO v_class FROM public.classes WHERE id = v_booking.class_id;

    -- Determine plan_type of the membership used
    SELECT m.plan_type INTO v_membership
    FROM public.memberships m
    WHERE m.user_id = p_user_id AND m.gym_id = p_gym_id AND m.status = 'active'
    ORDER BY m.created_at DESC LIMIT 1;

    -- Only refund credits if credit-based plan AND >2h before class
    IF COALESCE(v_membership.plan_type, 'creditos') = 'creditos'
       AND v_class.start_time > NOW() + INTERVAL '2 hours'
    THEN
        UPDATE public.profiles SET credits = credits + 1 WHERE id = p_user_id;
        v_refund := true;
    END IF;

    -- Cancel booking
    UPDATE public.bookings SET status = 'cancelled' WHERE id = p_booking_id;

    -- Decrement enrolled
    UPDATE public.classes
    SET current_enrolled = GREATEST(current_enrolled - 1, 0)
    WHERE id = v_booking.class_id;

    RETURN json_build_object('success', true, 'refunded', v_refund);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
