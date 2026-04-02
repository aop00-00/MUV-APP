// app/services/gym-lookup.server.ts
// Public gym lookup by slug — used by the /:slug portal route and subdomain landing

import { supabaseAdmin } from "./supabase.server";

// ─── Basic gym info (login portal) ──────────────────────────────
export interface GymPublicInfo {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string;
    accent_color: string;
    plan_status: string;
}

export async function getGymBySlug(slug: string): Promise<GymPublicInfo | null> {
    const { data, error } = await supabaseAdmin
        .from("gyms")
        .select("id, name, slug, logo_url, primary_color, accent_color, plan_status")
        .eq("slug", slug.toLowerCase().trim())
        .single();

    if (error || !data) return null;
    if (data.plan_status === "suspended" || data.plan_status === "cancelled") return null;
    return data as GymPublicInfo;
}

// ─── Full landing page data ─────────────────────────────────────
export interface GymLandingCoach {
    id: string;
    name: string;
    specialties: string[];
    status: string;
}

export interface GymLandingClassType {
    id: string;
    name: string;
    description: string | null;
    duration: number;
    color: string;
    credits_required: number;
}

export interface GymLandingPlan {
    id: string;
    name: string;
    description: string | null;
    price: number;
    metadata: Record<string, any> | null;
}

export interface GymLandingLocation {
    name: string;
    address: string;
    city: string;
    phone: string | null;
    maps_url: string | null;
}

export interface GymUpcomingClass {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    capacity: number;
    current_enrolled: number;
    coach_id: string;
}

export interface GymLandingData extends GymPublicInfo {
    tagline: string | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    maps_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    whatsapp_url: string | null;
    hero_image_url: string | null;
    gallery_urls: string[];
    landing_sections: string[];
    currency: string;
    // Related data
    coaches: GymLandingCoach[];
    class_types: GymLandingClassType[];
    plans: GymLandingPlan[];
    locations: GymLandingLocation[];
    upcoming_classes: (GymUpcomingClass & { coach_name?: string })[];
}

/**
 * Fetches everything needed to render a gym's subdomain landing page.
 * 1 query for the gym row + 5 parallel queries for related data.
 */
export async function getGymLandingData(slug: string): Promise<GymLandingData | null> {
    const { data: gym, error } = await supabaseAdmin
        .from("gyms")
        .select(`
            id, name, slug, logo_url, primary_color, accent_color, plan_status, currency,
            tagline, description, phone, email, address, city, maps_url,
            instagram_url, facebook_url, whatsapp_url, hero_image_url,
            gallery_urls, landing_sections
        `)
        .eq("slug", slug.toLowerCase().trim())
        .single();

    if (error || !gym) return null;
    if (gym.plan_status === "suspended" || gym.plan_status === "cancelled") return null;

    const gymId = gym.id;

    // Parallel queries for related data
    const [coachesRes, classTypesRes, plansRes, locationsRes, classesRes] = await Promise.all([
        supabaseAdmin
            .from("coaches")
            .select("id, name, specialties, status")
            .eq("gym_id", gymId)
            .eq("status", "activo")
            .order("name"),
        supabaseAdmin
            .from("class_types")
            .select("id, name, description, duration, color, credits_required")
            .eq("gym_id", gymId)
            .eq("is_active", true)
            .order("name"),
        supabaseAdmin
            .from("products")
            .select("id, name, description, price, metadata")
            .eq("gym_id", gymId)
            .in("category", ["package", "plan"])
            .eq("is_active", true)
            .order("price"),
        supabaseAdmin
            .from("locations")
            .select("name, address, city, phone, maps_url")
            .eq("gym_id", gymId)
            .eq("is_active", true),
        supabaseAdmin
            .from("classes")
            .select("id, title, start_time, end_time, capacity, current_enrolled, coach_id")
            .eq("gym_id", gymId)
            .gte("start_time", new Date().toISOString())
            .order("start_time")
            .limit(10),
    ]);

    // Map coach_id → coach name for upcoming classes
    const coachMap = new Map<string, string>();
    for (const c of coachesRes.data ?? []) {
        coachMap.set(c.id, c.name);
    }

    return {
        ...(gym as GymPublicInfo),
        tagline: gym.tagline ?? null,
        description: gym.description ?? null,
        phone: gym.phone ?? null,
        email: gym.email ?? null,
        address: gym.address ?? null,
        city: gym.city ?? null,
        maps_url: gym.maps_url ?? null,
        instagram_url: gym.instagram_url ?? null,
        facebook_url: gym.facebook_url ?? null,
        whatsapp_url: gym.whatsapp_url ?? null,
        hero_image_url: gym.hero_image_url ?? null,
        gallery_urls: gym.gallery_urls ?? [],
        landing_sections: (gym.landing_sections as string[]) ?? ["hero", "classes", "schedule", "coaches", "pricing", "cta"],
        currency: gym.currency ?? "MXN",
        coaches: (coachesRes.data ?? []) as GymLandingCoach[],
        class_types: (classTypesRes.data ?? []) as GymLandingClassType[],
        plans: (plansRes.data ?? []) as GymLandingPlan[],
        locations: (locationsRes.data ?? []) as GymLandingLocation[],
        upcoming_classes: (classesRes.data ?? []).map((c: any) => ({
            ...c,
            coach_name: coachMap.get(c.coach_id) ?? "Coach",
        })),
    };
}

// ─── Slug validation ────────────────────────────────────────────
// Reserved prefixes that cannot be used as gym slugs
export const RESERVED_SLUGS = [
    "auth", "admin", "dashboard", "barista", "onboarding", "api", "public", "static",
];

export function isSlugReserved(slug: string): boolean {
    return RESERVED_SLUGS.some(r => slug === r || slug.startsWith(r + "-"));
}
