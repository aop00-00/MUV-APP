// admin/events.tsx — Workshops, talleres & unique one-time events
import { useState } from "react";
import { Sparkles, Plus, Trash2, Users, Ticket } from "lucide-react";

interface Event {
    id: string;
    name: string;
    coach: string;
    date: string;
    time: string;
    duration: number;
    capacity: number;
    enrolled: number;
    price: number;
    location: string;
    description: string;
}

const MOCK: Event[] = [
    { id: "e1", name: "Workshop Pilates Prenatal", coach: "Valentina Cruz", date: "2025-05-24", time: "10:00", duration: 120, capacity: 12, enrolled: 7, price: 350, location: "Sala A", description: "Clase especial para embarazadas en segundo y tercer trimestre." },
    { id: "e2", name: "Retiro de Yoga (sábado)", coach: "Andrea Ríos", date: "2025-06-07", time: "08:00", duration: 180, capacity: 20, enrolled: 15, price: 500, location: "Jardín exterior", description: "3 horas de yoga, meditación y snack saludable incluido." },
];

export default function Eventos() {
    const [events, setEvents] = useState<Event[]>(MOCK);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: "", coach: "", date: "", time: "10:00", duration: 90, capacity: 15, price: 0, location: "", description: "" });

    function save() {
        setEvents(e => [...e, { id: `e${Date.now()}`, ...form, enrolled: 0 }]);
        setShowModal(false);
        setForm({ name: "", coach: "", date: "", time: "10:00", duration: 90, capacity: 15, price: 0, location: "", description: "" });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Eventos</h1>
                    <p className="text-white/50 text-sm mt-0.5">Talleres, workshops y clases únicas fuera del horario regular.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo evento
                </button>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <Sparkles className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin eventos todavía</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Crea workshops, retiros o clases especiales que no forman parte del horario semanal.</p>
                    <button onClick={() => setShowModal(true)} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Crear evento</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map(e => {
                        const pct = Math.round((e.enrolled / e.capacity) * 100);
                        const isFull = e.enrolled >= e.capacity;
                        return (
                            <div key={e.id} className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-black text-white">{e.name}</p>
                                        <p className="text-sm text-white/50">{e.coach} · {e.location}</p>
                                    </div>
                                    <button onClick={() => setEvents(ev => ev.filter(x => x.id !== e.id))} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                                </div>
                                <p className="text-sm text-white/60 leading-relaxed">{e.description}</p>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div><p className="text-xs text-white/40 mb-0.5">Fecha</p><p className="text-sm font-semibold text-white/90">{e.date}</p></div>
                                    <div><p className="text-xs text-white/40 mb-0.5">Hora</p><p className="text-sm font-semibold text-white/90">{e.time} · {e.duration}min</p></div>
                                    <div><p className="text-xs text-white/40 mb-0.5">Precio</p><p className="text-sm font-semibold text-green-600">${e.price}</p></div>
                                </div>
                                {/* Occupancy bar */}
                                <div>
                                    <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {e.enrolled}/{e.capacity} inscritos</span>
                                        <span className={isFull ? "text-red-600 font-semibold" : ""}>{isFull ? "¡Lleno!" : `${pct}%`}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5/10 rounded-full">
                                        <div className={`h-1.5 rounded-full transition-all ${isFull ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                                <button className="w-full flex items-center justify-center gap-2 border border-white/[0.08] rounded-xl py-2 text-sm text-white/60 hover:bg-white/5 transition-colors">
                                    <Ticket className="w-4 h-4" /> Ver inscritos
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-lg font-black text-white">Nuevo evento</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {[["Nombre del evento", "name", "Workshop Pilates Prenatal"], ["Coach", "coach", "Nombre del coach"], ["Ubicación", "location", "Sala A / Jardín exterior"]].map(([l, k, p]) => (
                                <div key={k}>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">{l}</label>
                                    <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={p} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Fecha</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Hora</label><input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Duración (min)</label><input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Capacidad</label><input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div className="col-span-2"><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Precio (MXN)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.name || !form.coach || !form.date} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar evento</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
