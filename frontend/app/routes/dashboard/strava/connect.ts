// dashboard/strava/connect — redirects user to Strava OAuth
// GET only; no UI needed.

import { redirect } from "react-router";
import type { Route } from "./+types/connect";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { buildStravaAuthUrl } = await import("~/services/strava.server");

    const { profile, gymId } = await requireGymAuth(request);

    // State encodes profileId + gymId so callback can reconstruct session
    const state = Buffer.from(JSON.stringify({ profileId: profile.id, gymId })).toString("base64url");

    return redirect(buildStravaAuthUrl(state));
}
