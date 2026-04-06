# Grind Project - Database Migration Guide

## Quick Start: Fix Gym Creation Bug

Follow these steps to get your database ready and fix the critical onboarding bug.

---

## Phase 1: Verify Current Database State

### Step 1: Run Verification Script

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Open `VERIFY_DATABASE.sql` in this directory
6. Copy all contents and paste into Supabase SQL Editor
7. Click **RUN** (bottom right)

### Step 2: Interpret Results

The script runs 10 checks. Review the output:

**✅ ALL CHECKS PASS** → Database is ready! Skip to [Phase 2: Activate JWT Hook](#phase-2-activate-jwt-hook)

**❌ ANY CHECK FAILS** → Continue to Step 3

### Step 3: Apply Missing Migrations

If verification failed, apply the SQL migrations:

#### Migration 001: Core Schema + RLS Policies

1. Open `001_create_gyms_and_rls.sql` in your code editor
2. Copy the **entire file** (all 406 lines)
3. In Supabase SQL Editor, create a **New Query**
4. Paste the contents
5. Click **RUN**
6. Wait for completion (should take 5-10 seconds)
7. Verify success message: "Success. No rows returned"

**What this creates:**
- `gyms` table (core tenant entity)
- RLS policies for tenant isolation
- Custom JWT hook function
- Atomic RPC functions (book_class, cancel_booking, join_waitlist)
- Foreign key constraints and triggers

#### Migration 002: Dashboard Stats Tables

1. Open `002_dashboard_stats.sql` in your code editor
2. Copy the **entire file** (all 230 lines)
3. In Supabase SQL Editor, create a **New Query**
4. Paste the contents
5. Click **RUN**
6. Verify success message

**What this creates:**
- `gym_stats` table (aggregated gym metrics)
- `user_stats` table (user analytics)
- RLS policies for stats tables

### Step 4: Re-run Verification

After applying migrations, run `VERIFY_DATABASE.sql` again to confirm all checks pass.

---

## Phase 2: Activate JWT Hook

**CRITICAL:** This step enables database-level tenant isolation.

### Step 1: Access Auth Hooks

1. In Supabase Dashboard, navigate to **Authentication** → **Hooks** (left sidebar)
2. Find the section: **"Customize Access Token (JWT) Claim"**

### Step 2: Enable the Hook

1. Click **Enable Hook** button
2. In the dropdown, select: `public.custom_access_token_hook`
3. Click **Save**
4. Verify you see a green checkmark next to "Customize Access Token (JWT) Claim"

**What this does:**
- Every time a user logs in, Supabase calls this function
- The function fetches the user's `gym_id` from the `profiles` table
- It injects `gym_id` and `app_role` into the JWT token claims
- RLS policies can now read `auth.jwt() ->> 'gym_id'` to enforce tenant isolation

### Step 3: Verify JWT Hook is Working

After enabling, test with a real login:

1. Create a test user or use an existing one
2. Login via your frontend (`/auth/login`)
3. Open browser DevTools → Console
4. Run this code:
```javascript
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
console.log('Access Token:', token);
// Copy the token
```
5. Go to [https://jwt.io](https://jwt.io)
6. Paste the token in the "Encoded" section
7. In the "Payload" section, verify you see:
```json
{
  ...
  "gym_id": "uuid-here",
  "app_role": "admin",
  ...
}
```

**If gym_id is missing:**
- Double-check the hook is enabled in Supabase dashboard
- Verify the user's profile has a `gym_id` set: `SELECT gym_id FROM profiles WHERE id = 'user-id';`
- Try logging out and logging in again (token is only updated on login)

---

## Phase 3: Create Performance Indexes (Optional but Recommended)

Run the index creation script to optimize queries:

1. Open `CREATE_INDEXES.sql` (will be created in next step)
2. Copy contents
3. Paste into Supabase SQL Editor
4. Click **RUN**

This adds indexes on `gym_id` columns for faster filtering.

---

## Common Issues & Troubleshooting

### Issue: "relation 'public.gyms' does not exist"

**Cause:** Migration 001 was not applied
**Fix:** Apply `001_create_gyms_and_rls.sql` as described above

### Issue: "function custom_access_token_hook does not exist"

**Cause:** Migration 001 was not applied OR hook is not enabled in Auth settings
**Fix:**
1. Apply `001_create_gyms_and_rls.sql`
2. Enable hook in Auth → Hooks

### Issue: JWT doesn't contain gym_id claim

**Possible causes:**
1. Hook not enabled in Supabase dashboard → Enable in Auth → Hooks
2. User's profile has no gym_id → Update profile: `UPDATE profiles SET gym_id = 'gym-uuid' WHERE id = 'user-id';`
3. Need to re-login → Logout and login again to get fresh token

### Issue: RLS policies blocking queries

**Cause:** Using anon key instead of service role key
**Fix:** Server-side queries should use `supabaseAdmin` (with service role key), which bypasses RLS

### Issue: "permission denied for table gyms"

**Cause:** Trying to query as authenticated user, but RLS policy blocks it
**Expected behavior:** This is correct! RLS should block queries that don't match the user's gym_id
**Fix:** Ensure queries are filtered by the user's gym_id, or use service role key

---

## Verification Checklist

Before proceeding to code implementation, verify:

- [ ] `VERIFY_DATABASE.sql` - all 10 checks pass
- [ ] Supabase Auth → Hooks - JWT hook enabled (green checkmark)
- [ ] Test JWT token contains `gym_id` and `app_role` claims
- [ ] Can view gyms table in Supabase Table Editor
- [ ] RLS policies visible: Table Editor → gyms → RLS icon
- [ ] At least one gym record exists for testing

---

## Next Steps

After completing Phase 1-2:

1. The onboarding bug should be fixed - test by going to `/onboarding` and creating a new gym
2. Proceed to code implementation (Phase 3-4) to eliminate security vulnerabilities
3. Run full test suite to verify tenant isolation

For detailed code changes, see the implementation plan at `.claude/plans/humble-wobbling-blanket.md`
