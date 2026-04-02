// app/routes/gym-portal.tsx
// Dynamic /:slug route — branded login/register portal for each gym.
// Visitors land here via their gym's personalized URL (e.g. /studio-valentina-abc1).

import { useState } from "react";
import { Form, useNavigation, Link } from "react-router";
import type { Route } from "./+types/gym-portal";

// Custom response helpers (same pattern used across the project)
const json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
    });

const redirect = (url: string, init?: number | ResponseInit) => {
    const responseInit = typeof init === "number" ? { status: init } : init;
    return new Response(null, {
        status: responseInit?.status ?? 302,
        ...responseInit,
        headers: { Location: url, ...responseInit?.headers },
    });
};

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ params, request }: Route.LoaderArgs) {
    const slug = params.slug;
    if (!slug) throw new Response("Not Found", { status: 404 });

    const { getGymBySlug } = await import("~/services/gym-lookup.server");
    const gym = await getGymBySlug(slug);

    if (!gym) {
        throw new Response("Estudio no encontrado", { status: 404 });
    }

    // If user is already logged in and belongs to this gym, redirect to their panel
    try {
        const { getSession } = await import("~/services/auth.server");
        const session = await getSession(request);
        const userId = session.get("user_id") as string | undefined;

        if (userId) {
            const { supabaseAdmin } = await import("~/services/supabase.server");
            const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("role, gym_id")
                .eq("id", userId)
                .single();

            if (profile?.gym_id === gym.id) {
                const redirectMap: Record<string, string> = {
                    admin: "/admin",
                    coach: "/barista",
                    member: "/dashboard",
                };
                throw redirect(redirectMap[profile.role] || "/dashboard");
            }
        }
    } catch (e) {
        if (e instanceof Response) throw e; // re-throw redirects
        // Ignore session errors — user is not logged in
    }

    return { gym };
}

// ─── Meta ────────────────────────────────────────────────────────
export function meta({ data }: Route.MetaArgs) {
    const gymName = data?.gym?.name || "Estudio";
    return [
        { title: `${gymName} — Powered by Grind Project` },
        { name: "description", content: `Inicia sesión o regístrate en ${gymName}` },
    ];
}

// ─── Action ──────────────────────────────────────────────────────
export async function action({ params, request }: Route.ActionArgs) {
    const slug = params.slug;
    if (!slug) throw new Response("Not Found", { status: 404 });

    const { getGymBySlug } = await import("~/services/gym-lookup.server");
    const gym = await getGymBySlug(slug);
    if (!gym) throw new Response("Estudio no encontrado", { status: 404 });

    const { handleGymAuth } = await import("~/services/gym-auth.server");
    const formData = await request.formData();
    return handleGymAuth(request, gym, formData);
}

// ─── Component ───────────────────────────────────────────────────
export default function GymPortal({ loaderData, actionData }: Route.ComponentProps) {
    const { gym } = loaderData;
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [view, setView] = useState<"login" | "register">("login");

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Header with gym branding */}
                <div className="text-center">
                    {gym.logo_url ? (
                        <img
                            src={gym.logo_url}
                            alt={gym.name}
                            className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover"
                        />
                    ) : (
                        <div
                            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                            style={{ backgroundColor: gym.primary_color + "20" }}
                        >
                            💪
                        </div>
                    )}
                    <h1
                        className="text-4xl font-black text-white tracking-tight uppercase"
                        style={{ color: gym.primary_color }}
                    >
                        {gym.name}
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm italic font-medium">
                        POWERED BY GRIND PROJECT
                    </p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    {/* Tab toggle */}
                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-8">
                        <button
                            onClick={() => setView("login")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                view === "login"
                                    ? "text-white"
                                    : "text-white/40 hover:text-white"
                            }`}
                            style={view === "login" ? { backgroundColor: gym.primary_color + "30" } : undefined}
                        >
                            INICIAR SESION
                        </button>
                        <button
                            onClick={() => setView("register")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                view === "register"
                                    ? "text-white"
                                    : "text-white/40 hover:text-white"
                            }`}
                            style={view === "register" ? { backgroundColor: gym.primary_color + "30" } : undefined}
                        >
                            REGISTRARSE
                        </button>
                    </div>

                    {view === "login" ? (
                        <Form method="post" className="space-y-6">
                            <input type="hidden" name="intent" value="login" />

                            <div>
                                <label
                                    className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2"
                                    htmlFor="login-email"
                                >
                                    Correo Electronico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    id="login-email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all font-medium"
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="tu@email.com"
                                />
                            </div>

                            <div>
                                <label
                                    className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2"
                                    htmlFor="login-password"
                                >
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    id="login-password"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all font-medium"
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="••••••••"
                                />
                            </div>

                            {actionData?.error && (
                                <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                    {actionData.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                style={{ backgroundColor: gym.primary_color }}
                            >
                                {isSubmitting ? "INICIANDO..." : "ENTRAR"}
                            </button>
                        </Form>
                    ) : (
                        <Form method="post" className="space-y-6">
                            <input type="hidden" name="intent" value="register" />

                            <div>
                                <label
                                    className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2"
                                    htmlFor="reg-name"
                                >
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    name="full_name"
                                    id="reg-name"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all font-medium"
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="Ej. Maria Garcia"
                                />
                            </div>

                            <div>
                                <label
                                    className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2"
                                    htmlFor="reg-email"
                                >
                                    Correo Electronico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    id="reg-email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all font-medium"
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="tu@email.com"
                                />
                            </div>

                            <div>
                                <label
                                    className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2"
                                    htmlFor="reg-password"
                                >
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    id="reg-password"
                                    required
                                    minLength={6}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all font-medium"
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="Minimo 6 caracteres"
                                />
                            </div>

                            {actionData?.error && (
                                <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                    {actionData.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                style={{ backgroundColor: gym.primary_color }}
                            >
                                {isSubmitting ? "CREANDO CUENTA..." : "CREAR MI CUENTA"}
                            </button>
                        </Form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    v1.0.4 — Conectado a Supabase
                </p>
            </div>
        </div>
    );
}
