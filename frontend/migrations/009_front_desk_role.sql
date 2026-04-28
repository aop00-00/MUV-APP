-- Migration 009: Add front_desk role and RLS policies
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ─── 0. Add front_desk to the user_role enum ─────────────────────────────────
-- The profiles.role column is an enum, not a plain TEXT.
-- This command is safe to run even if the value already exists (it will error — ignore that).
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'front_desk';

-- ─── 1. RLS Policies for front_desk ──────────────────────────────────────────
-- The JWT hook already injects app_role from profiles.role, so no hook changes needed.
-- We only need to add RLS policies for the tables front_desk staff needs to access.

-- Helper: check if requester is staff (owner/admin/front_desk) for their gym
-- Used inline in policies below.

-- ─── profiles: front_desk can read members of their gym ──────────────────────
DROP POLICY IF EXISTS "front_desk_read_profiles" ON public.profiles;
CREATE POLICY "front_desk_read_profiles" ON public.profiles
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── memberships: front_desk can read memberships of their gym ───────────────
DROP POLICY IF EXISTS "front_desk_read_memberships" ON public.memberships;
CREATE POLICY "front_desk_read_memberships" ON public.memberships
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── access_logs: front_desk can read + insert (check-in) ───────────────────
DROP POLICY IF EXISTS "front_desk_read_access_logs" ON public.access_logs;
CREATE POLICY "front_desk_read_access_logs" ON public.access_logs
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

DROP POLICY IF EXISTS "front_desk_insert_access_logs" ON public.access_logs;
CREATE POLICY "front_desk_insert_access_logs" ON public.access_logs
    FOR INSERT
    WITH CHECK (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── bookings: front_desk can read bookings of their gym ────────────────────
DROP POLICY IF EXISTS "front_desk_read_bookings" ON public.bookings;
CREATE POLICY "front_desk_read_bookings" ON public.bookings
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── classes: front_desk can read classes of their gym ──────────────────────
DROP POLICY IF EXISTS "front_desk_read_classes" ON public.classes;
CREATE POLICY "front_desk_read_classes" ON public.classes
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── products: front_desk can read products ─────────────────────────────────
DROP POLICY IF EXISTS "front_desk_read_products" ON public.products;
CREATE POLICY "front_desk_read_products" ON public.products
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── orders: front_desk can read + insert orders (POS) ──────────────────────
DROP POLICY IF EXISTS "front_desk_read_orders" ON public.orders;
CREATE POLICY "front_desk_read_orders" ON public.orders
    FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

DROP POLICY IF EXISTS "front_desk_insert_orders" ON public.orders;
CREATE POLICY "front_desk_insert_orders" ON public.orders
    FOR INSERT
    WITH CHECK (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── order_items: front_desk can read + insert ───────────────────────────────
DROP POLICY IF EXISTS "front_desk_read_order_items" ON public.order_items;
CREATE POLICY "front_desk_read_order_items" ON public.order_items
    FOR SELECT
    USING (
        (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

DROP POLICY IF EXISTS "front_desk_insert_order_items" ON public.order_items;
CREATE POLICY "front_desk_insert_order_items" ON public.order_items
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── profiles: front_desk can insert new profiles (walk-in) ─────────────────
DROP POLICY IF EXISTS "front_desk_insert_profiles" ON public.profiles;
CREATE POLICY "front_desk_insert_profiles" ON public.profiles
    FOR INSERT
    WITH CHECK (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── bookings: front_desk can insert bookings (walk-in class registration) ───
DROP POLICY IF EXISTS "front_desk_insert_bookings" ON public.bookings;
CREATE POLICY "front_desk_insert_bookings" ON public.bookings
    FOR INSERT
    WITH CHECK (
        gym_id = (auth.jwt() ->> 'gym_id')::uuid
        AND (auth.jwt() ->> 'app_role') IN ('owner', 'admin', 'front_desk')
    );

-- ─── 2. Verification ─────────────────────────────────────────────────────────
-- After running, verify with:
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies
-- WHERE policyname LIKE 'front_desk%' ORDER BY tablename, cmd;
