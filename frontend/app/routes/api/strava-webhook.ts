// api/strava-webhook — Strava Webhook Events API
//
// Two responsibilities:
//   GET  — Strava subscription validation challenge (one-time setup)
//   POST — Receive real-time activity events; sync new activities + award FitCoins

import type { Route } from "./+types/strava-webhook";

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!;

// ── GET: Strava subscription validation ──────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);

    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
        return Response.json({ "hub.challenge": challenge });
    }

    return new Response("Forbidden", { status: 403 });
}

// ── POST: Receive activity events ────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: { object_type: string; object_id: number; aspect_type: string; owner_id: number };
    try {
        body = await request.json();
    } catch {
        return new Response("Bad Request", { status: 400 });
    }

    // Only process new activities (ignore updates/deletes)
    if (body.object_type !== "activity" || body.aspect_type !== "create") {
        return Response.json({ status: "ignored" });
    }

    try {
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const { syncStravaActivities } = await import("~/services/strava.server");

        // Find the user who owns this Strava athlete ID
        const { data: conn } = await supabaseAdmin
            .from("strava_connections")
            .select("profile_id, gym_id")
            .eq("strava_athlete_id", body.owner_id)
            .single();

        if (!conn) {
            return Response.json({ status: "athlete_not_found" });
        }

        await syncStravaActivities(conn.profile_id, conn.gym_id);

        return Response.json({ status: "ok" });
    } catch (err) {
        console.error("[strava-webhook]", err);
        // Return 200 to avoid Strava retrying — log the error server-side
        return Response.json({ status: "error" });
    }
}
