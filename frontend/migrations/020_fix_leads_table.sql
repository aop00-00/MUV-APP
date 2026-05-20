-- 020_fix_leads_table.sql
-- Recreate leads table with all required columns if missing columns exist.

-- Add missing columns if they don't exist (safe to run multiple times)
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'new'
        CHECK (stage IN ('new', 'contacted', 'trial', 'converted', 'lost')),
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
        CHECK (source IN ('instagram', 'referral', 'web', 'walk_in', 'facebook', 'google')),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS days_in_stage INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS engagement_score INT DEFAULT 50,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure RLS is enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy for gym admins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'gym_admin_leads'
    ) THEN
        CREATE POLICY "gym_admin_leads" ON public.leads
            FOR ALL
            USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
