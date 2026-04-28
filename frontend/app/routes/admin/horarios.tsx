// admin/horarios.tsx — Recurring schedules ("factory" that generates sessions)
import { useState, useEffect } from "react";
import { Clock, Plus, Pencil, Trash2, User, MapPin, X } from "lucide-react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/horarios";

type Day = "Lun" | "Mar" | "Mié" | "Jue" | "Vie" | "Sáb" | "Dom";
const DAYS: Day[] = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DAY_COLOR: Record<Day, string> = {
    Lun: "bg-blue-100 text-blue-700",
    Mar: "bg-purple-100 text-purple-700",
    Mié: "bg-green-100 text-green-700",
    Jue: "bg-orange-100 text-orange-700",
    Vie: "bg-pink-100 text-pink-700",
    Sáb: "bg-amber-100 text-amber-700",
    Dom: "bg-red-100 text-red-700",
};

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { getGymCoaches } = await import("~/services/coach.server");
    const { getGymRooms, getGymClassTypes } = await import("~/services/room.server");
    const { gymId } = await requireGymAdmin(request);

    const [coaches, rooms, classTypes] = await Promise.all([
        getGymCoaches(gymId),
        getGymRooms(gymId),
        getGymClassTypes(gymId),
    ]);

    // Fetch schedules from the schedules table
    const { data: schedules, error } = await supabaseAdmin
        .from("schedules")
        .select("*")
        .eq("gym_id", gymId)
        .order("time", { ascending: true });

    if (error) console.error("Error fetching schedules:", error);

    return {
        schedules: (schedules ?? []) as any[],
        coaches,
        rooms: rooms.filter(r => r.is_active),
        classTypes,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create_class_type") {
        const { createClassType } = await import("~/services/room.server");
        const { checkResourceLimit, getUpgradeMessage } = await import("~/services/plan-limits.server");

        const { data: gymData } = await supabaseAdmin.from("gyms").select("plan_id").eq("id", gymId).single();
        const planId = (gymData?.plan_id || "emprendedor") as any;
        const check = await checkResourceLimit(gymId, planId, "max_class_types");
        if (!check.allowed) {
            return {
                success: false,
                intent,
                error: getUpgradeMessage("max_class_types", check.limit!, planId),
            };
        }

        const newType = await createClassType({
            gymId,
            name: formData.get("name") as string,
            color: formData.get("color") as string || "#8b5cf6",
            duration: parseInt(formData.get("duration") as string, 10) || 50,
            creditsRequired: parseInt(formData.get("credits") as string, 10) || 1,
            description: null,
        });
        return { success: true, intent, classType: newType };
    }

    const tzOffset = parseInt(formData.get("tz_offset") as string ?? "0", 10);

    if (intent === "create") {
        const days = formData.get("days") as string;
        const { error } = await supabaseAdmin
            .from("schedules")
            .insert({
                gym_id: gymId,
                class_name: formData.get("className") as string,
                coach_name: formData.get("coach") as string,
                coach_id: formData.get("coachId") as string || null,
                room_name: formData.get("room") as string,
                room_id: formData.get("roomId") as string || null,
                days: JSON.parse(days),
                time: formData.get("time") as string,
                duration: parseInt(formData.get("duration") as string, 10),
                capacity: parseInt(formData.get("capacity") as string, 10),
                color: formData.get("color") as string || "#8b5cf6",
                is_active: true,
            });

        if (error) throw new Error(`Error creating schedule: ${error.message}`);

        // Auto-sync after creation
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId, 4, tzOffset);

        return { success: true, intent };
    }

    if (intent === "update") {
        const scheduleId = formData.get("scheduleId") as string;
        const days = formData.get("days") as string;
        const { error } = await supabaseAdmin
            .from("schedules")
            .update({
                class_name: formData.get("className") as string,
                coach_name: formData.get("coach") as string,
                coach_id: formData.get("coachId") as string || null,
                room_name: formData.get("room") as string,
                room_id: formData.get("roomId") as string || null,
                days: JSON.parse(days),
                time: formData.get("time") as string,
                duration: parseInt(formData.get("duration") as string, 10),
                capacity: parseInt(formData.get("capacity") as string, 10),
                color: formData.get("color") as string || "#8b5cf6",
            })
            .eq("id", scheduleId)
            .eq("gym_id", gymId);

        if (error) throw new Error(`Error updating schedule: ${error.message}`);

        // Auto-sync after update
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId, 4, tzOffset);

        return { success: true, intent };
    }

    if (intent === "toggle") {
        const scheduleId = formData.get("scheduleId") as string;
        const isActive = formData.get("isActive") === "true";
        const { error } = await supabaseAdmin
            .from("schedules")
            .update({ is_active: isActive })
            .eq("id", scheduleId)
            .eq("gym_id", gymId);

        if (error) throw new Error(`Error toggling schedule: ${error.message}`);

        // Auto-sync after toggle
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId, 4, tzOffset);

        return { success: true, intent };
    }

    if (intent === "delete") {
        const scheduleId = formData.get("scheduleId") as string;

        // Delete future classes linked to this schedule BEFORE deleting the schedule.
        // The FK has ON DELETE SET NULL, so if we delete the schedule first the
        // classes lose their schedule_id and the sync can no longer find them.
        const now = new Date().toISOString();
        await supabaseAdmin
            .from("classes")
            .delete()
            .eq("schedule_id", scheduleId)
            .gte("start_time", now);

        const { error } = await supabaseAdmin
            .from("schedules")
            .delete()
            .eq("id", scheduleId)
            .eq("gym_id", gymId);

        if (error) throw new Error(`Error deleting schedule: ${error.message}`);

        return { success: true, intent };
    }

    if (intent === "sync_manual") {
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        const result = await syncGymClassesFromSchedules(gymId, 4, tzOffset);
        return { success: true, intent, count: result.count };
    }

    return { success: true, intent };
}

// ─── Main Component ──────────────────────────────────────────────
export default function Horarios({ loaderData }: Route.ComponentProps) {
    const { schedules, coaches, rooms, classTypes: initialClassTypes } = loaderData;
    const fetcher = useFetcher();
    const typeFetcher = useFetcher();

    // Local copy of classTypes so we can append newly created ones without a full reload
    const [classTypes, setClassTypes] = useState(initialClassTypes);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    const [form, setForm] = useState({
        className: "",
        color: "#8b5cf6",
        coach: "",
        coachId: "",
        room: "",
        roomId: "",
        days: [] as Day[],
        time: "08:00",
        duration: 50,
        capacity: 8
    });

    // State for inline new class type form
    const [showNewType, setShowNewType] = useState(false);
    const [newTypeForm, setNewTypeForm] = useState({ name: "", duration: 50, credits: 1, color: "#8b5cf6" });
    const [typeError, setTypeError] = useState<string | null>(null);

    // When a new class type is created, append it and auto-select it
    useEffect(() => {
        if (typeFetcher.state !== "idle") return;
        if (typeFetcher.data?.success && typeFetcher.data?.classType) {
            const created = typeFetcher.data.classType as any;
            setClassTypes(prev => [...prev, created]);
            setForm(f => ({ ...f, className: created.name, duration: created.duration, color: created.color }));
            setNewTypeForm({ name: "", duration: 50, credits: 1, color: "#8b5cf6" });
            setTypeError(null);
            setShowNewType(false);
        } else if (typeFetcher.data?.error) {
            setTypeError(typeFetcher.data.error as string);
        }
    }, [typeFetcher.data, typeFetcher.state]);

    function submitNewType() {
        if (!newTypeForm.name.trim()) return;
        const fd = new FormData();
        fd.set("intent", "create_class_type");
        fd.set("name", newTypeForm.name.trim());
        fd.set("duration", String(newTypeForm.duration));
        fd.set("credits", String(newTypeForm.credits));
        fd.set("color", newTypeForm.color);
        typeFetcher.submit(fd, { method: "post" });
    }

    // Close modal and show toast after successful submission
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            setShowModal(false);
            const intent = fetcher.data.intent as string;
            const msgs: Record<string, string> = {
                create: "Horario creado y sesiones generadas en el calendario",
                update: "Horario actualizado y calendario sincronizado",
                delete: "Horario eliminado y sesiones futuras removidas",
                toggle: "Estado del horario actualizado",
                sync_manual: `Calendario sincronizado — ${fetcher.data.count ?? 0} sesiones generadas`,
            };
            setToast({ msg: msgs[intent] ?? "Operación completada", type: "success" });
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [fetcher.data, fetcher.state]);

    function openNew() {
        const firstType = classTypes[0];
        setForm({
            className: firstType?.name ?? "",
            color: firstType?.color ?? "#8b5cf6",
            coach: coaches.length > 0 ? coaches[0].name : "",
            coachId: coaches.length > 0 ? coaches[0].id : "",
            room: rooms.length > 0 ? rooms[0].name : "",
            roomId: rooms.length > 0 ? rooms[0].id : "",
            days: [],
            time: "08:00",
            duration: firstType?.duration ?? 50,
            capacity: rooms.length > 0 ? rooms[0].capacity : 8,
        });
        setEditId(null);
        setShowModal(true);
    }

    function openEdit(s: any) {
        setForm({
            className: s.class_name,
            color: s.color || "#8b5cf6",
            coach: s.coach_name,
            coachId: s.coach_id || "",
            room: s.room_name,
            roomId: s.room_id || "",
            days: s.days || [],
            time: s.time,
            duration: s.duration,
            capacity: s.capacity,
        });
        setEditId(s.id);
        setShowModal(true);
    }

    function handleClassTypeChange(name: string) {
        const type = classTypes.find(t => t.name === name);
        if (type) {
            setForm(f => ({ ...f, className: name, duration: type.duration, color: type.color }));
        } else {
            setForm(f => ({ ...f, className: name }));
        }
    }

    function toggleDay(d: Day) {
        setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));
    }

    function save() {
        const fd = new FormData();
        fd.set("intent", editId ? "update" : "create");
        if (editId) fd.set("scheduleId", editId);
        fd.set("className", form.className);
        fd.set("color", form.color);
        fd.set("coach", form.coach);
        fd.set("coachId", form.coachId);
        fd.set("room", form.room);
        fd.set("roomId", form.roomId);
        fd.set("days", JSON.stringify(form.days));
        fd.set("time", form.time);
        fd.set("duration", String(form.duration));
        fd.set("capacity", String(form.capacity));
        fd.set("tz_offset", String(new Date().getTimezoneOffset()));
        fetcher.submit(fd, { method: "post" });
    }

    function toggle(id: string, currentActive: boolean) {
        const fd = new FormData();
        fd.set("intent", "toggle");
        fd.set("scheduleId", id);
        fd.set("isActive", String(!currentActive));
        fd.set("tz_offset", String(new Date().getTimezoneOffset()));
        fetcher.submit(fd, { method: "post" });
    }

    function remove(id: string) {
        if (!confirm("¿Seguro que deseas eliminar este horario y todas sus sesiones futuras?")) return;
        const fd = new FormData();
        fd.set("intent", "delete");
        fd.set("scheduleId", id);
        fetcher.submit(fd, { method: "post" });
    }

    function syncManual() {
        const fd = new FormData();
        fd.set("intent", "sync_manual");
        fd.set("tz_offset", String(new Date().getTimezoneOffset()));
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Horarios</h1>
                    <p className="text-white/50 text-sm mt-0.5">Define horarios recurrentes basado en tus tipos de sesión.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={syncManual} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all border border-white/10 shadow-lg" title="Sincroniza las próximas 4 semanas">
                         {fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'sync_manual' ? "Sincronizando..." : "🔄 Sincronizar Calendario"}
                    </button>
                    <button onClick={openNew} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-4 h-4" /> Nuevo horario
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800 text-sm">Los horarios utilizan la información de <strong>Operaciones &gt; Tipos de clase</strong> y <strong>Coaches</strong> registrados en el sistema.</p>
            </div>

            {schedules.length === 0 && (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <p className="text-5xl mb-4">🗓️</p>
                    <h2 className="text-lg font-bold text-white mb-2">Sin horarios todavía</h2>
                    <p className="text-white/50 text-sm mb-6">Crea tu primer horario recurrente seleccionando un tipo de sesión.</p>
                    <button onClick={openNew} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all">+ Crear horario</button>
                </div>
            )}

            {schedules.length > 0 && (
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-x-auto">
                    <table className="min-w-[640px] w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/[0.08]">
                            <tr>
                                {["Clase", "Coach", "Sala", "Días", "Hora", "Cap.", "Estado", ""].map(h => (
                                    <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {schedules.map(s => (
                                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-white">{s.class_name}</p>
                                        <p className="text-[10px] text-white/40 uppercase font-bold">{s.duration} MIN</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><User className="w-3 h-3 text-white/40" /></div>
                                            <span className="text-white/70">{s.coach_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-white/50">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>{s.room_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {(s.days || []).map((d: Day) => <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${DAY_COLOR[d] || ""}`}>{d}</span>)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-white/70 font-bold">{s.time}</td>
                                    <td className="px-4 py-3 text-white/50">{s.capacity} <span className="text-[10px]">LUG</span></td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => toggle(s.id, s.is_active)} className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${s.is_active ? "bg-green-100 text-green-700" : "bg-white/10 text-white/50"}`}>
                                            {s.is_active ? "Activo" : "Pausado"}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5 text-white/40" /></button>
                                            <button onClick={() => remove(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Toast notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    <span>{toast.type === "success" ? "✓" : "✕"}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/[0.08] backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "rgba(30,30,50,0.85)" }}>

                        {/* ── MODO: Crear nuevo tipo de sesión ── */}
                        {showNewType ? (
                            <>
                                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewType(false)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Nuevo tipo de sesión</h2>
                                        <p className="text-xs text-white/50 mt-0.5">Se guardará y seleccionará automáticamente</p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Nombre de la clase</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newTypeForm.name}
                                            onChange={e => setNewTypeForm(f => ({ ...f, name: e.target.value }))}
                                            onKeyDown={e => e.key === "Enter" && submitNewType()}
                                            placeholder="Ej: Yoga Flow, HIIT, Pilates..."
                                            className="w-full rounded-xl px-4 py-3 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Duración</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={newTypeForm.duration}
                                                    onChange={e => setNewTypeForm(f => ({ ...f, duration: +e.target.value }))}
                                                    min={5}
                                                    className="w-full rounded-xl px-4 py-3 pr-12 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                                    style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                                />
                                                <span className="absolute right-3 top-3.5 text-[10px] text-white/50 font-bold">MIN</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Créditos</label>
                                            <input
                                                type="number"
                                                value={newTypeForm.credits}
                                                onChange={e => setNewTypeForm(f => ({ ...f, credits: +e.target.value }))}
                                                min={1}
                                                className="w-full rounded-xl px-4 py-3 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                                style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Color identificador</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={newTypeForm.color}
                                                onChange={e => setNewTypeForm(f => ({ ...f, color: e.target.value }))}
                                                className="w-12 h-12 rounded-xl border border-white/20 cursor-pointer bg-white/10 p-0.5"
                                            />
                                            <div className="flex gap-2 flex-wrap">
                                                {["#8b5cf6","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#f97316"].map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setNewTypeForm(f => ({ ...f, color: c }))}
                                                        className={`w-8 h-8 rounded-lg border-2 transition-all ${newTypeForm.color === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {typeError && (
                                    <div className="mx-6 mb-2 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm flex items-start gap-2">
                                        <span className="mt-0.5">⚠</span>
                                        <div>
                                            <p className="font-semibold">Límite de plan alcanzado</p>
                                            <p className="text-xs mt-0.5 text-red-300/80">{typeError} Para agregar más tipos, actualiza tu plan.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="p-6 border-t border-white/10 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowNewType(false); setTypeError(null); }}
                                        className="flex-1 px-4 py-2.5 border border-white/25 rounded-xl text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitNewType}
                                        disabled={!newTypeForm.name.trim() || typeFetcher.state !== "idle" || !!typeError}
                                        className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:bg-white/10 disabled:text-white/30 text-black font-black px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95"
                                    >
                                        {typeFetcher.state !== "idle" ? "Guardando..." : "Crear y seleccionar"}
                                    </button>
                                </div>
                            </>
                        ) : (
                        /* ── MODO: Formulario de horario normal ── */
                        <>
                            <div className="p-6 border-b border-white/10">
                                <h2 className="text-lg font-black text-white">{editId ? "Editar horario" : "Nuevo horario"}</h2>
                            </div>

                            <div className="p-6 space-y-4 text-left">
                                {/* Tipo de sesión */}
                                <div>
                                    <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">Tipo de sesión</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={form.className}
                                            onChange={e => handleClassTypeChange(e.target.value)}
                                            className="flex-1 rounded-xl px-3 py-2.5 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        >
                                            {classTypes.length === 0 && <option value="">— Crea un tipo primero —</option>}
                                            {classTypes.map(ct => (
                                                <option key={ct.id} value={ct.name}>{ct.name} ({ct.duration}min)</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewType(true)}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 backdrop-blur-md transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            <Plus className="w-4 h-4 text-amber-400" />
                                            Nuevo tipo
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Coach</label>
                                        <select
                                            value={form.coachId}
                                            onChange={e => {
                                                const c = coaches.find(x => x.id === e.target.value);
                                                setForm(f => ({ ...f, coachId: e.target.value, coach: c ? c.name : "" }));
                                            }}
                                            className="w-full rounded-xl px-3 py-2.5 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        >
                                            {coaches.length > 0
                                                ? coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                                : <option value="">Sin coaches</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Sala</label>
                                        <select
                                            value={form.roomId}
                                            onChange={e => {
                                                const r = rooms.find(x => x.id === e.target.value);
                                                setForm(f => ({ ...f, roomId: e.target.value, room: r ? r.name : "" }));
                                            }}
                                            className="w-full rounded-xl px-3 py-2.5 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        >
                                            {rooms.length > 0
                                                ? rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                                : <option value="">Sin salas</option>}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">Días de la semana</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => toggleDay(d)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${form.days.includes(d) ? "bg-amber-400 border-amber-400 text-black" : "border-white/20 text-white/60 bg-white/5 hover:bg-white/10 hover:text-white"}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Hora inicio</label>
                                        <input
                                            type="time"
                                            value={form.time}
                                            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                                            className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Duración</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={form.duration}
                                                onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))}
                                                className="w-full rounded-xl px-3 py-2.5 pr-10 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                                style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                            />
                                            <span className="absolute right-3 top-3 text-[10px] text-white/50 font-bold">MIN</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">Capacidad</label>
                                        <input
                                            type="number"
                                            value={form.capacity}
                                            onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
                                            className="w-full rounded-xl px-3 py-2.5 text-sm border border-white/20 focus:outline-none focus:border-amber-400 transition-all"
                                            style={{ backgroundColor: "#1e1e30", color: "#ffffff", colorScheme: "dark" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/10 flex gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-white/25 rounded-xl text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={save}
                                    disabled={form.days.length === 0 || !form.className}
                                    className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:bg-white/10 disabled:text-white/30 text-black font-black px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95"
                                >
                                    {fetcher.state !== "idle" ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
