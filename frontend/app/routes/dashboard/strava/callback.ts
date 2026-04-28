// dashboard/strava/callback — Strava redirects here after user authorizes
// Exchanges code for tokens, saves connection, syncs first batch of activities.

import { redirect } from "react-router";
import type { Route } from "./+types/callback";

export async function loader({ request }: Route.LoaderArgs) {
    const url    = new URL(request.url);
    const code   = url.searchParams.get("code");
    const state  = url.searchParams.get("state");
    const error  = url.searchParams.get("error");

    // User denied access on Strava
    if (error || !code || !state) {
        return redirect("/dashboard?strava=denied");
    }

    try {
        const { profileId, gymId } = JSON.parse(
            Buffer.from(state, "base64url").toString("utf-8")
        );

        const {
            exchangeCodeForTokens,
            saveStravaConnection,
            syncStravaActivities,
        } = await import("~/services/strava.server");

        const tokens = await exchangeCodeForTokens(code);
        await saveStravaConnection(profileId, gymId, tokens);

        // Kick off first sync (non-blocking — fire and forget with await anyway
        // since this is the connect moment and user expects data to appear)
        await syncStravaActivities(profileId, gymId);

        return redirect("/dashboard?strava=connected");
    } catch {
        return redirect("/dashboard?strava=error");
    }
}
