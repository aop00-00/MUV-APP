-- ============================================================================
-- GRIND PROJECT: PERFORMANCE INDEXES
-- ============================================================================
-- Purpose: Optimize gym_id filtering queries across all tenant tables
-- Run this in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Uses CONCURRENTLY to avoid locking tables (safe for production)
-- Expected duration: 30-60 seconds for all indexes
-- ============================================================================

-- ============================================================================
-- SECTION A: PRIMARY GYM_ID INDEXES
-- ============================================================================
-- These indexes speed up all queries filtering by gym_id (99% of app queries)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_gym_id
    ON public.profiles(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_classes_gym_id
    ON public.classes(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_gym_id
    ON public.bookings(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_gym_id
    ON public.orders(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_gym_id
    ON public.memberships(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fitcoins_gym_id
    ON public.fitcoins(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_gym_id
    ON public.leads(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_gym_id
    ON public.waitlist(gym_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_gym_id
    ON public.invoices(gym_id);

-- ============================================================================
-- SECTION B: COMPOSITE INDEXES (Most Common Query Patterns)
-- ============================================================================
-- These optimize queries that filter by multiple columns

-- User bookings query: WHERE user_id = X AND gym_id = Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_gym
    ON public.bookings(user_id, gym_id);

-- Class schedule query: WHERE gym_id = X AND start_time >= Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_classes_gym_time
    ON public.classes(gym_id, start_time);

-- User memberships query: WHERE user_id = X AND gym_id = Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_user_gym
    ON public.memberships(user_id, gym_id);

-- FitCoins history query: WHERE user_id = X AND gym_id = Y ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fitcoins_user_gym_created
    ON public.fitcoins(user_id, gym_id, created_at DESC);

-- Active bookings query: WHERE gym_id = X AND status = 'confirmed'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_gym_status
    ON public.bookings(gym_id, status);

-- Waitlist position query: WHERE class_id = X AND gym_id = Y AND status = 'waiting'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waitlist_class_gym_status
    ON public.waitlist(class_id, gym_id, status);

-- ============================================================================
-- SECTION C: LOOKUP INDEXES
-- ============================================================================
-- These optimize specific lookup patterns

-- Gym slug lookup (for member registration): WHERE slug = 'studio-abc'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gyms_slug
    ON public.gyms(slug);

-- Profile email lookup: WHERE email = 'user@example.com'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email
    ON public.profiles(email);

-- Order by Mercado Pago preference ID: WHERE mp_preference_id = 'xxx'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_mp_pref
    ON public.orders(mp_preference_id);

-- Invoice by CFDI UUID (Mexico): WHERE cfdi_uuid = 'xxx'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_cfdi_uuid
    ON public.invoices(cfdi_uuid);

-- ============================================================================
-- SECTION D: STATUS/STATE INDEXES
-- ============================================================================
-- These optimize filtering by status fields

-- Active gyms: WHERE plan_status = 'active'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gyms_plan_status
    ON public.gyms(plan_status);

-- Trial expiring gyms: WHERE plan_status = 'trial' AND plan_expires_at < NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gyms_trial_expiry
    ON public.gyms(plan_status, plan_expires_at)
    WHERE plan_status = 'trial';

-- Active memberships: WHERE status = 'active' AND end_date > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_active
    ON public.memberships(status, end_date)
    WHERE status = 'active';

-- ============================================================================
-- SECTION E: AUDIT/TIMESTAMP INDEXES
-- ============================================================================
-- These optimize queries sorting or filtering by timestamps

-- Recent leads: WHERE gym_id = X ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_gym_created
    ON public.leads(gym_id, created_at DESC);

-- Recent orders: WHERE gym_id = X ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_gym_created
    ON public.orders(gym_id, created_at DESC);

-- Profile updates: ORDER BY updated_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_updated
    ON public.profiles(updated_at DESC);

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this after creating indexes to verify they exist:

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected: Should show ~30 indexes starting with 'idx_'

-- ============================================================================
-- PERFORMANCE IMPACT
-- ============================================================================
--
-- Before indexes:
--   - Query: SELECT * FROM bookings WHERE gym_id = 'xxx'
--   - Plan: Seq Scan (scans entire table)
--   - Time: 50-200ms on 10k rows
--
-- After indexes:
--   - Query: SELECT * FROM bookings WHERE gym_id = 'xxx'
--   - Plan: Index Scan using idx_bookings_gym_id
--   - Time: 1-5ms on 10k rows
--
-- Performance improvement: 10-100x faster for most queries
-- ============================================================================

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================
--
-- Index size: Each index adds ~5-10% to table size (acceptable trade-off)
-- Maintenance: Indexes are auto-updated on INSERT/UPDATE/DELETE
-- Rebuild: Rarely needed (Postgres handles this automatically)
--
-- To check index usage statistics:
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;
-- ============================================================================
