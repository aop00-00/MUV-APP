-- =============================================================================
-- Grind Project — Migration 002: Dashboard Stats Tables
-- =============================================================================
-- Tablas pre-computadas para que los dashboards lean UNA sola fila
-- en lugar de ejecutar múltiples queries en cada carga de página.
--
-- Ejecutar DESPUÉS de 001_create_gyms_and_rls.sql
-- En: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ─── 1. GYM_STATS — KPIs del Admin Dashboard ─────────────────────────────────
-- Actualizada por WF6 (CRON 15min).
-- El admin/_index.tsx lee esto en una sola query.

CREATE TABLE IF NOT EXISTS public.gym_stats (
    gym_id                UUID PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,

    -- Revenue
    mrr                   NUMERIC(12,2)   DEFAULT 0,
    today_revenue         NUMERIC(12,2)   DEFAULT 0,
    week_revenue          NUMERIC(12,2)   DEFAULT 0,
    month_revenue         NUMERIC(12,2)   DEFAULT 0,

    -- Membresías
    active_members        INT             DEFAULT 0,
    frozen_members        INT             DEFAULT 0,
    expired_members       INT             DEFAULT 0,
    total_members         INT             DEFAULT 0,

    -- Ocupación en tiempo real
    current_occupancy     INT             DEFAULT 0,
    max_capacity          INT             DEFAULT 0,

    -- CRM
    crm_total_leads       INT             DEFAULT 0,
    crm_new_leads         INT             DEFAULT 0,
    crm_converted         INT             DEFAULT 0,
    crm_conversion_rate   NUMERIC(5,2)    DEFAULT 0,

    -- Retención
    churn_risk_count      INT             DEFAULT 0,

    -- Onboarding del gym owner (pasos completados 0-8)
    setup_progress        INT             DEFAULT 0,

    -- Gamificación
    fitcoins_in_circulation BIGINT        DEFAULT 0,

    -- Metadata
    computed_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- RLS: solo el owner del gym puede ver sus stats
ALTER TABLE public.gym_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin puede ver sus gym_stats"
    ON public.gym_stats FOR SELECT
    USING (
        gym_id = (auth.jwt() ->> 'gym_id')::UUID
    );

-- Index para lookup rápido por gym_id (ya es PK, pero por si se consulta sin PK)
CREATE INDEX IF NOT EXISTS idx_gym_stats_computed_at ON public.gym_stats(computed_at DESC);

-- ─── 2. USER_STATS — Stats del Dashboard de Socio ────────────────────────────
-- Actualizada por WF11 (event-driven: pago, booking, clase completada).
-- El dashboard/_index.tsx lee esto en una sola query.

CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id                   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gym_id                    UUID        NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,

    -- Créditos y gamificación
    credits                   INT         DEFAULT 0,
    fitcoins_balance          INT         DEFAULT 0,

    -- Membresía activa
    active_membership_id      UUID        REFERENCES public.memberships(id) ON DELETE SET NULL,
    membership_expires_at     TIMESTAMPTZ,
    membership_plan_name      TEXT,

    -- Próxima clase
    next_booking_at           TIMESTAMPTZ,
    next_class_name           TEXT,

    -- Historial
    classes_this_month        INT         DEFAULT 0,
    classes_total             INT         DEFAULT 0,

    -- Acceso QR
    last_access               TIMESTAMPTZ,
    days_inactive             INT,

    -- Retención
    risk_level                TEXT        CHECK (risk_level IN ('low','medium','high','critical')) DEFAULT 'low',

    -- Metadata
    computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, gym_id)
);

-- RLS: el socio solo ve sus propios stats; admin ve todos los del gym
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socio ve sus propios user_stats"
    ON public.user_stats FOR SELECT
    USING (
        user_id = auth.uid()
        OR gym_id = (auth.jwt() ->> 'gym_id')::UUID
    );

CREATE INDEX IF NOT EXISTS idx_user_stats_gym_id    ON public.user_stats(gym_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_risk_level ON public.user_stats(gym_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_user_stats_computed   ON public.user_stats(computed_at DESC);

-- ─── 3. Columna engagement_score en LEADS ────────────────────────────────────
-- Calculada por WF7 (CRON nocturno 2AM).
-- Permite ordenar el CRM por "leads más calientes".

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS engagement_score INT DEFAULT 50;
CREATE INDEX IF NOT EXISTS idx_leads_engagement ON public.leads(gym_id, engagement_score DESC);

-- ─── 4. RPC: get_churn_risk_users ────────────────────────────────────────────
-- Usada por WF9. Retorna socios con membresía activa pero sin asistir N días.

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
            EXTRACT(day FROM NOW() - MAX(al.created_at))::INT,
            999
        )                                                               AS days_inactive,
        GREATEST(0, EXTRACT(day FROM m.end_date - NOW())::INT)          AS days_until_expiry,
        m.id                                                            AS membership_id
    FROM public.memberships m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.access_logs al
        ON al.user_id = m.user_id
       AND al.gym_id  = m.gym_id
    WHERE m.status = 'active'
    GROUP BY p.id, p.full_name, p.phone, p.email, m.gym_id, m.end_date, m.id
    HAVING COALESCE(EXTRACT(day FROM NOW() - MAX(al.created_at))::INT, 999) >= days_threshold
    ORDER BY days_inactive DESC;
$$;

-- ─── 5. RPC: get_weekly_report ────────────────────────────────────────────────
-- Usada por WF10. Agrega todos los KPIs de la semana para el reporte al owner.

CREATE OR REPLACE FUNCTION public.get_weekly_report(p_gym_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_result             JSON;
    v_week_start         TIMESTAMPTZ := DATE_TRUNC('week', NOW());
    v_prev_week_start    TIMESTAMPTZ := DATE_TRUNC('week', NOW()) - INTERVAL '7 days';
BEGIN
    SELECT json_build_object(
        'this_week_revenue',  COALESCE(SUM(CASE WHEN o.created_at >= v_week_start THEN o.amount ELSE 0 END), 0),
        'prev_week_revenue',  COALESCE(SUM(CASE WHEN o.created_at >= v_prev_week_start AND o.created_at < v_week_start THEN o.amount ELSE 0 END), 0),
        'new_members',        (SELECT COUNT(*) FROM public.memberships WHERE gym_id = p_gym_id AND created_at >= v_week_start),
        'renewals',           (SELECT COUNT(*) FROM public.orders WHERE gym_id = p_gym_id AND type = 'renewal' AND created_at >= v_week_start AND status = 'paid'),
        'cancellations',      (SELECT COUNT(*) FROM public.memberships WHERE gym_id = p_gym_id AND status = 'cancelled' AND updated_at >= v_week_start),
        'new_leads',          (SELECT COUNT(*) FROM public.leads WHERE gym_id = p_gym_id AND created_at >= v_week_start),
        'converted_leads',    (SELECT COUNT(*) FROM public.leads WHERE gym_id = p_gym_id AND stage = 'converted' AND updated_at >= v_week_start),
        'expiring_soon',      (SELECT COUNT(*) FROM public.memberships WHERE gym_id = p_gym_id AND status = 'active' AND end_date <= NOW() + INTERVAL '7 days'),
        'fitcoins_issued',    (SELECT COALESCE(SUM(amount), 0) FROM public.fitcoins WHERE gym_id = p_gym_id AND created_at >= v_week_start AND amount > 0)
    ) INTO v_result
    FROM public.orders o
    WHERE o.gym_id = p_gym_id AND o.status = 'paid'
      AND o.created_at >= v_prev_week_start;

    RETURN v_result;
END;
$$;

-- ─── 6. Vista: admin_dashboard_view ──────────────────────────────────────────
-- Opcional: join de gym_stats + gym para simplificar el loader de admin/_index.tsx.

CREATE OR REPLACE VIEW public.admin_dashboard_view AS
    SELECT
        g.id                    AS gym_id,
        g.name                  AS gym_name,
        g.plan_status,
        g.primary_color,
        gs.mrr,
        gs.today_revenue,
        gs.active_members,
        gs.frozen_members,
        gs.expired_members,
        gs.current_occupancy,
        gs.max_capacity,
        gs.crm_new_leads,
        gs.crm_conversion_rate,
        gs.crm_converted,
        gs.churn_risk_count,
        gs.setup_progress,
        gs.fitcoins_in_circulation,
        gs.computed_at
    FROM public.gyms g
    LEFT JOIN public.gym_stats gs ON gs.gym_id = g.id;

-- ─── COMENTARIOS DE INTEGRACIÓN ──────────────────────────────────────────────
-- admin/_index.tsx loader:
--   SELECT * FROM admin_dashboard_view WHERE gym_id = <gymId>
--
-- dashboard/_index.tsx loader (socio):
--   SELECT * FROM user_stats WHERE user_id = <userId> AND gym_id = <gymId>
--
-- Después de pago/booking en el frontend, llamar:
--   fetch(process.env.N8N_WEBHOOK_USER_STATS_URL, { method: 'POST',
--         body: JSON.stringify({ userId, gymId, trigger: 'payment' }) })
