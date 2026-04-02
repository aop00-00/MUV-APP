import type { Route } from "./+types/login";
import { Form, useNavigation, useRouteLoaderData } from "react-router";
import { useState } from "react";
import ParticleBackgroundLight from "~/components/landing/ParticleBackgroundLight";

export async function loader() {
    return { tenantName: "Grind Project" }; // Fallback for meta
}

export function meta({ data }: Route.MetaArgs) {
    return [
        { title: `Login - ${data?.tenantName || "Grind Project"}` },
        { name: "description", content: "Selecciona tu panel de acceso" },
    ];
}

export async function action({ request }: Route.ActionArgs) {
    const { createUserSession } = await import("~/services/auth.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");

    const formData = await request.formData();
    const intent = formData.get("intent") as string;


    // ── Real Login ─────────────────────────────────────────────
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email y contraseña son requeridos" };
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
    });

    if (error || !data.user) {
        console.error("[login] signInWithPassword failed:", error?.message, error?.status);
        return { error: `Credenciales inválidas: ${error?.message || "usuario no encontrado"}` };
    }

    // Fetch profile to determine role and redirect
    // Use maybeSingle() to handle missing profiles gracefully
    const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profileError) {
        console.error("Error fetching profile during login:", profileError);
        return { error: `Error al obtener perfil: ${profileError.message}` };
    }

    // If no profile exists yet, create one (handles users created before trigger fix)
    if (!profile) {
        console.warn("[login] No profile found for user, creating one...");
        await supabaseAdmin.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || "",
            role: data.user.user_metadata?.role || "member",
            credits: 0,
            gym_id: null,
        }, { onConflict: "id" });
    }

    const role = profile?.role || data.user.user_metadata?.role || "member";
    const redirectMap: Record<string, string> = {
        member: "/dashboard",
        admin: "/admin",
        coach: "/barista",
    };

    return createUserSession(request, redirectMap[role] || "/dashboard", data.user.id, role);
}

export default function Login({ actionData }: Route.ComponentProps) {
    const navigation = useNavigation();
    const rootData = useRouteLoaderData("root") as { tenant: { name: string } } | undefined;
    const gymName = rootData?.tenant?.name ?? "GRIND PROJECT";
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="relative min-h-screen bg-transparent flex flex-col items-center justify-center p-4 overflow-hidden">
            <ParticleBackgroundLight />
            
            <div className="relative w-full max-w-md space-y-8 z-10 my-auto">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase font-display">
                        {gymName}
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm italic font-medium">
                        POWERED BY GRIND PROJECT
                    </p>
                </div>

                <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl p-8">
                    <Form method="post" className="space-y-6 text-black">
                        <input type="hidden" name="intent" value="real" />
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2" htmlFor="email">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                name="email"
                                id="email"
                                required
                                className="w-full bg-white/50 backdrop-blur-sm border border-black/10 rounded-xl p-4 md:px-4 md:py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:bg-white transition-all font-medium placeholder-gray-500"
                                placeholder="ejemplo@estudio.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2" htmlFor="password">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                name="password"
                                id="password"
                                required
                                className="w-full bg-white/50 backdrop-blur-sm border border-black/10 rounded-xl p-4 md:px-4 md:py-3 text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:bg-white transition-all font-medium placeholder-gray-500"
                                placeholder="••••••••"
                            />
                        </div>

                        {actionData?.error && (
                            <p className="text-red-600 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                                ⚠️ {actionData.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gray-950 hover:bg-gray-900 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-black/10 active:scale-95 disabled:opacity-50 mt-2"
                        >
                            {isSubmitting ? "INICIANDO..." : "ENTRAR A MI ESTUDIO"}
                        </button>
                    </Form>
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    v1.0.4 — Conectado a Supabase
                </p>
            </div>
        </div>
    );
}
