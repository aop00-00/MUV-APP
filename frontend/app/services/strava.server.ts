// app/services/strava.server.ts
// Strava OAuth 2.0 + activity sync service.
// Tokens expire every 6 hours — always call getValidAccessToken() before API calls.

import { supabaseAdmin } from "./supabase.server";
import { awardFitCoins } from "./gamification.server";

const STRAVA_CLIENT_ID     = process.env.STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const STRAVA_REDIRECT_URI  = process.env.STRAVA_REDIRECT_URI!;
const STRAVA_API_BASE      = "https://www.strava.com/api/v3";

// FitCoins awarded per Strava activity synced (outside gym)
const STRAVA_FITCOINS_PER_ACTIVITY = 15;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface StravaTokenResponse {
    access_token:  string;
    refresh_token: string;
    expires_at:    number; // unix timestamp
    athlete: {
        id: number;
        firstname: string;
        lastname: string;
    };
}

export interface StravaActivity {
    id:                number;
    name:              string;
    sport_type:        string;
    start_date:        string;
    elapsed_time:      number;
    moving_time:       number;
    calories?:         number;
    has_heartrate:     boolean;
    average_heartrate?: number;
    max_heartrate?:    number;
}

export interface StravaConnection {
    id:               string;
    profile_id:       string;
    gym_id:           string;
    strava_athlete_id: number;
    access_token:     string;
    refresh_token:    string;
    expires_at:       string;
    scope:            string | null;
}

// ── OAuth URL ─────────────────────────────────────────────────────────────────
export function buildStravaAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id:     STRAVA_CLIENT_ID,
        redirect_uri:  STRAVA_REDIRECT_URI,
        response_type: "code",
        approval_prompt: "auto",
        scope:         "activity:read_all",
        state,
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

// ── Exchange authorization code for tokens ────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
    const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id:     STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type:    "authorization_code",
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Strava token exchange failed: ${err}`);
    }

    return res.json() as Promise<StravaTokenResponse>;
}

// ── Refresh expired access token ──────────────────────────────────────────────
async function refreshAccessToken(conn: StravaConnection): Promise<string> {
    const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id:     STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type:    "refresh_token",
        }),
    });

    if (!res.ok) throw new Error("Strava token refresh failed");

    const data = await res.json() as { access_token: string; refresh_token: string; expires_at: number };

    await supabaseAdmin
        .from("strava_connections")
        .update({
            access_token:  data.access_token,
            refresh_token: data.refresh_token,
            expires_at:    new Date(data.expires_at * 1000).toISOString(),
        })
        .eq("id", conn.id);

    return data.access_token;
}

// ── Get a valid (possibly refreshed) access token ────────────────────────────
export async function getValidAccessToken(conn: StravaConnection): Promise<string> {
    const expiresAt = new Date(conn.expires_at).getTime();
    // Refresh if token expires within the next 5 minutes
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
        return refreshAccessToken(conn);
    }
    return conn.access_token;
}

// ── Save connection to DB ─────────────────────────────────────────────────────
export async function saveStravaConnection(
    profileId: string,
    gymId: string,
    tokens: StravaTokenResponse
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("strava_connections")
        .upsert({
            profile_id:        profileId,
            gym_id:            gymId,
            strava_athlete_id: tokens.athlete.id,
            access_token:      tokens.access_token,
            refresh_token:     tokens.refresh_token,
            expires_at:        new Date(tokens.expires_at * 1000).toISOString(),
            scope:             "activity:read_all",
        }, { onConflict: "profile_id,gym_id" });

    if (error) throw new Error(`Error saving Strava connection: ${error.message}`);
}

// ── Get connection for a user ─────────────────────────────────────────────────
export async function getStravaConnection(
    profileId: string,
    gymId: string
): Promise<StravaConnection | null> {
    const { data } = await supabaseAdmin
        .from("strava_connections")
        .select("*")
        .eq("profile_id", profileId)
        .eq("gym_id", gymId)
        .single();

    return data as StravaConnection | null;
}

// ── Disconnect Strava ─────────────────────────────────────────────────────────
export async function disconnectStrava(profileId: string, gymId: string): Promise<void> {
    await supabaseAdmin
        .from("strava_connections")
        .delete()
        .eq("profile_id", profileId)
        .eq("gym_id", gymId);
}

// ── Fetch recent activities from Strava API ───────────────────────────────────
export async function fetchRecentActivities(
    conn: StravaConnection,
    perPage = 10
): Promise<StravaActivity[]> {
    const token = await getValidAccessToken(conn);

    const res = await fetch(
        `${STRAVA_API_BASE}/athlete/activities?per_page=${perPage}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Error fetching Strava activities");

    const summaries = await res.json() as StravaActivity[];

    // Fetch detailed activity for each (needed for calories + HR)
    const detailed = await Promise.allSettled(
        summaries.map((a) => fetchActivityDetail(token, a.id))
    );

    return detailed
        .filter((r): r is PromiseFulfilledResult<StravaActivity> => r.status === "fulfilled")
        .map((r) => r.value);
}

async function fetchActivityDetail(token: string, activityId: number): Promise<StravaActivity> {
    const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch activity ${activityId}`);
    return res.json() as Promise<StravaActivity>;
}

// ── Sync and persist new activities, award FitCoins ──────────────────────────
export async function syncStravaActivities(
    profileId: string,
    gymId: string
): Promise<{ synced: number; fitcoinsAwarded: number }> {
    const conn = await getStravaConnection(profileId, gymId);
    if (!conn) return { synced: 0, fitcoinsAwarded: 0 };

    const activities = await fetchRecentActivities(conn, 20);
    let synced = 0;
    let fitcoinsAwarded = 0;

    for (const act of activities) {
        const { error, data } = await supabaseAdmin
            .from("strava_activities")
            .upsert({
                profile_id:         profileId,
                gym_id:             gymId,
                strava_activity_id: act.id,
                name:               act.name,
                sport_type:         act.sport_type,
                start_date:         act.start_date,
                elapsed_time:       act.elapsed_time,
                moving_time:        act.moving_time,
                calories:           act.calories ?? null,
                has_heartrate:      act.has_heartrate,
                average_heartrate:  act.average_heartrate ?? null,
                max_heartrate:      act.max_heartrate ?? null,
            }, {
                onConflict: "profile_id,strava_activity_id",
                ignoreDuplicates: true,
            })
            .select("id, fitcoins_awarded")
            .single();

        if (!error && data && !data.fitcoins_awarded) {
            await awardFitCoins(
                profileId,
                STRAVA_FITCOINS_PER_ACTIVITY,
                "bonus",
                `Actividad Strava: ${act.name}`,
                gymId
            );
            await supabaseAdmin
                .from("strava_activities")
                .update({ fitcoins_awarded: true })
                .eq("id", data.id);

            fitcoinsAwarded += STRAVA_FITCOINS_PER_ACTIVITY;
            synced++;
        }
    }

    return { synced, fitcoinsAwarded };
}

// ── Get persisted activities from DB ─────────────────────────────────────────
export async function getStoredActivities(
    profileId: string,
    gymId: string,
    limit = 10
) {
    const { data } = await supabaseAdmin
        .from("strava_activities")
        .select("*")
        .eq("profile_id", profileId)
        .eq("gym_id", gymId)
        .order("start_date", { ascending: false })
        .limit(limit);

    return data ?? [];
}
