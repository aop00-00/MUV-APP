-- Migration 017: Strava OAuth connections + synced activities

-- ── Strava OAuth tokens per user ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strava_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    strava_athlete_id   BIGINT NOT NULL,
    access_token        TEXT NOT NULL,
    refresh_token       TEXT NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    scope               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, gym_id)
);

-- ── Synced activities from Strava ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strava_activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    strava_activity_id  BIGINT NOT NULL,
    name                TEXT,
    sport_type          TEXT,                  -- Run, Ride, WeightTraining, etc.
    start_date          TIMESTAMPTZ NOT NULL,
    elapsed_time        INTEGER NOT NULL,      -- seconds
    moving_time         INTEGER NOT NULL,      -- seconds (excludes pauses)
    calories            NUMERIC(8,2),          -- null if not available
    has_heartrate       BOOLEAN DEFAULT FALSE,
    average_heartrate   NUMERIC(6,2),          -- null if no HR monitor
    max_heartrate       NUMERIC(6,2),          -- null if no HR monitor
    fitcoins_awarded    BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, strava_activity_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_strava_connections_profile   ON strava_connections(profile_id);
CREATE INDEX IF NOT EXISTS idx_strava_connections_gym       ON strava_connections(gym_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_profile    ON strava_activities(profile_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_gym        ON strava_activities(gym_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date ON strava_activities(start_date DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_activities  ENABLE ROW LEVEL SECURITY;

-- Users see only their own connection
CREATE POLICY "strava_connections_own" ON strava_connections
    FOR ALL USING (profile_id = auth.uid());

-- Users see only their own activities
CREATE POLICY "strava_activities_own" ON strava_activities
    FOR ALL USING (profile_id = auth.uid());

-- Service role bypasses RLS (used by server-side functions)
CREATE POLICY "strava_connections_service" ON strava_connections
    FOR ALL TO service_role USING (true);

CREATE POLICY "strava_activities_service" ON strava_activities
    FOR ALL TO service_role USING (true);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_strava_connection_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_strava_connections_updated_at
    BEFORE UPDATE ON strava_connections
    FOR EACH ROW EXECUTE FUNCTION update_strava_connection_timestamp();
