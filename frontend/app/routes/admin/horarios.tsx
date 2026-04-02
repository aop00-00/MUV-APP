// admin/horarios.tsx — Recurring schedules ("factory" that generates sessions)
import { useState, useEffect } from "react";
import { Clock, Plus, Pencil, Trash2, ChevronDown, User, MapPin } from "lucide-react";
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
                is_active: true,
            });

        if (error) throw new Error(`Error creating schedule: ${error.message}`);
        
        // Auto-sync after creation
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId);

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
            })
            .eq("id", scheduleId)
            .eq("gym_id", gymId);

        if (error) throw new Error(`Error updating schedule: ${error.message}`);
        
        // Auto-sync after update
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId);

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
        await syncGymClassesFromSchedules(gymId);

        return { success: true, intent };
    }

    if (intent === "delete") {
        const scheduleId = formData.get("scheduleId") as string;
        const { error } = await supabaseAdmin
            .from("schedules")
            .delete()
            .eq("id", scheduleId)
            .eq("gym_id", gymId);

        if (error) throw new Error(`Error deleting schedule: ${error.message}`);

        // Auto-sync after delete (to remove classes generated by this template)
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        await syncGymClassesFromSchedules(gymId);

        return { success: true, intent };
    }

    if (intent === "sync_manual") {
        const { syncGymClassesFromSchedules } = await import("~/services/booking.server");
        const result = await syncGymClassesFromSchedules(gymId);
        return { success: true, intent, count: result.count };
    }

    return { success: true, intent };
}

// ─── Main Component ──────────────────────────────────────────────
export default function Horarios({ loaderData }: Route.ComponentProps) {
    const { schedules, coaches, rooms, classTypes } = loaderData;
    const fetcher = useFetcher();

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({
        className: "",
        coach: "",
        coachId: "",
        room: "",
        roomId: "",
        days: [] as Day[],
        time: "08:00",
        duration: 50,
        capacity: 8
    });

    // Close modal after successful submission
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            setShowModal(false);
        }
    }, [fetcher.data, fetcher.state]);

    function openNew() {
        setForm({
            className: classTypes.length > 0 ? classTypes[0].name : "",
            coach: coaches.length > 0 ? coaches[0].name : "",
            coachId: coaches.length > 0 ? coaches[0].id : "",
            room: rooms.length > 0 ? rooms[0].name : "",
            roomId: rooms.length > 0 ? rooms[0].id : "",
            days: [],
            time: "08:00",
            duration: classTypes.length > 0 ? classTypes[0].duration : 50,
            capacity: rooms.length > 0 ? rooms[0].capacity : 8,
        });
        setEditId(null);
        setShowModal(true);
    }

    function openEdit(s: any) {
        setForm({
            className: s.class_name,
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
            setForm(f => ({ ...f, className: name, duration: type.duration, capacity: f.capacity }));
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
        fd.set("coach", form.coach);
        fd.set("coachId", form.coachId);
        fd.set("room", form.room);
        fd.set("roomId", form.roomId);
        fd.set("days", JSON.stringify(form.days));
        fd.set("time", form.time);
        fd.set("duration", String(form.duration));
        fd.set("capacity", String(form.capacity));
        fetcher.submit(fd, { method: "post" });
    }

    function toggle(id: string, currentActive: boolean) {
        const fd = new FormData();
        fd.set("intent", "toggle");
        fd.set("scheduleId", id);
        fd.set("isActive", String(!currentActive));
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
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                    <table className="w-full text-sm">
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

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-lg font-black text-white">{editId ? "Editar horario" : "Nuevo horario"}</h2>
                        </div>
                        <div className="p-6 space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Tipo de sesión</label>
                                {classTypes.length > 0 ? (
                                    <select
                                        value={form.className}
                                        onChange={e => handleClassTypeChange(e.target.value)}
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400"
                                    >
                                        {classTypes.map(ct => <option key={ct.id} value={ct.name}>{ct.name} ({ct.duration}min)</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={form.className}
                                        onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                                        placeholder="Ej: Pilates Reformer, Yoga Flow..."
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Coach</label>
                                    <select
                                        value={form.coachId}
                                        onChange={e => {
                                            const c = coaches.find(x => x.id === e.target.value);
                                            setForm(f => ({ ...f, coachId: e.target.value, coach: c ? c.name : "" }));
                                        }}
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400"
                                    >
                                        {coaches.length > 0 ? (
                                            coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                        ) : (
                                            <option value="">Sin coaches</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Sala</label>
                                    <select
                                        value={form.roomId}
                                        onChange={e => {
                                            const r = rooms.find(x => x.id === e.target.value);
                                            setForm(f => ({ ...f, roomId: e.target.value, room: r ? r.name : "" }));
                                        }}
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400"
                                    >
                                        {rooms.length > 0 ? (
                                            rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                        ) : (
                                            <option value="">Sin salas</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Días de la semana</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS.map(d => (
                                        <button key={d} type="button" onClick={() => toggleDay(d)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${form.days.includes(d) ? "bg-amber-400 border-amber-400 text-black" : "border-white/[0.08] text-white/50 hover:border-white/10"}`}>{d}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Hora inicio</label>
                                    <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Duración</label>
                                    <div className="relative">
                                        <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                        <span className="absolute right-3 top-2.5 text-[10px] text-white/40 font-bold">MIN</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Capacidad</label>
                                    <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">Cancelar</button>
                            <button onClick={save} disabled={form.days.length === 0 || !form.className} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
