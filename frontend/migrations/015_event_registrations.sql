-- Migration 015: event_registrations table
-- Tracks user registrations / purchases for exclusive events

CREATE TABLE IF NOT EXISTS public.event_registrations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlist')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_id)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Gym admin can see all registrations for their gym
CREATE POLICY "gym_admin_all" ON public.event_registrations
    FOR ALL
    USING (
        gym_id IN (
            SELECT gym_id FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'coach', 'front_desk')
        )
    );

-- Users can see their own registrations
CREATE POLICY "user_own" ON public.event_registrations
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own registrations
CREATE POLICY "user_insert" ON public.event_registrations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_event_regs_gym      ON public.event_registrations(gym_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_event    ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_user     ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_regs_user_ev  ON public.event_registrations(user_id, event_id);
