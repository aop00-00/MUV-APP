// admin/coaches.tsx — Coach management (Supabase)
import type { Route } from "./+types/coaches";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { UserCog, Plus, Mail, MoreHorizontal, CheckCircle, Clock, Trash2 } from "lucide-react";

type Role = "titular" | "part-time" | "sustituto";
type Status = "activo" | "invitado" | "inactivo";

interface Coach {
    id: string;
    name: string;
    email: string;
    role: Role;
    specialties: string[];
    status: Status;
    sessionsThisMonth: number;
    joinedAt: string;
    avatar: string;
}

const ROLE_LABELS: Record<Role, string> = { titular: "Titular", "part-time": "Part-time", sustituto: "Sustituto" };
const ROLE_COLORS: Record<Role, string> = { titular: "bg-purple-100 text-purple-700", "part-time": "bg-blue-100 text-blue-700", sustituto: "bg-white/5/10 text-white/60" };
const STATUS_CFG: Record<Status, { label: string; icon: React.ReactNode; color: string }> = {
    activo: { label: "Activo", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-green-600" },
    invitado: { label: "Invitado", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-600" },
    inactivo: { label: "Inactivo", icon: <MoreHorizontal className="w-3.5 h-3.5" />, color: "text-white/40" },
};
const AVATAR_COLORS = ["bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-green-100 text-green-700", "bg-blue-100 text-blue-700", "bg-pink-100 text-pink-700"];

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const { getGymCoaches } = await import("~/services/coach.server");

    const rawCoaches = await getGymCoaches(gymId);

    const coaches: Coach[] = rawCoaches.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role,
        specialties: c.specialties ?? [],
        status: c.status,
        sessionsThisMonth: c.sessions_this_month,
        joinedAt: new Date(c.created_at).toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
        avatar: c.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase(),
    }));

    return { coaches };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
        const { createCoach } = await import("~/services/coach.server");
        const specialtiesRaw = formData.get("specialties") as string || "";

        // Enforce per-plan coach limits (DB trigger is the hard stop, this is the UX layer)
        const { PLAN_FEATURES } = await import("~/config/plan-features");
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const { data: gymData } = await supabaseAdmin.from("gyms").select("plan_id").eq("id", gymId).single();
        const gymPlanDef = PLAN_FEATURES[(gymData?.plan_id || "starter") as keyof typeof PLAN_FEATURES];
        const coachLimit = gymPlanDef?.maxCoaches;
        if (coachLimit != null) {   // null/undefined = unlimited
            const { getGymCoaches } = await import("~/services/coach.server");
            const existing = await getGymCoaches(gymId);
            if (existing.length >= coachLimit) {
                return {
                    success: false,
                    error: `Tu plan ${gymPlanDef.label} permite máximo ${coachLimit} coach activo. Actualiza para gestionar tu equipo completo.`,
                    limitReached: "coaches",
                };
            }
        }
        await createCoach({
            gymId,
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            role: formData.get("role") as string,
            specialties: specialtiesRaw.split(",").map(s => s.trim()).filter(Boolean),
        });
        return { success: true, intent };
    }

    if (intent === "delete") {
        const { deleteCoach } = await import("~/services/coach.server");
        const coachId = formData.get("coachId") as string;
        await deleteCoach(coachId, gymId);
        return { success: true, intent };
    }

    return { success: false };
}

// ─── Component ───────────────────────────────────────────────────
export default function Coaches({ loaderData }: Route.ComponentProps) {
    const { coaches } = loaderData;
    const fetcher = useFetcher();
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", role: "titular" as Role, specialties: "" });

    // Close modal after successful creation
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data?.intent === "create") {
            setShowModal(false);
            setForm({ name: "", email: "", role: "titular", specialties: "" });
        }
    }, [fetcher.state, fetcher.data]);

    function save() {
        const formData = new FormData();
        formData.set("intent", "create");
        formData.set("name", form.name);
        formData.set("email", form.email);
        formData.set("role", form.role);
        formData.set("specialties", form.specialties);
        fetcher.submit(formData, { method: "post" });
    }

    function remove(id: string) {
        const formData = new FormData();
        formData.set("intent", "delete");
        formData.set("coachId", id);
        fetcher.submit(formData, { method: "post" });
    }

    const active = coaches.filter(c => c.status === "activo").length;
    const pending = coaches.filter(c => c.status === "invitado").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Coaches</h1>
                    <p className="text-white/50 text-sm mt-0.5">Gestiona al equipo de instructores de tu estudio.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Agregar coach
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Coaches activos", value: active, color: "text-green-600" },
                    { label: "Invitaciones pendientes", value: pending, color: "text-amber-600" },
                    { label: "Total equipo", value: coaches.length, color: "text-white" },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-xl border border-white/[0.08] p-4">
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Coach cards */}
            {coaches.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <UserCog className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin coaches todavía</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Agrega a tu primer coach manualmente para empezar a asignarles clases y horarios.</p>
                    <button onClick={() => setShowModal(true)} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Agregar coach</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {coaches.map((c, idx) => {
                        const scfg = STATUS_CFG[c.status];
                        const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                        return (
                            <div key={c.id} className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-11 h-11 rounded-xl ${avatarColor} text-sm font-black flex items-center justify-center shrink-0`}>
                                            {c.avatar}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-white">{c.name}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[c.role]}`}>{ROLE_LABELS[c.role]}</span>
                                            </div>
                                            <div className={`flex items-center gap-1 text-xs mt-0.5 ${scfg.color}`}>
                                                {scfg.icon}
                                                <span className="font-medium">{scfg.label}</span>
                                                {c.status === "invitado" && <span className="text-white/40">— Pendiente de aceptar</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => remove(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4 text-red-400" /></button>
                                </div>

                                {/* Specialties */}
                                {c.specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {c.specialties.map(sp => (
                                            <span key={sp} className="text-xs bg-white/5/10 text-white/60 px-2.5 py-0.5 rounded-full">{sp}</span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-sm">
                                    <div>
                                        <p className="text-xs text-white/40">Sesiones este mes</p>
                                        <p className="font-bold text-white">{c.sessionsThisMonth}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-white/40">Desde</p>
                                        <p className="font-medium text-white/60 text-xs">{c.joinedAt}</p>
                                    </div>
                                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-amber-600 transition-colors">
                                        <Mail className="w-3.5 h-3.5" />
                                        Contactar
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add coach modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-lg font-black text-white">Agregar nuevo coach</h2>
                            <p className="text-sm text-white/50 mt-0.5">Ingresa los detalles para crear el perfil del instructor.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre completo *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Valentina Cruz" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Correo electrónico *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="coach@ejemplo.com" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Rol</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400">
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Especialidades (separadas por coma)</label><input value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} placeholder="Pilates Reformer, Yoga Flow" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.name || !form.email} className="flex-1 flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">
                                <Plus className="w-4 h-4" /> Guardar coach
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
