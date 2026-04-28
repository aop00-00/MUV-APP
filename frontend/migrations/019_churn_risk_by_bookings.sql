-- Migration 019: Update get_churn_risk_users to use bookings instead of access_logs
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

CREATE OR REPLACE FUNCTION public.get_churn_risk_users(days_threshold INT DEFAULT 7)
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
        p.id                                                            AS user_id,
        m.gym_id                                                        AS gym_id,
        SPLIT_PART(p.full_name, ' ', 1)                                 AS first_name,
        p.phone,
        p.email,
        COALESCE(
            EXTRACT(day FROM NOW() - MAX(b.created_at))::INT,
            999
        )                                                               AS days_inactive,
        GREATEST(0, EXTRACT(day FROM m.end_date - NOW())::INT)          AS days_until_expiry,
        m.id                                                            AS membership_id
    FROM public.memberships m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.bookings b
        ON b.user_id = m.user_id
       AND b.gym_id  = m.gym_id
       AND b.status  = 'confirmed'
    WHERE m.status = 'active'
    GROUP BY p.id, p.full_name, p.phone, p.email, m.gym_id, m.end_date, m.id
    HAVING COALESCE(EXTRACT(day FROM NOW() - MAX(b.created_at))::INT, 999) >= days_threshold
    ORDER BY days_inactive DESC;
$$;
