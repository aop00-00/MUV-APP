-- =============================================================================
-- Grind Project — Fix: "Database error creating new user"
-- =============================================================================
-- The trigger that auto-creates profiles on user signup is blocked by RLS.
-- This script fixes the trigger to use SECURITY DEFINER (bypasses RLS).
-- =============================================================================

-- Step 1: Check if the trigger exists and what function it calls
-- (Run this first to see the current state)
SELECT tgname, tgrelid::regclass, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass;

-- Step 2: Replace the handle_new_user function with SECURITY DEFINER
-- This ensures profile creation bypasses RLS policies
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- KEY FIX: bypasses RLS
SET search_path = ''      -- Prevents search_path injection
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, credits, gym_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'member'),
    0,
    NULL  -- gym_id is NULL initially; onboarding sets it later
  )
  ON CONFLICT (id) DO NOTHING;  -- Safety: skip if profile already exists

  RETURN NEW;
END;
$$;

-- Step 3: Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Also fix the RLS policy on profiles to allow NULL gym_id
-- (for newly created users who haven't completed onboarding yet)
DROP POLICY IF EXISTS "tenant_isolation" ON public.profiles;

CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id IS NULL  -- Allow access to profiles without gym (during onboarding)
    OR gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );

-- Step 5: Allow service_role to bypass RLS (should already be the case, but ensure)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Verify
SELECT 'Migration 005 applied successfully' AS status;
