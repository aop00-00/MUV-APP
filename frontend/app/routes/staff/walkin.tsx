// app/routes/staff/walkin.tsx
// Front Desk: quick walk-in registration — create new member profile + optional class booking.

import { useState } from "react";
import { useFetcher } from "react-router";
import { UserPlus, CheckCircle2, Loader2 } from "lucide-react";
import type { Route } from "./+types/walkin";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymFrontDesk(request);

    // Fetch today's upcoming classes for optional booking
    const todayStart = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: classes } = await supabaseAdmin
        .from("classes")
        .select("id, title, start_time, capacity, current_enrolled")
        .eq("gym_id", gymId)
        .gte("start_time", new Date().toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time", { ascending: true });

    return {
        gymId,
        upcomingClasses: (classes ?? []).filter((c: any) => c.current_enrolled < c.capacity),
    };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymFrontDesk(request);

    const formData = await request.formData();
    const fullName = (formData.get("fullName") as string).trim();
    const email = (formData.get("email") as string | null)?.trim() ?? null;
    const phone = (formData.get("phone") as string | null)?.trim() ?? null;
    const classId = formData.get("classId") as string | null;

    if (!fullName) {
        return { success: false, error: "El nombre es obligatorio." };
    }

    // Check for duplicate email
    if (email) {
        const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .eq("gym_id", gymId)
            .maybeSingle();
        if (existing) {
            return { success: false, error: "Ya existe un socio con ese email en este estudio." };
        }
    }

    // Create auth user (if email provided) or anonymous-style profile
    let newUserId: string;

    if (email) {
        // Create Supabase auth user with temp password
        const tempPassword = Math.random().toString(36).slice(2, 10);
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
        });

        if (authError || !authUser.user) {
            return { success: false, error: `Error al crear usuario: ${authError?.message}` };
        }
        newUserId = authUser.user.id;

        // Create profile
        const { error: profileError } = await supabaseAdmin.from("profiles").insert({
            id: newUserId,
            email,
            full_name: fullName,
            phone: phone || null,
            role: "member",
            gym_id: gymId,
            credits: 1,
            balance: 0,
        });

        if (profileError) {
            return { success: false, error: `Error al crear perfil: ${profileError.message}` };
        }
    } else {
        // Walk-in without email — use a random UUID (no auth account)
        const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").insert({
            full_name: fullName,
            phone: phone || null,
            email: `walkin-${Date.now()}@noemail.local`,
            role: "member",
            gym_id: gymId,
            credits: 1,
            balance: 0,
        }).select("id").single();

        if (profileError || !profile) {
            return { success: false, error: `Error al crear perfil: ${profileError?.message}` };
        }
        newUserId = profile.id;
    }

    // Register access log (auto check-in)
    await supabaseAdmin.from("access_logs").insert({
        user_id: newUserId,
        gym_id: gymId,
        access_type: "entry",
        validated: true,
    });

    // Optional: book class
    if (classId) {
        await supabaseAdmin.from("bookings").insert({
            user_id: newUserId,
            gym_id: gymId,
            class_id: classId,
            status: "confirmed",
        });
        // Increment class enrollment
        await supabaseAdmin.rpc("increment_class_enrollment", { p_class_id: classId }).maybeSingle();
    }

    return { success: true, profileId: newUserId, fullName };
}

// ─── Component ───────────────────────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default function StaffWalkin({ loaderData }: Route.ComponentProps) {
    const { upcomingClasses } = loaderData;
    const fetcher = useFetcher<typeof action>();

    const [form, setForm] = useState({ fullName: "", email: "", phone: "", classId: "" });
    const isLoading = fetcher.state !== "idle";
    const result = fetcher.data as any;

    function submit() {
        const fd = new FormData();
        fd.set("fullName", form.fullName);
        fd.set("email", form.email);
        fd.set("phone", form.phone);
        if (form.classId) fd.set("classId", form.classId);
        fetcher.submit(fd, { method: "post" });
    }

    if (result?.success) {
        return (
            <div className="px-4 py-12 text-center space-y-4">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
                <p className="text-white font-black text-xl">¡Walk-in registrado!</p>
                <p className="text-white/60 text-sm">{result.fullName} ya puede ingresar al estudio.</p>
                <button
                    onClick={() => { fetcher.data = undefined; setForm({ fullName: "", email: "", phone: "", classId: "" }); }}
                    className="mt-2 bg-amber-400 text-black font-bold px-8 py-3 rounded-xl text-base"
                >
                    Nuevo walk-in
                </button>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
            <div>
                <h1 className="text-white font-black text-xl">Registro Walk-in</h1>
                <p className="text-white/40 text-sm mt-1">Registra un visitante nuevo para que entre al estudio.</p>
            </div>

            <div className="space-y-4">
                {/* Name */}
                <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                        Nombre completo <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.fullName}
                        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                        placeholder="Ana García"
                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-base focus:outline-none focus:border-amber-400"
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                        Email <span className="text-white/20">(opcional)</span>
                    </label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="ana@ejemplo.com"
                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-base focus:outline-none focus:border-amber-400"
                    />
                </div>

                {/* Phone */}
                <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                        Teléfono <span className="text-white/20">(opcional)</span>
                    </label>
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+52 55 1234 5678"
                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-base focus:outline-none focus:border-amber-400"
                    />
                </div>

                {/* Optional class booking */}
                {upcomingClasses.length > 0 && (
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                            Asignar a clase de hoy <span className="text-white/20">(opcional)</span>
                        </label>
                        <select
                            value={form.classId}
                            onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-amber-400"
                        >
                            <option value="">Sin clase asignada</option>
                            {upcomingClasses.map((cls: any) => (
                                <option key={cls.id} value={cls.id}>
                                    {formatTime(cls.start_time)} — {cls.title} ({cls.current_enrolled}/{cls.capacity})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {result?.error && (
                    <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
                        {result.error}
                    </p>
                )}

                <button
                    onClick={submit}
                    disabled={!form.fullName.trim() || isLoading}
                    className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <><UserPlus className="w-6 h-6" /> Registrar walk-in</>
                    )}
                </button>
            </div>
        </div>
    );
}
