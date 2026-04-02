import { data } from "react-router";
// Test endpoint to verify authentication and gym context

export async function loader({ request }: any) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");

    try {
        const { profile, gymId } = await requireGymAuth(request);

        // Fetch gym details
        const { data: gym, error: gymError } = await supabaseAdmin
            .from("gyms")
            .select("id, name, slug, plan_status")
            .eq("id", gymId)
            .single();

        return data({
            success: true,
            profile: {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                role: profile.role,
                gym_id: profile.gym_id
            },
            gym,
            gymError
        });
    } catch (error: any) {
        return data({
            success: false,
            error: error.message || "Authentication failed"
        }, { status: 401 });
    }
}
