// app/services/plan-access.server.ts
// Server-only guards for SaaS plan feature-gating.

import { type PlanId, isRouteAllowed, getMinimumPlanForRoute } from "~/config/plan-features";
import { requireGymAdmin } from "~/services/gym.server";
import { supabaseAdmin } from "~/services/supabase.server";

/**
 * Server-side guard for individual admin route loaders.
 * Blocks direct URL access to features not included in the gym's plan.
 */
export async function requirePlanAccess(
    request: Request,
    currentRoute: string
): Promise<{ profile: any; gymId: string; planId: PlanId }> {
    const { profile, gymId } = await requireGymAdmin(request);

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("plan_id")
        .eq("id", gymId)
        .single();

    const planId = (gym?.plan_id || "starter") as PlanId;

    if (!isRouteAllowed(planId, currentRoute)) {
        const minPlan = getMinimumPlanForRoute(currentRoute);
        throw new Response(
            JSON.stringify({
                error: "Esta función no está disponible en tu plan actual.",
                currentPlan: planId,
                requiredPlan: minPlan,
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
        );
    }

    return { profile, gymId, planId };
}
