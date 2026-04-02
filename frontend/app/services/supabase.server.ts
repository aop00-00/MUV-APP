// app/services/supabase.server.ts
// Singleton typed Supabase client for use in React Router loaders/actions.
// Uses the SERVICE_ROLE key so it bypasses RLS — always call with explicit
// .eq("gym_id", gymId) filters so the isolation is enforced in app logic.
//
// IMPORTANT: Uses lazy initialization to avoid crashing Vercel serverless
// functions when env vars are missing (e.g. during static/landing routes).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
        "[supabase.server] Missing env vars (SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY). " +
        "Supabase clients will fail at runtime if called. Landing/static routes will still work."
    );
}

// ── Admin client (service_role) ───────────────────────────────────
// Lazy singleton — created on first access so the module can load
// even when env vars are missing (Vercel cold-start safety).
let _adminClient: SupabaseClient | null = null;

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_adminClient) {
            if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
                throw new Error(
                    "Cannot use supabaseAdmin: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
                );
            }
            _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
        }
        return (_adminClient as any)[prop];
    },
});

// ── Anon client ───────────────────────────────────────────────────
// Use when you want RLS to be enforced (pass user JWT as accessToken).
export function supabaseWithToken(accessToken: string) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Cannot create anon client: missing SUPABASE_URL or SUPABASE_ANON_KEY.");
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

// ── Gym ID helpers ──────────────────────────────────────────────────────────

/**
 * @deprecated Demo-mode only. In production, use getGymIdFromClaims() or
 * getGymIdFromProfile() so gym_id is resolved from the authenticated session.
 * Still exported for backward compatibility with legacy service files.
 */
export const DEFAULT_GYM_ID = "00000000-0000-0000-0000-000000000001" as const;

/**
 * Extracts gym_id from a decoded JWT payload (injected by custom_access_token_hook).
 * Use in server loaders & actions after calling requireAuth().
 *
 * @param jwtPayload - The decoded JWT object from Supabase session
 * @throws if gym_id claim is missing (means JWT hook is not configured)
 */
export function getGymIdFromClaims(jwtPayload: Record<string, unknown>): string {
    const gymId = jwtPayload["gym_id"] as string | undefined;
    if (!gymId) {
        throw new Error(
            "No gym_id claim in JWT. " +
            "Make sure custom_access_token_hook is configured in Supabase Auth → Hooks."
        );
    }
    return gymId;
}

/**
 * Demo/dev fallback: returns the gym_id from a Profile object.
 * In production, prefer getGymIdFromClaims() for JWT-enforced isolation.
 */
export function getGymIdFromProfile(profile: { gym_id?: string | null }): string {
    const gymId = profile.gym_id;
    if (!gymId) {
        // Fallback for demo mode where gym_id may not exist yet
        console.warn("[supabase.server] Profile has no gym_id — using demo fallback");
        return "00000000-0000-0000-0000-000000000001";
    }
    return gymId;
}

// ── Helper: get Supabase project URL (for Edge Function calls) ────
export const SUPABASE_PROJECT_URL = SUPABASE_URL;

/**
 * Fetches a product from the database.
 * Used in checkout and store flows.
 */
export async function getProduct(packId: string, gymId: string): Promise<any | null> {
    console.log("[supabase.server/getProduct] 🔍 Buscando producto");
    console.log("[supabase.server/getProduct] Pack ID:", packId);
    console.log("[supabase.server/getProduct] Gym ID:", gymId);

    const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", packId)
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .single();

    if (error) {
        console.error("[supabase.server/getProduct] ❌ Error al buscar producto:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
        });
    } else if (data) {
        console.log("[supabase.server/getProduct] ✅ Producto encontrado:", {
            id: data.id,
            name: data.name,
            price: data.price,
            category: data.category,
            is_active: data.is_active
        });
    } else {
        console.warn("[supabase.server/getProduct] ⚠️ No se encontró producto con los criterios especificados");
    }

    return data ?? null;
}