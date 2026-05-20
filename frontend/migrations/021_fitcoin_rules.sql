-- Migration 021: FitCoin Rules System
-- Replaces hardcoded gamification logic with per-gym configurable rules.
-- Adds fitcoin_rules table and fitcoin_rewards table (both DB-driven, no more hardcoded catalogs).

-- ── 0. Fix fitcoins.source CHECK constraint ──────────────────────────────────
-- Original constraint only had 7 sources; add birthday and membership_renewal.
ALTER TABLE public.fitcoins
    DROP CONSTRAINT IF EXISTS fitcoins_source_check;

ALTER TABLE public.fitcoins
    ADD CONSTRAINT fitcoins_source_check CHECK (
        source IN (
            'attendance', 'referral', 'purchase', 'streak_bonus',
            'redemption', 'bonus', 'admin_grant',
            'birthday', 'membership_renewal'
        )
    );

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- ── 1. FitCoin Rules ─────────────────────────────────────────────────────────
-- Each row defines how many points a member earns for a specific event type.
-- event_type is a well-known string ('attendance','purchase','referral','birthday',
-- 'membership_renewal') for automatic triggers, or a custom string for manual grants.

CREATE TABLE IF NOT EXISTS fitcoin_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,               -- 'attendance' | 'purchase' | 'referral' | 'birthday' | 'membership_renewal' | custom
    label           TEXT NOT NULL,               -- Human-readable name shown to members
    is_custom       BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = admin grants manually; FALSE = auto-triggered
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Points configuration
    points_mode     TEXT NOT NULL DEFAULT 'fixed' CHECK (points_mode IN ('fixed','per_amount')),
    points          INT  NOT NULL DEFAULT 0,     -- For fixed: total pts. For per_amount: pts per unit
    amount_unit     INT  NULL,                   -- For per_amount: how many $ = 1 unit (e.g. 100 = 1pt per $100)

    -- Referral-specific (only for event_type='referral')
    points_referee  INT  NULL,                   -- Points awarded to the new member being referred

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (gym_id, event_type)
);

-- ── 2. FitCoin Rewards ───────────────────────────────────────────────────────
-- Per-gym reward catalog (replaces the in-process REWARD_CATALOG constant).

CREATE TABLE IF NOT EXISTS fitcoin_rewards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cost        INT  NOT NULL CHECK (cost > 0),
    category    TEXT NOT NULL DEFAULT 'experience' CHECK (category IN ('discount','merch','access','experience')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fitcoin_rules_gym    ON fitcoin_rules(gym_id);
CREATE INDEX IF NOT EXISTS idx_fitcoin_rewards_gym  ON fitcoin_rewards(gym_id, is_active);

-- ── 4. Updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_fitcoin_rules_updated_at   ON fitcoin_rules;
CREATE TRIGGER trg_fitcoin_rules_updated_at
    BEFORE UPDATE ON fitcoin_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fitcoin_rewards_updated_at ON fitcoin_rewards;
CREATE TRIGGER trg_fitcoin_rewards_updated_at
    BEFORE UPDATE ON fitcoin_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Row-Level Security ────────────────────────────────────────────────────
ALTER TABLE fitcoin_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitcoin_rewards ENABLE ROW LEVEL SECURITY;

-- Admins can do anything within their gym
CREATE POLICY "fitcoin_rules_gym_isolation"
    ON fitcoin_rules FOR ALL
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "fitcoin_rewards_gym_isolation"
    ON fitcoin_rewards FOR ALL
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid() LIMIT 1));

-- ── 6. Seed default rules for existing gyms ──────────────────────────────────
-- Inserts the 5 base event types for every gym that has fitcoins enabled.
-- Uses ON CONFLICT DO NOTHING so re-running is safe.
INSERT INTO fitcoin_rules (gym_id, event_type, label, is_custom, is_active, points_mode, points)
SELECT
    g.id,
    rules.event_type,
    rules.label,
    FALSE,
    TRUE,
    'fixed',
    rules.points
FROM gyms g
CROSS JOIN (VALUES
    ('attendance',          'Asistencia a clase',       10),
    ('membership_renewal',  'Renovación de membresía',  50),
    ('birthday',            'Cumpleaños',                25)
) AS rules(event_type, label, points)
WHERE (g.features->>'fitcoins')::boolean IS NOT FALSE
ON CONFLICT (gym_id, event_type) DO NOTHING;

-- Referral with separate referee points
INSERT INTO fitcoin_rules (gym_id, event_type, label, is_custom, is_active, points_mode, points, points_referee)
SELECT
    g.id,
    'referral',
    'Referir un amigo',
    FALSE,
    TRUE,
    'fixed',
    100,
    50
FROM gyms g
WHERE (g.features->>'fitcoins')::boolean IS NOT FALSE
ON CONFLICT (gym_id, event_type) DO NOTHING;

-- Purchase: per_amount mode, 1pt per $100
INSERT INTO fitcoin_rules (gym_id, event_type, label, is_custom, is_active, points_mode, points, amount_unit)
SELECT
    g.id,
    'purchase',
    'Compra en tienda',
    FALSE,
    TRUE,
    'per_amount',
    1,
    100
FROM gyms g
WHERE (g.features->>'fitcoins')::boolean IS NOT FALSE
ON CONFLICT (gym_id, event_type) DO NOTHING;
