# Grind Project - Comprehensive Testing Guide

This guide walks you through testing all the fixes to ensure the gym creation bug is resolved and multitenancy security is working correctly.

---

## Prerequisites

Before testing, ensure you've completed:

- [ ] Phase 1: Applied SQL migrations (`001_create_gyms_and_rls.sql`, `002_dashboard_stats.sql`)
- [ ] Phase 1: Activated JWT hook in Supabase Auth → Hooks
- [ ] Phase 3-4: Code changes deployed (register.tsx, booking.server.ts, gamification.server.ts, gym.server.ts)
- [ ] Phase 5: Created indexes (`CREATE_INDEXES.sql`)

---

## Test Suite Overview

1. **Database Verification** - Confirm schema is correct
2. **JWT Hook Verification** - Ensure gym_id is in JWT claims
3. **Gym Creation (Onboarding)** - Critical bug fix test
4. **Member Registration** - Security vulnerability fix test
5. **RLS Tenant Isolation** - Cross-tenant access prevention
6. **Resource Ownership Validation** - Prevent unauthorized modifications
7. **Performance** - Verify indexes are being used

---

## Test 1: Database Verification

### Steps

1. Open Supabase Dashboard → SQL Editor
2. Open `frontend/VERIFY_DATABASE.sql`
3. Copy all contents and paste into SQL Editor
4. Click **RUN**

### Expected Results

**CHECK 1** - `gyms_table_exists`: `true`
**CHECK 2** - `jwt_hook_exists`: `true`
**CHECK 3** - Tables with gym_id: Should list at least:
```
bookings
classes
fitcoins
invoices
leads
memberships
orders
profiles
waitlist
```

**CHECK 4** - RLS policies on gyms: Should show:
```
gym_owner_read_own
gym_owner_update_own
```

**CHECK 5** - Tenant isolation policies: Should show `tenant_isolation` policy on multiple tables

**CHECK 6** - RPC functions: Should show:
```
book_class
cancel_booking
custom_access_token_hook
join_waitlist
```

**CHECK 7** - Stats tables: Should show:
```
gym_stats
user_stats
```

**CHECK 8** - RLS enabled: All tables should have `rls_enabled = true`

**CHECK 9** - Gyms table structure: Should show columns including:
- id, owner_id, name, slug
- plan_id, plan_status, plan_expires_at
- mp_access_token, mp_public_key
- tax_region, rfc, razon_social
- currency, timezone, country_code
- features (jsonb)

**CHECK 10** - Existing gyms count: Shows how many gyms already exist

### ✅ Pass Criteria

All checks return expected values. If any check fails, revisit Phase 1 migration steps.

---

## Test 2: JWT Hook Verification

### Purpose

Verify that the custom JWT hook is injecting `gym_id` into session tokens.

### Steps

#### Option A: Manual Test via Frontend

1. Create a test user with gym assignment:
```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('test-jwt@example.com', crypt('Test1234!', gen_salt('bf')), now())
RETURNING id;

-- Copy the returned user ID, then update their profile:
UPDATE profiles
SET gym_id = (SELECT id FROM gyms LIMIT 1),
    role = 'member',
    full_name = 'JWT Test User'
WHERE id = '<paste-user-id-here>';
```

2. Login via frontend: `/auth/login`
   - Email: `test-jwt@example.com`
   - Password: `Test1234!`

3. Open Browser DevTools → Console

4. Run this code:
```javascript
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
console.log('Access Token:', token);
```

5. Copy the token and go to [https://jwt.io](https://jwt.io)

6. Paste the token in the "Encoded" section

7. In the "Payload" section (right side), verify you see:
```json
{
  "aud": "authenticated",
  "exp": 1234567890,
  "sub": "user-uuid-here",
  "email": "test-jwt@example.com",
  "gym_id": "uuid-of-gym",
  "app_role": "member",
  ...
}
```

#### Option B: SQL Query Test

```sql
-- Simulate JWT hook execution
SELECT public.custom_access_token_hook(
    jsonb_build_object(
        'user_id', (SELECT id FROM auth.users WHERE email = 'test-jwt@example.com'),
        'claims', '{}'::jsonb
    )
);
```

**Expected:** Should return JSON with `gym_id` and `app_role` in the claims object.

### ✅ Pass Criteria

- JWT payload contains `gym_id` field with a valid UUID
- JWT payload contains `app_role` field with value `"member"` or `"admin"`

### ❌ Fail Actions

If `gym_id` is missing:
1. Verify hook is enabled: Supabase Dashboard → Auth → Hooks → "Customize Access Token (JWT) Claim" should be green
2. Check user profile has gym_id: `SELECT gym_id FROM profiles WHERE email = 'test-jwt@example.com';`
3. Logout and login again (JWT is only updated on fresh login)

---

## Test 3: Gym Creation (Onboarding Flow)

### Purpose

Test that the critical bug is fixed - new gyms can be created successfully.

### Pre-Test Cleanup

```sql
-- Delete any existing test gyms (optional - only in dev/staging)
DELETE FROM public.gyms WHERE name LIKE '%Test Studio%';
```

### Steps

1. Open your app in browser
2. Navigate to `/onboarding`
3. Fill Step 1 - Plan Selection:
   - Select any plan (e.g., Pro)
   - Check "Acepto términos y condiciones"
   - Click "Siguiente"

4. Fill Step 2 - Studio Information:
   - Studio Name: `Test Studio Alpha`
   - Studio Type: `Pilates`
   - Country: `MX`
   - City: `Ciudad de México`
   - Phone: `+52 55 1234 5678` (optional)
   - Click "Siguiente"

5. Fill Step 3 - Account Creation:
   - Owner Name: `Carlos Test`
   - Email: `owner-test-1@test.com`
   - Password: `Test1234!`
   - Confirm Password: `Test1234!`
   - Click "Siguiente"

6. Step 4 - Payment:
   - **Skip for testing** (or fill if testing payment integration)
   - Click "Finalizar"

7. Should redirect to `/admin` with no errors

### Verification in Database

```sql
-- Verify user was created
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'owner-test-1@test.com';

-- Verify gym was created
SELECT g.id, g.name, g.slug, g.owner_id, g.plan_id, g.plan_status, g.features
FROM public.gyms g
JOIN auth.users u ON u.id = g.owner_id
WHERE u.email = 'owner-test-1@test.com';

-- Verify profile has gym_id
SELECT id, email, role, gym_id, full_name
FROM public.profiles
WHERE email = 'owner-test-1@test.com';

-- Verify gym_stats was initialized
SELECT gs.*
FROM public.gym_stats gs
WHERE gs.gym_id = (SELECT gym_id FROM profiles WHERE email = 'owner-test-1@test.com');
```

### ✅ Pass Criteria

- All 4 queries return data (no empty results)
- Gym `plan_status` = `'trial'`
- Gym `features` contains: `{"fiscal": true, "fitcoins": true, "qrAccess": true, "waitlist": true}`
- Profile `role` = `'admin'`
- Profile `gym_id` matches the created gym's `id`
- No console errors in browser DevTools
- Redirected to `/admin` successfully

### ❌ Fail Actions

**Error: "relation 'public.gyms' does not exist"**
- SQL migrations not applied → Go back to Phase 1

**Error: "Error en Base de Datos: [details]"**
- Check constraint violations (e.g., invalid tax_region)
- Check unique constraint on slug (unlikely but possible)

**Error: "Timeout: La operación tardó demasiado tiempo"**
- n8n webhook might be failing (non-critical - gym still created)
- Check n8n logs

---

## Test 4: Member Registration with Gym Slug

### Purpose

Verify that member registration no longer uses DEFAULT_GYM_ID and requires valid gym slug.

### Steps

#### Step A: Get a Gym Slug

```sql
-- Get slug from a test gym
SELECT slug, name FROM public.gyms LIMIT 1;
-- Example result: slug = "test-studio-alpha-x7k2"
```

#### Step B: Register New Member

1. Navigate to `/auth/register`
2. Fill form:
   - **Código de Estudio**: `test-studio-alpha-x7k2` (use actual slug from Step A)
   - Nombre Completo: `María Test`
   - Email: `member-test-1@test.com`
   - Password: `Test1234!`
3. Click "Crear mi perfil"
4. Should redirect to `/dashboard` with no errors

#### Step C: Verify Correct Gym Assignment

```sql
-- Verify member was assigned to correct gym
SELECT
    p.id,
    p.email,
    p.role,
    p.gym_id,
    g.name as gym_name,
    g.slug as gym_slug
FROM public.profiles p
JOIN public.gyms g ON g.id = p.gym_id
WHERE p.email = 'member-test-1@test.com';
```

**Expected:**
- `role` = `'member'`
- `gym_id` matches the gym with slug `test-studio-alpha-x7k2`
- `gym_slug` = `'test-studio-alpha-x7k2'`

#### Step D: Test Invalid Slug Rejection

1. Navigate to `/auth/register` (logout first if needed)
2. Fill form with **invalid** gym slug: `fake-gym-12345`
3. Click "Crear mi perfil"
4. Should show error: "Código de estudio inválido. Verifica con tu gimnasio."

### ✅ Pass Criteria

- Member assigned to correct gym (NOT DEFAULT_GYM_ID)
- Invalid slugs are rejected with clear error message
- Suspended/cancelled gyms are rejected

### ❌ Fail Actions

If member is assigned to DEFAULT_GYM_ID:
- Code changes not deployed → Verify `auth/register.tsx` was updated
- Clear browser cache and retry

---

## Test 5: RLS Tenant Isolation

### Purpose

Verify that Row Level Security policies prevent cross-tenant data access.

### Setup

Create two test gyms if you don't have them:

```sql
-- Gym A
INSERT INTO public.gyms (name, slug, plan_id, plan_status, tax_region, country_code, currency)
VALUES ('Gym A Test', 'gym-a-test', 'pro', 'active', 'MX', 'MX', 'MXN')
RETURNING id;

-- Gym B
INSERT INTO public.gyms (name, slug, plan_id, plan_status, tax_region, country_code, currency)
VALUES ('Gym B Test', 'gym-b-test', 'pro', 'active', 'MX', 'MX', 'MXN')
RETURNING id;
```

### Test Case 1: Classes Isolation

```sql
-- Insert class for Gym A
INSERT INTO public.classes (
    title,
    gym_id,
    coach_id,
    capacity,
    start_time,
    end_time
)
VALUES (
    'Yoga A Only',
    (SELECT id FROM gyms WHERE slug = 'gym-a-test'),
    (SELECT id FROM auth.users WHERE email = 'owner-test-1@test.com'),
    10,
    now() + interval '1 hour',
    now() + interval '2 hours'
);

-- Simulate RLS check for Gym B user trying to access Gym A's class
SELECT set_config('request.jwt.claims',
    json_build_object(
        'gym_id', (SELECT id FROM gyms WHERE slug = 'gym-b-test')
    )::text,
    true
);

-- Try to query Gym A's classes (should return empty)
SELECT * FROM public.classes
WHERE gym_id = (SELECT id FROM gyms WHERE slug = 'gym-a-test');
```

**Expected:** Empty result (RLS blocked the query)

### Test Case 2: Frontend RLS Test

1. **Login as Gym A owner** → Navigate to `/admin/schedule`
2. You should see "Yoga A Only" class
3. **Logout and login as Gym B owner** → Navigate to `/admin/schedule`
4. You should **NOT** see "Yoga A Only" class

### ✅ Pass Criteria

- SQL query returns empty result when simulating cross-tenant access
- Frontend shows only classes belonging to the logged-in user's gym
- Same isolation works for bookings, orders, memberships, etc.

---

## Test 6: Resource Ownership Validation

### Purpose

Verify that `validateGymOwnership` prevents users from modifying resources from other gyms.

### Setup

Create a booking for Gym A:

```sql
-- Create a test booking for Gym A
INSERT INTO public.bookings (
    user_id,
    class_id,
    gym_id,
    status
)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'owner-test-1@test.com'),
    (SELECT id FROM classes WHERE title = 'Yoga A Only' LIMIT 1),
    (SELECT id FROM gyms WHERE slug = 'gym-a-test'),
    'confirmed'
)
RETURNING id;
-- Copy the returned booking ID
```

### Test Case: Cross-Tenant Booking Cancellation

1. **Login as Gym B owner**
2. Open Browser DevTools → Console
3. Get Gym A's booking ID from SQL above (e.g., `'abc-123-def'`)
4. Try to cancel it via fetch:
```javascript
await fetch('/dashboard/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'intent=cancel_booking&booking_id=<paste-gym-a-booking-id-here>'
});
```

**Expected Response:**
```json
{
  "error": "Reserva no encontrada"
}
```

5. Check server logs - should see:
```
[SECURITY VIOLATION] Cross-tenant access attempt detected!
  Table: bookings
  Resource ID: <booking-id>
  Expected gym_id: <gym-b-id>
  Actual gym_id: <gym-a-id>
```

### ✅ Pass Criteria

- Request returns 404 error
- Booking is NOT deleted
- Security violation logged to console

---

## Test 7: Performance Verification

### Purpose

Verify that database indexes are being used for queries.

### Run EXPLAIN ANALYZE

```sql
-- Test query performance with indexes
EXPLAIN ANALYZE
SELECT * FROM bookings WHERE gym_id = (SELECT id FROM gyms LIMIT 1);
```

**Expected plan:**
```
Index Scan using idx_bookings_gym_id on bookings
  Planning Time: 0.1 ms
  Execution Time: 1-5 ms
```

**Bad plan (if indexes missing):**
```
Seq Scan on bookings
  Execution Time: 50-200 ms
```

### Verify Indexes Exist

```sql
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Expected:** Should list ~30 indexes including:
- `idx_bookings_gym_id`
- `idx_classes_gym_id`
- `idx_profiles_gym_id`
- etc.

---

## Security Checklist

Run through this final checklist:

- [ ] SQL migrations applied successfully
- [ ] JWT hook active and injecting `gym_id`
- [ ] Gym creation works (onboarding test passed)
- [ ] Member registration requires gym_slug
- [ ] RLS blocks cross-tenant queries
- [ ] `validateGymOwnership` prevents unauthorized modifications
- [ ] Indexes exist and are being used
- [ ] No DEFAULT_GYM_ID found in:
  - `auth/register.tsx`
  - `booking.server.ts`
  - `gamification.server.ts`
- [ ] All dashboard routes use `requireGymAuth`
- [ ] All admin routes use `requireGymAdmin`

---

## Common Issues & Troubleshooting

### Issue: "User profile has no gym_id assigned"

**Cause:** Profile wasn't updated during registration
**Fix:**
```sql
UPDATE profiles
SET gym_id = (SELECT id FROM gyms WHERE slug = 'your-gym-slug')
WHERE email = 'user@example.com';
```

### Issue: RLS is blocking all queries

**Cause:** Using anon key instead of service role key in server code
**Fix:** Ensure server-side code uses `supabaseAdmin` (with service role key)

### Issue: JWT doesn't update after login

**Cause:** Browser cached old token
**Fix:** Clear browser storage, logout, and login again

---

## Success Criteria Summary

After completing all tests:

✅ Database schema verified and complete
✅ JWT hook active and working
✅ Gym creation successful (onboarding works)
✅ Member registration secure (requires gym_slug)
✅ RLS enforcing tenant isolation
✅ Resource ownership validation preventing cross-tenant modifications
✅ Performance indexes active and improving query speed
✅ No security vulnerabilities detected

**Status:** Production-ready for multitenant SaaS deployment ✅
