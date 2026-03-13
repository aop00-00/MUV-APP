// app/services/auth.server.ts
// Authentication and session helpers.
// Demo-safe: Supabase is only imported when env vars are present.
// In demo mode (login.tsx role buttons), sessions use a "role" key
// and MOCK_PROFILES are returned without any DB call.

import { createCookieSessionStorage } from "react-router";

// Standard redirect helper to avoid "Named export not found" in Vercel's react-router bundle
const redirect = (url: string, init?: number | ResponseInit) => {
    const responseInit = typeof init === "number" ? { status: init } : init;
    return new Response(null, {
        status: responseInit?.status ?? 302,
        ...responseInit,
        headers: { Location: url, ...responseInit?.headers }
    });
};

import type { Profile } from "~/types/database";

const sessionSecret = process.env.SESSION_SECRET || "grind-default-secret-change-in-prod";

export const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: "__grind_session",
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
        sameSite: "lax",
        secrets: [sessionSecret],
        secure: process.env.NODE_ENV === "production",
    },
});

export async function getSession(request: Request) {
    const cookie = request.headers.get("Cookie");
    return sessionStorage.getSession(cookie);
}

// ── Session CRUD ─────────────────────────────────────────────────
const DEMO_ROLES = new Set(["admin", "member", "coach"]);

export async function createUserSession(request: Request, redirectTo: string, userId: string, role?: string) {
    const session = await getSession(request);

    // Clear any previous session data (demo or real) to avoid "shadowing"
    session.unset("role");
    session.unset("user_id");

    // Demo mode: login.tsx sends role strings ("admin", "member", "coach").
    if (DEMO_ROLES.has(userId)) {
        session.set("role", userId);
    } else {
        session.set("user_id", userId);
        if (role) {
            session.set("role", role);
        }
    }
    return redirect(redirectTo, {
        headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
}

// ── Mock profiles for demo mode ───────────────────────────────────
const MOCK_PROFILES: Record<string, Profile> = {
    admin: {
        id: "admin-001", email: "admin@grindproject.com", full_name: "Carlos Admin",
        role: "admin", avatar_url: null, credits: 999, phone: "+52 55 1234 5678",
        created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
        gym_id: "00000000-0000-0000-0000-000000000001",
    } as unknown as Profile,
    member: {
        id: "member-001", email: "maria@gmail.com", full_name: "María García",
        role: "member", avatar_url: null, credits: 8, phone: "+52 55 9876 5432",
        created_at: "2025-02-01T00:00:00Z", updated_at: "2025-02-01T00:00:00Z",
        gym_id: "00000000-0000-0000-0000-000000000001",
    } as unknown as Profile,
    coach: {
        id: "coach-001", email: "barista@grindproject.com", full_name: "Diego Barista",
        role: "coach", avatar_url: null, credits: 0, phone: "+52 55 5555 1234",
        created_at: "2025-01-15T00:00:00Z", updated_at: "2025-01-15T00:00:00Z",
        gym_id: "00000000-0000-0000-0000-000000000001",
    } as unknown as Profile,
};

// ── Get authenticated profile ─────────────────────────────────────
// Demo-safe: if session has "role" key (set by login.tsx demo buttons),
// we return a mock profile immediately without touching Supabase.
export async function requireAuth(request: Request): Promise<Profile> {
    const session = await getSession(request);

    // ── Pre-authenticated path (Session has role) ──────────────
    const sessionRole = session.get("role") as string | undefined;
    const userId = session.get("user_id") as string | undefined;

    // If it's a demo role, return mock immediately
    if (sessionRole && DEMO_ROLES.has(sessionRole) && !userId) {
        return MOCK_PROFILES[sessionRole]!;
    }

    // ── Real auth path ──
    if (!userId) throw redirect("/auth/login");

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        console.warn("requireAuth: no SUPABASE_URL, returning mock admin");
        return MOCK_PROFILES["admin"]!;
    }

    const { supabaseAdmin } = await import("./supabase.server");
    const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !profile) {
        console.error("requireAuth Error:", error?.message, "Code:", error?.code, "UserId:", userId);
        // If we have a role in session but DB fetch failed, we still redirect to be safe
        throw redirect("/auth/login");
    }

    return profile as Profile;
}

export async function requireAdmin(request: Request): Promise<Profile> {
    const profile = await requireAuth(request);
    if (profile.role !== "admin") throw redirect("/auth/login");
    return profile;
}

export async function requireBarista(request: Request): Promise<Profile> {
    const profile = await requireAuth(request);
    if (profile.role !== "coach") throw redirect("/auth/login");
    return profile;
}

export async function requireUser(request: Request): Promise<string> {
    const session = await getSession(request);
    const userId = session.get("user_id") as string | undefined;
    const role = session.get("role") as string | undefined;
    if (!userId && !role) throw redirect("/auth/login");
    return userId ?? role ?? "member";
}

export async function logout(request: Request) {
    const session = await getSession(request);
    return redirect("/", {
        headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
}
