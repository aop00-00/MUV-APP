// app/services/gym-auth.server.ts
// Shared login/register logic for gym portals.
// Used by both gym-portal.tsx (/:slug) and _index.tsx (subdomain landing).

import { supabaseAdmin } from "./supabase.server";
import { createUserSession } from "./auth.server";
import type { GymPublicInfo } from "./gym-lookup.server";

type AuthResult = Response | { error: string };

const ROLE_REDIRECT: Record<string, string> = {
    admin: "/admin",
    coach: "/barista",
    member: "/dashboard",
};

/**
 * Handles login/register form submissions for a gym portal.
 * Returns a redirect Response on success, or { error } on failure.
 */
export async function handleGymAuth(
    request: Request,
    gym: GymPublicInfo,
    formData: FormData,
): Promise<AuthResult> {
    const intent = formData.get("intent") as string;

    if (intent === "login") return handleLogin(request, gym, formData);
    if (intent === "register") return handleRegister(request, gym, formData);
    return { error: "Acción no válida" };
}

// ─── Login ──────────────────────────────────────────────────────
async function handleLogin(
    request: Request,
    gym: GymPublicInfo,
    formData: FormData,
): Promise<AuthResult> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email y contraseña son requeridos" };
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
        return { error: "Credenciales inválidas" };
    }

    // Verify user belongs to this gym
    const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role, gym_id")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
        return { error: "Error al obtener perfil. Contacta a soporte." };
    }

    if (profile.gym_id !== gym.id) {
        return { error: "Tu cuenta no pertenece a este estudio." };
    }

    const role = profile.role || "member";
    return createUserSession(request, ROLE_REDIRECT[role] || "/dashboard", data.user.id, role);
}

// ─── Register ───────────────────────────────────────────────────
async function handleRegister(
    request: Request,
    gym: GymPublicInfo,
    formData: FormData,
): Promise<AuthResult> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const full_name = formData.get("full_name") as string;

    if (!email || !password || !full_name) {
        return { error: "Todos los campos son obligatorios" };
    }

    if (password.length < 6) {
        return { error: "La contraseña debe tener al menos 6 caracteres" };
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "member" },
    });

    if (error) {
        console.error("[GymAuth] Registration error:", error);
        if (error.message?.includes("already been registered")) {
            return { error: "Este correo ya está registrado. Intenta iniciar sesión." };
        }
        return { error: `Error al crear cuenta: ${error.message}` };
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
            {
                id: data.user.id,
                email,
                full_name,
                role: "member",
                credits: 0,
                gym_id: gym.id,
            },
            { onConflict: "id" },
        );

    if (profileError) {
        console.error("[GymAuth] Profile update error:", profileError);
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        return { error: "Error al configurar el perfil. Intenta de nuevo." };
    }

    return createUserSession(request, "/dashboard", data.user.id, "member");
}
