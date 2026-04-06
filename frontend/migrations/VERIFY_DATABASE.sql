-- ============================================================================
-- GRIND PROJECT: DATABASE VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: Verify that SQL migrations have been applied to Supabase
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Expected results if migrations are applied:
--   - All checks should return 'true' or show expected table names
--   - If any return 'false' or empty, migrations need to be applied
-- ============================================================================

-- CHECK 1: Verify gyms table exists
-- Expected: true
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'gyms'
) AS "gyms_table_exists";

-- CHECK 2: Verify custom JWT hook function exists
-- Expected: true
SELECT EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'custom_access_token_hook'
) AS "jwt_hook_exists";

-- CHECK 3: List all tables with gym_id column (tenant tables)
-- Expected: profiles, classes, bookings, orders, memberships, fitcoins, leads, waitlist
SELECT table_name
FROM information_schema.columns
WHERE column_name = 'gym_id'
AND table_schema = 'public'
ORDER BY table_name;

-- CHECK 4: Verify RLS policies exist on gyms table
-- Expected: gym_owner_read_own, gym_owner_update_own
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'gyms'
ORDER BY policyname;

-- CHECK 5: Verify tenant isolation RLS policies on other tables
-- Expected: tenant_isolation policy on multiple tables
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND policyname = 'tenant_isolation'
ORDER BY tablename;

-- CHECK 6: Verify atomic RPC functions exist
-- Expected: book_class, cancel_booking, join_waitlist
SELECT proname AS function_name
FROM pg_proc
WHERE proname IN ('book_class', 'cancel_booking', 'join_waitlist', 'custom_access_token_hook')
ORDER BY proname;

-- CHECK 7: Verify gym_stats and user_stats tables exist
-- Expected: Both should exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('gym_stats', 'user_stats')
ORDER BY table_name;

-- CHECK 8: Check if RLS is enabled on all tenant tables
-- Expected: All tenant tables should have rls_enabled = true
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('gyms', 'profiles', 'classes', 'bookings', 'orders', 'memberships', 'fitcoins', 'leads', 'waitlist')
ORDER BY tablename;

-- CHECK 9: Verify gyms table structure
-- Expected: Should show all columns including owner_id, plan_id, mp_access_token, features (jsonb), etc.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'gyms'
ORDER BY ordinal_position;

-- CHECK 10: Count existing gyms (if any)
-- This shows how many gym records already exist
SELECT
    COUNT(*) AS total_gyms,
    COUNT(CASE WHEN plan_status = 'active' THEN 1 END) AS active_gyms,
    COUNT(CASE WHEN plan_status = 'trial' THEN 1 END) AS trial_gyms
FROM public.gyms;

-- ============================================================================
-- INTERPRETATION GUIDE:
-- ============================================================================
--
-- If CHECK 1-2 return FALSE:
--   → Migrations NOT applied - you MUST run 001_create_gyms_and_rls.sql
--
-- If CHECK 3 returns < 7 tables:
--   → Some tables don't have gym_id column - verify migrations
--
-- If CHECK 4-5 return no policies:
--   → RLS policies NOT created - run 001_create_gyms_and_rls.sql
--
-- If CHECK 6 returns < 4 functions:
--   → Atomic RPC functions missing - run 001_create_gyms_and_rls.sql
--
-- If CHECK 7 returns < 2 tables:
--   → Stats tables missing - run 002_dashboard_stats.sql
--
-- If CHECK 8 shows rls_enabled = false for any table:
--   → RLS not enabled - migrations may have failed partially
--
-- If ALL checks pass:
--   → Database schema is correct! Proceed to JWT hook activation
-- ============================================================================
