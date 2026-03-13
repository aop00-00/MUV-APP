import type { Route } from "./+types/register";
import { Form, useNavigation, Link, redirect } from "react-router";
// Auth and Supabase services moved to dynamic imports inside action

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "Registro - Project Studio" },
        { name: "description", content: "Crea tu cuenta de entrenamiento" },
    ];
}

export async function action({ request }: Route.ActionArgs) {
    const { createUserSession } = await import("~/services/auth.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");

    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const full_name = formData.get("full_name") as string;
    const gym_slug = formData.get("gym_slug") as string;

    if (!email || !password || !full_name || !gym_slug) {
        return { error: "Todos los campos son obligatorios" };
    }

    // Lookup gym by slug
    const { data: gym, error: gymError } = await supabaseAdmin
        .from("gyms")
        .select("id, plan_status, name")
        .eq("slug", gym_slug.toLowerCase().trim())
        .single();

    if (gymError || !gym) {
        return { error: "Código de estudio inválido. Verifica con tu gimnasio." };
    }

    if (gym.plan_status === 'suspended' || gym.plan_status === 'cancelled') {
        return { error: "Este estudio no está activo actualmente." };
    }

    // Create auth user (without gym_id in metadata - will be in profile only)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name,
            role: "member"
        }
    });

    if (error) {
        console.error("Registration Error:", error);
        return { error: `Error al crear cuenta: ${error.message}` };
    }

    // Set gym_id in profile table
    const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ gym_id: gym.id, role: "member", full_name })
        .eq("id", data.user.id);

    if (profileError) {
        console.error("Profile Update Error:", profileError);
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        return { error: "Error al configurar el perfil. Intenta de nuevo." };
    }

    // Success: Create session and redirect to user dashboard
    return createUserSession(request, "/dashboard", data.user.id, "member");
}

export default function Register({ actionData }: Route.ComponentProps) {
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-white tracking-tight">Únete al equipo</h2>
                    <p className="text-white/40 text-sm mt-2">Crea tu perfil para empezar a entrenar.</p>
                </div>

                <Form method="post" className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">Código de Estudio</label>
                        <input
                            type="text"
                            name="gym_slug"
                            required
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="Ej: studio-valentina-abc1"
                        />
                        <p className="text-xs text-white/40 mt-1.5">Solicita este código a tu estudio</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">Nombre Completo</label>
                        <input
                            type="text"
                            name="full_name"
                            required
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="Ej. Juan Pérez"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-1.5 ml-1">Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            required
                            minLength={6}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {actionData?.error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-xs text-red-500 text-center font-bold">{actionData.error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                        {isSubmitting ? "Creando cuenta..." : "Crear mi perfil"}
                    </button>

                    <div className="text-center mt-6">
                        <p className="text-sm text-white/40">
                            ¿Ya tienes cuenta? {" "}
                            <Link to="/auth/login" className="text-blue-500 font-bold hover:underline">
                                Inicia sesión
                            </Link>
                        </p>
                    </div>
                </Form>
            </div>
        </div>
    );
}
