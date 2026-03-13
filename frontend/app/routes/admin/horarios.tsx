// admin/horarios.tsx — Recurring schedules ("factory" that generates sessions)
import { useState } from "react";
import { Clock, Plus, Pencil, Trash2, ChevronDown, User, MapPin } from "lucide-react";

type Day = "Lun" | "Mar" | "Mié" | "Jue" | "Vie" | "Sáb" | "Dom";
const DAYS: Day[] = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Information from "Sesiones/Operaciones" (Class Types)
const SESSION_TYPES = [
    { name: "Pilates Reformer", duration: 50, capacity: 8, color: "#3B82F6" },
    { name: "Yoga Flow", duration: 60, capacity: 12, color: "#10B981" },
    { name: "Barre Intensivo", duration: 45, capacity: 10, color: "#EC4899" },
];

const ROOMS = ["Sala A — Reformers", "Sala B — Studio", "Sala C — Yoga"];

interface Schedule {
    id: string;
    className: string;
    coach: string;
    room: string;
    days: Day[];
    time: string;
    duration: number; // minutes
    capacity: number;
    active: boolean;
}

const MOCK: Schedule[] = [];

const DAY_COLOR: Record<Day, string> = {
    Lun: "bg-blue-100 text-blue-700",
    Mar: "bg-purple-100 text-purple-700",
    Mié: "bg-green-100 text-green-700",
    Jue: "bg-orange-100 text-orange-700",
    Vie: "bg-pink-100 text-pink-700",
    Sáb: "bg-amber-100 text-amber-700",
    Dom: "bg-red-100 text-red-700",
};

import { useTenant } from "~/context/TenantContext";

export default function Horarios() {
    const { config } = useTenant();
    const coaches = config.coaches;

    const [schedules, setSchedules] = useState<Schedule[]>(MOCK);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({
        className: "",
        coach: coaches.length > 0 ? coaches[0].name : "",
        room: ROOMS[0],
        days: [] as Day[],
        time: "08:00",
        duration: 50,
        capacity: 8
    });

    function openNew() {
        setForm({
            className: "",
            coach: coaches.length > 0 ? coaches[0].name : "",
            room: ROOMS[0],
            days: [],
            time: "08:00",
            duration: 50,
            capacity: 8
        });
        setEditId(null);
        setShowModal(true);
    }

    function openEdit(s: Schedule) {
        setForm({ className: s.className, coach: s.coach, room: s.room, days: s.days, time: s.time, duration: s.duration, capacity: s.capacity });
        setEditId(s.id);
        setShowModal(true);
    }

    function handleClassTypeChange(name: string) {
        const type = SESSION_TYPES.find(t => t.name === name);
        if (type) {
            setForm(f => ({ ...f, className: name, duration: type.duration, capacity: type.capacity }));
        }
    }

    function toggleDay(d: Day) { setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] })); }

    function save() {
        if (editId) {
            setSchedules(s => s.map(x => x.id === editId ? { ...x, ...form } : x));
        } else {
            setSchedules(s => [...s, { id: `h${Date.now()}`, ...form, active: true }]);
        }
        setShowModal(false);
    }

    function toggle(id: string) { setSchedules(s => s.map(x => x.id === id ? { ...x, active: !x.active } : x)); }
    function remove(id: string) { setSchedules(s => s.filter(x => x.id !== id)); }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Horarios</h1>
                    <p className="text-white/50 text-sm mt-0.5">Define horarios recurrentes basado en tus tipos de sesión.</p>
                </div>
                <button onClick={openNew} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo horario
                </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800 text-sm">Los horarios utilizan la información de <strong>Operaciones → Tipos de clase</strong> para definir duración y capacidad por defecto.</p>
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
                                        <p className="font-bold text-white">{s.className}</p>
                                        <p className="text-[10px] text-white/40 uppercase font-bold">{s.duration} MIN</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-white/5/10 flex items-center justify-center"><User className="w-3 h-3 text-white/40" /></div>
                                            <span className="text-white/70">{s.coach}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-white/50">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>{s.room.split("—")[0]}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {s.days.map(d => <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${DAY_COLOR[d]}`}>{d}</span>)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-white/70 font-bold">{s.time}</td>
                                    <td className="px-4 py-3 text-white/50">{s.capacity} <span className="text-[10px]">LUG</span></td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => toggle(s.id)} className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${s.active ? "bg-green-100 text-green-700" : "bg-white/5/10 text-white/50"}`}>
                                            {s.active ? "Activo" : "Pausado"}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/5/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5 text-white/40" /></button>
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
                                <input
                                    type="text"
                                    value={form.className}
                                    onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                                    placeholder="Ej: Pilates Reformer, Yoga Flow..."
                                    className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Coach</label>
                                    <select
                                        value={form.coach}
                                        onChange={e => setForm(f => ({ ...f, coach: e.target.value }))}
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400"
                                    >
                                        {coaches.length > 0 ? (
                                            coaches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                        ) : (
                                            <option value="">Sin coaches</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Sala</label>
                                    <select
                                        value={form.room}
                                        onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                                        className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400"
                                    >
                                        {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
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
                            <button onClick={save} disabled={form.days.length === 0} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
