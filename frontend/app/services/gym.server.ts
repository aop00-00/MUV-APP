// app/services/gym.server.ts
// Centralized gym validation middleware for secure multitenancy

// Custom response helpers to avoid "Named export not found" in Vercel's react-router bundle
const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
});

const redirect = (url: string, init?: number | ResponseInit) => {
    const responseInit = typeof init === "number" ? { status: init } : init;
    return new Response(null, {
        status: responseInit?.status ?? 302,
        ...responseInit,
        headers: { Location: url, ...responseInit?.headers }
    });
};

import { requireAuth } from "./auth.server";
import { supabaseAdmin } from "./supabase.server";
import type { Profile } from "~/types/database";

/**
 * Enhanced authentication that validates gym_id exists and gym is active.
 * Use this instead of requireAuth() for all tenant-scoped routes.
 *
 * @throws redirect to /onboarding if user has no gym_id
 * @throws json 404 if gym doesn't exist
 * @throws json 403 if gym is suspended or cancelled
 * @returns Profile and validated gymId
 */
export async function requireGymAuth(request: Request): Promise<{
    profile: Profile;
    gymId: string;
}> {
    const profile = await requireAuth(request);

    // Validate gym_id exists in profile
    if (!profile.gym_id) {
        console.error(`[SECURITY] User ${profile.id} (${profile.email}) has no gym_id assigned`);
        console.error(`[SECURITY] Timestamp: ${new Date().toISOString()}`);
        throw redirect("/onboarding");
    }

    // Verify gym exists and is active
    const { data: gym, error } = await supabaseAdmin
        .from("gyms")
        .select("id, plan_id, plan_status, trial_ends_at, name, slug")
        .eq("id", profile.gym_id)
        .single();

    if (error) {
        // Check if error is "relation does not exist" (table gyms not created)
        if (error.code === '42P01' || error.message?.includes('relation "public.gyms" does not exist')) {
            console.error(`[CRITICAL] Database migration required: gyms table does not exist`);
            throw json(
                {
                    error: "Sistema en mantenimiento. Por favor contacta a soporte.",
                    debug: "Database migration pending: run 001_create_gyms_and_rls.sql"
                },
                { status: 503 }
            );
        }

        console.error(`[SECURITY] Gym ${profile.gym_id} not found for user ${profile.id}`, error);
        throw json(
            { error: "Estudio no encontrado. Contacta a soporte." },
            { status: 404 }
        );
    }

    if (!gym) {
        console.error(`[SECURITY] Gym ${profile.gym_id} not found for user ${profile.id}`);
        throw json(
            { error: "Estudio no encontrado. Contacta a soporte." },
            { status: 404 }
        );
    }

    // Check gym status
    if (gym.plan_status === 'suspended' || gym.plan_status === 'cancelled') {
        console.warn(`[ACCESS DENIED] User ${profile.id} tried to access suspended/cancelled gym ${gym.id} (${gym.name})`);
        throw redirect("/admin/upgrade");
    }

    // Check trial expiry — lazily suspend if trial has ended
    if (gym.plan_status === 'trial' && gym.trial_ends_at) {
        const trialEnd = new Date(gym.trial_ends_at);
        if (trialEnd < new Date()) {
            console.warn(`[TRIAL EXPIRED] Gym ${gym.id} (${gym.name}) trial ended at ${gym.trial_ends_at}`);
            await supabaseAdmin
                .from("gyms")
                .update({ plan_status: "suspended" })
                .eq("id", gym.id);
            throw redirect("/admin/upgrade");
        }
    }

    return {
        profile,
        gymId: profile.gym_id,
    };
}

/**
 * Admin-only authentication - requires gym_id AND role=admin.
 * Use this for admin panel routes (/admin/*).
 *
 * @throws redirect to /dashboard if user is not admin
 * @returns Profile and validated gymId
 */
export async function requireGymAdmin(request: Request): Promise<{
    profile: Profile;
    gymId: string;
}> {
    const { profile, gymId } = await requireGymAuth(request);

    if (profile.role !== "admin") {
        console.warn(`[ACCESS DENIED] User ${profile.id} (role: ${profile.role}) tried to access admin route`);
        throw json(
            { error: "Acceso solo para administradores" },
            { status: 403 }
        );
    }

    return { profile, gymId };
}

/**
 * Onboarding guard - blocks access to admin panel until setup is complete.
 * Use this in admin layout loader instead of requireGymAdmin.
 *
 * Validates:
 * 1. User has valid gym_id and is admin (via requireGymAdmin)
 * 2. Gym has completed post-checkout onboarding
 *
 * @throws redirect to /onboarding/setup if onboarding not completed
 * @returns Profile and validated gymId
 */
export async function requireOnboardingComplete(request: Request): Promise<{
    profile: Profile;
    gymId: string;
}> {
    const { profile, gymId } = await requireGymAdmin(request);

    const { data: gym, error } = await supabaseAdmin
        .from("gyms")
        .select("onboarding_completed, created_at")
        .eq("id", gymId)
        .single();

    if (error || !gym) {
        console.error(`[ONBOARDING] Gym ${gymId} not found for user ${profile.id}`, error);
        throw json({ error: "Gym not found" }, { status: 404 });
    }

    // Legacy gyms (created before migration) are automatically marked complete in migration
    // New gyms (created after migration) must complete onboarding
    if (!gym.onboarding_completed) {
        console.warn(`[ONBOARDING] Blocking admin access for gym ${gymId} - onboarding incomplete`);
        throw redirect("/onboarding/setup");
    }

    return { profile, gymId };
}

/**
 * Coach-level authentication - requires gym_id AND (role=admin OR role=coach).
 * Use this for barista/coach panel routes (/barista/*).
 *
 * @throws redirect to /dashboard if user is not admin or coach
 * @returns Profile and validated gymId
 */
export async function requireGymCoach(request: Request): Promise<{
    profile: Profile;
    gymId: string;
}> {
    const { profile, gymId } = await requireGymAuth(request);

    if (profile.role !== "admin" && profile.role !== "coach") {
        console.warn(`[ACCESS DENIED] User ${profile.id} (role: ${profile.role}) tried to access coach route`);
        throw json(
            { error: "Acceso solo para entrenadores" },
            { status: 403 }
        );
    }

    return { profile, gymId };
}

/**
 * Validates that a resource (booking, order, class, etc.) belongs to the user's gym.
 * Prevents cross-tenant access attacks.
 *
 * CRITICAL SECURITY FUNCTION - Always call this before modifying resources.
 *
 * @param table - The table name (e.g., "bookings", "orders", "classes")
 * @param resourceId - The UUID of the resource
 * @param expectedGymId - The gym_id from requireGymAuth
 * @returns true if resource belongs to gym, false otherwise
 *
 * @example
 * ```typescript
 * // In an action handler:
 * const { profile, gymId } = await requireGymAuth(request);
 * const bookingId = formData.get("booking_id") as string;
 *
 * const isValid = await validateGymOwnership("bookings", bookingId, gymId);
 * if (!isValid) {
 *     return json({ error: "Reserva no encontrada" }, { status: 404 });
 * }
 * // Safe to proceed with deletion/modification
 * ```
 */
export async function validateGymOwnership(
    table: string,
    resourceId: string,
    expectedGymId: string
): Promise<boolean> {
    if (!resourceId || !expectedGymId) {
        console.error(`[validateGymOwnership] Missing parameters: resourceId=${resourceId}, expectedGymId=${expectedGymId}`);
        return false;
    }

    const { data, error } = await supabaseAdmin
        .from(table)
        .select("gym_id")
        .eq("id", resourceId)
        .single();

    if (error || !data) {
        console.error(`[validateGymOwnership] Resource not found: ${table}/${resourceId}`, error);
        return false;
    }

    if (data.gym_id !== expectedGymId) {
        console.error(`[SECURITY VIOLATION] Cross-tenant access attempt detected!`);
        console.error(`  Table: ${table}`);
        console.error(`  Resource ID: ${resourceId}`);
        console.error(`  Expected gym_id: ${expectedGymId}`);
        console.error(`  Actual gym_id: ${data.gym_id}`);
        console.error(`  Timestamp: ${new Date().toISOString()}`);
        return false;
    }

    return true;
}

/**
 * Validates that a user belongs to the expected gym.
 * Use this when performing operations on behalf of another user (e.g., admin actions).
 *
 * @param userId - The user's UUID
 * @param expectedGymId - The gym_id from requireGymAuth
 * @returns true if user belongs to gym, false otherwise
 */
export async function validateUserGymMembership(
    userId: string,
    expectedGymId: string
): Promise<boolean> {
    if (!userId || !expectedGymId) {
        console.error(`[validateUserGymMembership] Missing parameters`);
        return false;
    }

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("gym_id")
        .eq("id", userId)
        .single();

    if (error || !data) {
        console.error(`[validateUserGymMembership] User ${userId} not found`, error);
        return false;
    }

    if (data.gym_id !== expectedGymId) {
        console.error(`[SECURITY VIOLATION] User ${userId} belongs to gym ${data.gym_id}, not ${expectedGymId}`);
        return false;
    }

    return true;
}

/**
 * Front-desk authentication — requires gym_id AND (role=admin OR role=front_desk).
 * Use this for staff panel routes (/staff/*).
 *
 * @throws redirect to /dashboard if user is not admin or front_desk
 * @returns Profile and validated gymId
 */
export async function requireGymFrontDesk(request: Request): Promise<{
    profile: Profile;
    gymId: string;
}> {
    const { profile, gymId } = await requireGymAuth(request);

    if (profile.role !== "admin" && profile.role !== "front_desk") {
        console.warn(`[ACCESS DENIED] User ${profile.id} (role: ${profile.role}) tried to access front desk route`);
        const destination = profile.role === "member" ? "/dashboard" : "/auth/login";
        throw redirect(destination);
    }

    return { profile, gymId };
}

/**
 * Gets gym configuration and branding for the tenant context.
 * Used in root loader to populate TenantContext.
 *
 * @param gymId - The gym's UUID
 * @returns Gym configuration object or null if not found
 */
export async function getGymConfig(gymId: string) {
    const { data: gym, error } = await supabaseAdmin
        .from("gyms")
        .select("id, name, slug, logo_url, primary_color, accent_color, tax_region, currency, timezone, features")
        .eq("id", gymId)
        .single();

    if (error || !gym) {
        console.error(`[getGymConfig] Gym ${gymId} not found`, error);
        return null;
    }

    return gym;
}

/**
 * Helper to extract gym_id from profile safely.
 * Throws if gym_id is missing.
 *
 * @param profile - User profile object
 * @returns gym_id string
 * @throws Error if gym_id is null/undefined
 */
export function getGymIdFromProfile(profile: { gym_id?: string | null }): string {
    const gymId = profile.gym_id;
    if (!gymId) {
        console.error(`[SECURITY] Profile has no gym_id:`, {
            profileId: (profile as any).id,
            email: (profile as any).email,
            timestamp: new Date().toISOString(),
        });
        throw new Error("User profile has no gym_id assigned. Please contact support.");
    }
    return gymId;
}
