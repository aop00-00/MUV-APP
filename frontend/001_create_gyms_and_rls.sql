-- =============================================================================
-- Grind Project — Migration 001: gyms table + RLS + Custom JWT Hook
-- =============================================================================
-- Apply this in Supabase Dashboard → SQL Editor → New Query
-- IMPORTANT: Apply in STAGING first, then production.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION A: TABLE `gyms` (Multitenant Core)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gyms (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name              text        NOT NULL,
  slug              text        UNIQUE,                    -- URL-friendly identifier
  logo_url          text,
  primary_color     text        NOT NULL DEFAULT '#7c3aed',
  accent_color      text        NOT NULL DEFAULT '#2563eb',
  -- SaaS Subscription
  plan_id           text        NOT NULL DEFAULT 'starter'
                                CHECK (plan_id IN ('starter','pro','elite')),
  plan_status       text        NOT NULL DEFAULT 'trial'
                                CHECK (plan_status IN ('trial','active','past_due','suspended','cancelled')),
  plan_expires_at   timestamptz,
  saas_mp_pref_id   text,                                  -- Last MP preference ID (SaaS payment)
  saas_mp_payment_id text,                                 -- Last MP payment ID (SaaS payment)
  -- Tenant Mercado Pago credentials (Flow 2 B2C)
  mp_access_token   text,                                  -- Gym owner's MP access token
  mp_public_key     text,                                  -- Gym owner's MP public key (for frontend)
  -- Fiscal config
  tax_region        text        NOT NULL DEFAULT 'MX'
                                CHECK (tax_region IN ('MX','AR','CL','CO','PE')),
  rfc               text,                                  -- MX: RFC for CFDI
  razon_social      text,                                  -- MX: Razón social for CFDI
  regimen_fiscal    text,                                  -- MX: Régimen fiscal code
  -- Localization
  currency          text        NOT NULL DEFAULT 'MXN',
  timezone          text        NOT NULL DEFAULT 'America/Mexico_City',
  country_code      text        NOT NULL DEFAULT 'MX',
  -- Feature flags
  features          jsonb       NOT NULL DEFAULT
    '{"fitcoins":true,"waitlist":true,"fiscal":true,"qrAccess":true}'::jsonb,
  -- Audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for fast owner lookups
CREATE INDEX IF NOT EXISTS gyms_owner_id_idx ON public.gyms(owner_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION B: ADD gym_id TO EXISTING TABLES (if not present)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;

-- (classes, bookings, orders, order_items, fitcoins, leads, waitlist, access_logs
-- should already have gym_id from previous schema — add only if missing)

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

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION C: ROW LEVEL SECURITY (RLS) — Tenant Isolation
-- ──────────────────────────────────────────────────────────────────────────────
-- Each policy compares table.gym_id to the gym_id injected into the JWT
-- by the Custom JWT Hook below. This makes isolation database-enforced,
-- not just application-layer logic.

-- gyms: owner can only see & edit their own gym
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_owner_read_own" ON public.gyms
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "gym_owner_update_own" ON public.gyms
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Helper macro — used in all tenant tables
-- Reads gym_id from the JWT claim injected by custom_access_token_hook
-- (falls back to profile lookup for service_role bypass)

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.memberships
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.classes
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.bookings
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- orders (members see only their gym's orders; admins of that gym see all)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.orders
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- fitcoins
ALTER TABLE public.fitcoins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.fitcoins
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- leads (admin/coach only)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.leads
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION D: CUSTOM JWT HOOK — Inject gym_id into every session token
-- ──────────────────────────────────────────────────────────────────────────────
-- After applying this SQL, go to:
--   Supabase Dashboard → Auth → Hooks
--   → "Customize Access Token (JWT) Claim"
--   → Select: public.custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- prevents search_path injection attacks
AS $$
DECLARE
  claims      jsonb;
  user_id     uuid;
  user_gym_id uuid;
  user_role   text;
BEGIN
  user_id := (event ->> 'user_id')::uuid;

  -- Fetch gym_id and role from profiles
  SELECT p.gym_id, p.role
  INTO user_gym_id, user_role
  FROM public.profiles p
  WHERE p.id = user_id;

  claims := event -> 'claims';

  -- Inject gym_id (null if user has no profile yet — e.g. during onboarding)
  IF user_gym_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(user_gym_id));
  END IF;

  -- Inject app role (used for RBAC in RLS policies)
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant only to supabase_auth_admin (Supabase's internal auth service)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION E: ATOMIC RPCs (SECURITY DEFINER — bypass RLS for atomic ops)
-- ──────────────────────────────────────────────────────────────────────────────

-- book_class: decrement credits, increment enrollment — atomically
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
  -- Lock: get class for update
  SELECT * INTO v_class FROM public.classes
  WHERE id = p_class_id AND gym_id = p_gym_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'class_not_found');
  END IF;

  IF v_class.current_enrolled >= v_class.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'class_full');
  END IF;

  -- Check user credits
  SELECT * INTO v_profile FROM public.profiles
  WHERE id = p_user_id AND gym_id = p_gym_id FOR UPDATE;

  IF NOT FOUND OR v_profile.credits < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  -- Check not already booked
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE class_id = p_class_id AND user_id = p_user_id
      AND gym_id = p_gym_id AND status = 'confirmed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_booked');
  END IF;

  -- Create booking
  INSERT INTO public.bookings (user_id, class_id, gym_id, status)
  VALUES (p_user_id, p_class_id, p_gym_id, 'confirmed')
  RETURNING id INTO v_booking_id;

  -- Deduct credit
  UPDATE public.profiles SET credits = credits - 1
  WHERE id = p_user_id AND gym_id = p_gym_id;

  -- Increment enrollment
  UPDATE public.classes SET current_enrolled = current_enrolled + 1
  WHERE id = p_class_id AND gym_id = p_gym_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'credits_remaining', v_profile.credits - 1
  );
END;
$$;

-- cancel_booking: refund credit if >2h before class
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

  -- Refund if cancelled more than 2 hours before class
  IF v_class.start_time > now() + interval '2 hours' THEN
    UPDATE public.profiles SET credits = credits + 1
    WHERE id = p_user_id AND gym_id = p_gym_id;
    v_refund := true;
  END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
  WHERE id = p_booking_id;

  UPDATE public.classes SET current_enrolled = GREATEST(current_enrolled - 1, 0)
  WHERE id = v_booking.class_id AND gym_id = p_gym_id;

  -- Promote first waitlist member if any
  WITH promoted AS (
    SELECT id, user_id FROM public.waitlist
    WHERE class_id = v_booking.class_id AND gym_id = p_gym_id AND status = 'waiting'
    ORDER BY position ASC LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.waitlist SET status = 'promoted', notified_at = now()
  WHERE id = (SELECT id FROM promoted);

  RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END;
$$;

-- join_waitlist
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
  -- Check not already in waitlist
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

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION F: INVOICES TABLE (for CFDI/AFIP/SII receipts)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        REFERENCES public.orders(id),
  user_id     uuid        REFERENCES auth.users(id),
  gym_id      uuid        REFERENCES public.gyms(id) ON DELETE CASCADE,
  tax_region  text        NOT NULL DEFAULT 'MX',
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','issued','cancelled','error')),
  cfdi_uuid   text,        -- MX: UUID del CFDI 4.0
  afip_cae    text,        -- AR: CAE de AFIP
  sii_folio   text,        -- CL: Folio SII
  subtotal    numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount  numeric(10,2) NOT NULL DEFAULT 0,
  total       numeric(10,2) NOT NULL DEFAULT 0,
  pdf_url     text,
  xml_url     text,
  issued_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.invoices
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- DONE — Next step: In Supabase Dashboard → Auth → Hooks
--         Set "Customize Access Token (JWT) Claim" to custom_access_token_hook
-- ──────────────────────────────────────────────────────────────────────────────
