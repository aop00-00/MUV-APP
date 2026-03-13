// admin/periodos.tsx — Períodos Especiales (holidays, closures, breaks)
import { useState } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";

type Effect = "cerrar_todo" | "cancelar_sesiones" | "reducir_horario";

interface Period {
    id: string;
    name: string;
    from: string;
    to: string;
    effect: Effect;
    note: string;
}

const EFFECT_LABELS: Record<Effect, string> = {
    cerrar_todo: "Cerrar estudio",
    cancelar_sesiones: "Cancelar sesiones",
    reducir_horario: "Horario reducido",
};
const EFFECT_COLORS: Record<Effect, string> = {
    cerrar_todo: "bg-red-100 text-red-700",
    cancelar_sesiones: "bg-orange-100 text-orange-700",
    reducir_horario: "bg-yellow-100 text-yellow-700",
};

const MOCK: Period[] = [
    { id: "p1", name: "Semana Santa", from: "2025-04-14", to: "2025-04-20", effect: "cerrar_todo", note: "Cierre total de operaciones." },
    { id: "p2", name: "Día del Trabajo", from: "2025-05-01", to: "2025-05-01", effect: "cancelar_sesiones", note: "Se cancelan las 3 sesiones del día." },
];

export default function PeriodosEspeciales() {
    const [periods, setPeriods] = useState<Period[]>(MOCK);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<Omit<Period, "id">>({ name: "", from: "", to: "", effect: "cerrar_todo", note: "" });

    function save() {
        setPeriods(p => [...p, { id: `p${Date.now()}`, ...form }]);
        setShowModal(false);
        setForm({ name: "", from: "", to: "", effect: "cerrar_todo", note: "" });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Períodos Especiales</h1>
                    <p className="text-white/50 text-sm mt-0.5">Vacaciones, días festivos o cierres temporales. Afectan la generación automática de sesiones.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo período
                </button>
            </div>

            {periods.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <CalendarOff className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin períodos especiales</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Agrega vacaciones o días festivos para que el sistema cancele o ajuste las sesiones automáticamente.</p>
                    <button onClick={() => setShowModal(true)} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Agregar período</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {periods.map(p => (
                        <div key={p.id} className="bg-white/5 rounded-xl border border-white/[0.08] px-5 py-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/5/10 rounded-xl flex items-center justify-center shrink-0">
                                    <CalendarOff className="w-5 h-5 text-white/40" />
                                </div>
                                <div>
                                    <p className="font-bold text-white">{p.name}</p>
                                    <p className="text-sm text-white/50">{p.from === p.to ? p.from : `${p.from} → ${p.to}`}</p>
                                    {p.note && <p className="text-xs text-white/40 mt-0.5">{p.note}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${EFFECT_COLORS[p.effect]}`}>{EFFECT_LABELS[p.effect]}</span>
                                <button onClick={() => setPeriods(x => x.filter(i => i.id !== p.id))} className="p-1.5 hover:bg-red-50 rounded-lg">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-lg font-black text-white">Nuevo período especial</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Semana Santa" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Inicio</label>
                                    <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Fin</label>
                                    <input type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Efecto</label>
                                <select value={form.effect} onChange={e => setForm(f => ({ ...f, effect: e.target.value as Effect }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 bg-white/5">
                                    {Object.entries(EFFECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nota interna (opcional)</label>
                                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ej: Avisar a coaches con 1 semana de anticipación" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.name || !form.from || !form.to} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
