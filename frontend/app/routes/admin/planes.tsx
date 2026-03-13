// admin/planes.tsx — Plan & package management (Negocio)
import { useState } from "react";
import { CreditCard, Plus, Pencil, Trash2, Star } from "lucide-react";

type PlanType = "creditos" | "membresia" | "ilimitado";
const TYPE_LABELS: Record<PlanType, string> = { creditos: "Créditos", membresia: "Membresía", ilimitado: "Ilimitado" };
const TYPE_COLORS: Record<PlanType, string> = { creditos: "bg-blue-100 text-blue-700", membresia: "bg-purple-100 text-purple-700", ilimitado: "bg-amber-100 text-amber-700" };

interface Plan {
    id: string;
    name: string;
    type: PlanType;
    price: number;
    credits: number | null; // null = unlimited
    validityDays: number;
    popular: boolean;
    active: boolean;
}

const QUICK_TEMPLATES = [
    { name: "1 clase", type: "creditos" as PlanType, price: 180, credits: 1, validityDays: 30 },
    { name: "5 clases", type: "creditos" as PlanType, price: 750, credits: 5, validityDays: 60 },
    { name: "10 clases", type: "creditos" as PlanType, price: 1200, credits: 10, validityDays: 90 },
    { name: "20 clases", type: "creditos" as PlanType, price: 1900, credits: 20, validityDays: 120 },
    { name: "Mensual ilimitado", type: "ilimitado" as PlanType, price: 1299, credits: null, validityDays: 30 },
];

const MOCK: Plan[] = [];

export default function Planes() {
    const [plans, setPlans] = useState<Plan[]>(MOCK);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: "", type: "creditos" as PlanType, price: 0, credits: 10 as number | null, validityDays: 30, popular: false });

    function addFromTemplate(t: typeof QUICK_TEMPLATES[0]) {
        setPlans(p => [...p, { id: `pl${Date.now()}`, ...t, popular: false, active: true }]);
    }
    function save() {
        setPlans(p => [...p, { id: `pl${Date.now()}`, ...form, active: true }]);
        setShowModal(false);
    }
    const toggle = (id: string) => setPlans(p => p.map(x => x.id === id ? { ...x, active: !x.active } : x));
    const remove = (id: string) => setPlans(p => p.filter(x => x.id !== id));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Planes</h1>
                    <p className="text-white/50 text-sm mt-0.5">Crea paquetes de créditos, membresías y suscripciones que tus alumnos pueden comprar.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo plan
                </button>
            </div>

            {/* Quick templates */}
            <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Plantillas rápidas</p>
                <div className="flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map(t => (
                        <button key={t.name} onClick={() => addFromTemplate(t)} className="flex items-center gap-2 bg-white/5/10 hover:bg-white/5/20 text-white/70 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                            <Plus className="w-3 h-3" /> {t.name}
                        </button>
                    ))}
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <CreditCard className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin planes activos</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Crea tus primeros paquetes de clases o membresías para que tus alumnos puedan reservar.</p>
                    <button onClick={() => setShowModal(true)} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Crear primer plan</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {plans.map(p => (
                        <div key={p.id} className={`bg-white/5 rounded-2xl border p-5 space-y-3 transition-opacity ${p.active ? "border-white/[0.08] opacity-100" : "border-white/5 opacity-50"}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {p.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[p.type]}`}>{TYPE_LABELS[p.type]}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => toggle(p.id)} className="p-1.5 hover:bg-white/5/10 rounded-lg"><Pencil className="w-3.5 h-3.5 text-white/40" /></button>
                                    <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                </div>
                            </div>
                            <div>
                                <p className="font-black text-white">{p.name}</p>
                                <p className="text-3xl font-black text-white mt-1">${p.price.toLocaleString("es-MX")}<span className="text-sm text-white/40 font-normal"> MXN</span></p>
                            </div>
                            <div className="text-sm text-white/50 space-y-1 border-t border-white/5 pt-3">
                                <p>{p.credits === null ? "Clases ilimitadas" : `${p.credits} crédito${p.credits > 1 ? "s" : ""}`}</p>
                                <p>Vigencia: {p.validityDays} días</p>
                            </div>
                            <button onClick={() => toggle(p.id)} className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${p.active ? "bg-white/5/10 text-white/60 hover:bg-white/5/20" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                                {p.active ? "Pausar plan" : "Activar plan"}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b"><h2 className="text-lg font-black">Nuevo plan</h2></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Paquete 10 clases" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Tipo</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as PlanType }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400">
                                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Precio</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                {form.type === "creditos" && <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Créditos</label><input type="number" value={form.credits ?? 0} onChange={e => setForm(f => ({ ...f, credits: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>}
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Días</label><input type="number" value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.popular} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} className="accent-amber-400" /><span className="text-sm text-white/70">Marcar como popular</span></label>
                        </div>
                        <div className="p-6 border-t flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.name} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Crear plan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
