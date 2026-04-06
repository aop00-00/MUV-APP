-- =============================================================================
-- QUICK FIX: Drop existing trigger and recreate everything idempotently
-- =============================================================================
-- Run this instead of 001_create_gyms_and_rls.sql if you got trigger error
-- This version is safe to run multiple times

-- Drop the trigger that's causing the error
DROP TRIGGER IF EXISTS gyms_updated_at ON public.gyms;

-- Now run the full migration with IF NOT EXISTS everywhere
-- =============================================================================

-- Create function (OR REPLACE makes it safe to re-run)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Recreate the trigger
CREATE TRIGGER gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add missing columns if they don't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

ALTER TABLE public.fitcoins
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitcoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS gyms_owner_id_idx ON public.gyms(owner_id);
CREATE INDEX IF NOT EXISTS profiles_gym_id_idx ON public.profiles(gym_id);
CREATE INDEX IF NOT EXISTS classes_gym_id_idx ON public.classes(gym_id);
CREATE INDEX IF NOT EXISTS bookings_gym_id_idx ON public.bookings(gym_id);
CREATE INDEX IF NOT EXISTS orders_gym_id_idx ON public.orders(gym_id);

-- Drop existing policies to recreate them (avoids "already exists" errors)
DROP POLICY IF EXISTS "gym_owner_read_own" ON public.gyms;
DROP POLICY IF EXISTS "gym_owner_update_own" ON public.gyms;
DROP POLICY IF EXISTS "tenant_isolation" ON public.profiles;
DROP POLICY IF EXISTS "tenant_isolation" ON public.memberships;
DROP POLICY IF EXISTS "tenant_isolation" ON public.classes;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bookings;
DROP POLICY IF EXISTS "tenant_isolation" ON public.orders;
DROP POLICY IF EXISTS "tenant_isolation" ON public.fitcoins;
DROP POLICY IF EXISTS "tenant_isolation" ON public.leads;

-- Recreate RLS policies
CREATE POLICY "gym_owner_read_own" ON public.gyms
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "gym_owner_update_own" ON public.gyms
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.memberships
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.classes
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.bookings
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.orders
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.fitcoins
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

CREATE POLICY "tenant_isolation" ON public.leads
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- Create JWT Hook function (OR REPLACE makes it safe)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims      jsonb;
  user_id     uuid;
  user_gym_id uuid;
  user_role   text;
BEGIN
  user_id := (event ->> 'user_id')::uuid;

  SELECT p.gym_id, p.role
  INTO user_gym_id, user_role
  FROM public.profiles p
  WHERE p.id = user_id;

  claims := event -> 'claims';

  IF user_gym_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(user_gym_id));
  END IF;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Create RPC functions (OR REPLACE makes them safe to re-run)
CREATE OR REPLACE FUNCTION public.book_class(
  p_class_id  uuid,
  p_user_id   uuid,
  p_gym_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_class        record;
  v_profile      record;
  v_booking_id   uuid;
BEGIN
  SELECT * INTO v_class FROM public.classes
  WHERE id = p_class_id AND gym_id = p_gym_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'class_not_found');
  END IF;

  IF v_class.current_enrolled >= v_class.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'class_full');
  END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE id = p_user_id AND gym_id = p_gym_id FOR UPDATE;

  IF NOT FOUND OR v_profile.credits < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE class_id = p_class_id AND user_id = p_user_id
      AND gym_id = p_gym_id AND status = 'confirmed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_booked');
  END IF;

  INSERT INTO public.bookings (user_id, class_id, gym_id, status)
  VALUES (p_user_id, p_class_id, p_gym_id, 'confirmed')
  RETURNING id INTO v_booking_id;

  UPDATE public.profiles SET credits = credits - 1
  WHERE id = p_user_id AND gym_id = p_gym_id;

  UPDATE public.classes SET current_enrolled = current_enrolled + 1
  WHERE id = p_class_id AND gym_id = p_gym_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'credits_remaining', v_profile.credits - 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id  uuid,
  p_user_id     uuid,
  p_gym_id      uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking record;
  v_class   record;
  v_refund  boolean := false;
BEGIN
  SELECT * INTO v_booking FROM public.bookings
  WHERE id = p_booking_id AND user_id = p_user_id AND gym_id = p_gym_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM public.classes WHERE id = v_booking.class_id;

  IF v_class.start_time > now() + interval '2 hours' THEN
    UPDATE public.profiles SET credits = credits + 1
    WHERE id = p_user_id AND gym_id = p_gym_id;
    v_refund := true;
  END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
  WHERE id = p_booking_id;

  UPDATE public.classes SET current_enrolled = GREATEST(current_enrolled - 1, 0)
  WHERE id = v_booking.class_id AND gym_id = p_gym_id;

  RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_class_id  uuid,
  p_user_id   uuid,
  p_gym_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_position integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.waitlist
    WHERE class_id = p_class_id AND user_id = p_user_id
      AND gym_id = p_gym_id AND status = 'waiting'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_in_waitlist');
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM public.waitlist
  WHERE class_id = p_class_id AND gym_id = p_gym_id AND status = 'waiting';

  INSERT INTO public.waitlist (user_id, class_id, gym_id, position, status)
  VALUES (p_user_id, p_class_id, p_gym_id, v_position, 'waiting');

  RETURN jsonb_build_object('success', true, 'position', v_position);
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_waitlist TO authenticated;

-- =============================================================================
-- Done! You can now run VERIFY_DATABASE.sql to confirm everything is set up
-- =============================================================================