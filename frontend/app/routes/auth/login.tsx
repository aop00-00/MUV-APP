import type { Route } from "./+types/login";
import { Form, useNavigation, useRouteLoaderData } from "react-router";
import { useTenant } from "~/context/TenantContext";
// Auth and Supabase services moved to dynamic imports inside action
import { useState } from "react";

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

    // ── Demo Login ─────────────────────────────────────────────
    if (intent === "demo") {
        const role = formData.get("role") as string;
        const redirectMap: Record<string, string> = {
            member: "/dashboard",
            admin: "/admin",
            coach: "/barista",
        };
        const redirectTo = redirectMap[role] ?? "/dashboard";
        return createUserSession(request, redirectTo, role);
    }

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
        return { error: "Credenciales inválidas" };
    }

    // Fetch profile to determine role and redirect
    const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
        console.error("Error fetching profile during login:", profileError);
        return { error: `Error al obtener perfil: ${profileError.message}` };
    }

    const role = profile?.role || "member";
    const redirectMap: Record<string, string> = {
        member: "/dashboard",
        admin: "/admin",
        coach: "/barista",
    };

    return createUserSession(request, redirectMap[role] || "/dashboard", data.user.id, role);
}

export default function Login({ actionData }: Route.ComponentProps) {
    const navigation = useNavigation();
    const { config } = useTenant();
    const [view, setView] = useState<"real" | "demo">("real");
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                        {config.name}
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm italic font-medium">
                        POWERED BY GRIND PROJECT
                    </p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-8">
                        <button
                            onClick={() => setView("real")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === "real" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                        >
                            INGRESO REAL
                        </button>
                        <button
                            onClick={() => setView("demo")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === "demo" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                        >
                            ACCESO DEMO
                        </button>
                    </div>

                    {view === "real" ? (
                        <Form method="post" className="space-y-6">
                            <input type="hidden" name="intent" value="real" />
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2" htmlFor="email">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    placeholder="ejemplo@estudio.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2" htmlFor="password">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    id="password"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>

                            {actionData?.error && (
                                <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                    ⚠️ {actionData.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? "INICIANDO..." : "ENTRAR A MI ESTUDIO"}
                            </button>
                        </Form>
                    ) : (
                        <div className="space-y-3">
                            {[
                                { role: "admin", label: "Admin", emoji: "🛡️", color: "from-purple-600 to-fuchsia-700" },
                                { role: "member", label: "Usuario", emoji: "👤", color: "from-blue-600 to-indigo-700" },
                                { role: "coach", label: "Barista", emoji: "☕", color: "from-amber-600 to-orange-700" }
                            ].map((p) => (
                                <Form method="post" key={p.role}>
                                    <input type="hidden" name="intent" value="demo" />
                                    <input type="hidden" name="role" value={p.role} />
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full bg-gradient-to-r ${p.color} text-white rounded-xl p-4 flex items-center gap-4 transition-all opacity-80 hover:opacity-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50`}
                                    >
                                        <span className="text-2xl">{p.emoji}</span>
                                        <div className="text-left">
                                            <p className="text-sm font-black">{p.label}</p>
                                            <p className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Modo Prueba</p>
                                        </div>
                                    </button>
                                </Form>
                            ))}
                        </div>
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
