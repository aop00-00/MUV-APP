-- Migration 030: Churn risk v2
-- Fixes:
--   1. gym_id filter pushed into SQL (no más client-side filtering)
--   2. Considera access_logs Y bookings — la actividad más reciente de ambas fuentes
--   3. Ordena por urgencia: primero inactivos con membresía próxima a vencer
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

CREATE OR REPLACE FUNCTION public.get_churn_risk_users(
    days_threshold  INT  DEFAULT 7,
    p_gym_id        UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id             UUID,
    gym_id              UUID,
    first_name          TEXT,
    phone               TEXT,
    email               TEXT,
    days_inactive       INT,
    days_until_expiry   INT,
    membership_id       UUID
)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT
        p.id                                                                AS user_id,
        m.gym_id                                                            AS gym_id,
        SPLIT_PART(p.full_name, ' ', 1)                                     AS first_name,
        p.phone,
        p.email,
        -- días desde la actividad más reciente entre bookings y access_logs
        COALESCE(
            EXTRACT(day FROM NOW() - GREATEST(
                MAX(b.created_at),
                MAX(al.created_at)
            ))::INT,
            999
        )                                                                   AS days_inactive,
        GREATEST(0, EXTRACT(day FROM m.end_date - NOW())::INT)              AS days_until_expiry,
        m.id                                                                AS membership_id
    FROM public.memberships m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.bookings b
        ON  b.user_id = m.user_id
        AND b.gym_id  = m.gym_id
        AND b.status  = 'confirmed'
    LEFT JOIN public.access_logs al
        ON  al.user_id      = m.user_id
        AND al.gym_id       = m.gym_id
        AND al.access_type  = 'entry'
    WHERE m.status = 'active'
      AND (p_gym_id IS NULL OR m.gym_id = p_gym_id)
    GROUP BY p.id, p.full_name, p.phone, p.email, m.gym_id, m.end_date, m.id
    HAVING
        COALESCE(
            EXTRACT(day FROM NOW() - GREATEST(MAX(b.created_at), MAX(al.created_at)))::INT,
            999
        ) >= days_threshold
    -- urgencia: membresía próxima a vencer + más inactivos primero
    ORDER BY days_until_expiry ASC, days_inactive DESC;
$$;
