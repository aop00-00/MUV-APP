// admin/cupones.tsx — Discount coupons management
import { useState } from "react";
import { Ticket, Plus, Trash2, Copy } from "lucide-react";

type DiscountType = "porcentaje" | "fijo";
interface Coupon {
    id: string;
    code: string;
    description: string;
    type: DiscountType;
    value: number;
    uses: number;
    maxUses: number | null;
    expiresAt: string | null;
    active: boolean;
}

const MOCK: Coupon[] = [];

function randomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function Cupones() {
    const [coupons, setCoupons] = useState<Coupon[]>(MOCK);
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [form, setForm] = useState({ code: randomCode(), description: "", type: "porcentaje" as DiscountType, value: 10, maxUses: "" as string, expiresAt: "" });

    function save() {
        setCoupons(c => [...c, { id: `c${Date.now()}`, ...form, maxUses: form.maxUses ? +form.maxUses : null, expiresAt: form.expiresAt || null, uses: 0, active: true }]);
        setShowModal(false);
    }
    function copyCode(code: string) { navigator.clipboard?.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); }
    const toggle = (id: string) => setCoupons(c => c.map(x => x.id === id ? { ...x, active: !x.active } : x));
    const remove = (id: string) => setCoupons(c => c.filter(x => x.id !== id));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Cupones</h1>
                    <p className="text-white/50 text-sm mt-0.5">Crea y gestiona códigos de descuento para tus planes y eventos.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo cupón
                </button>
            </div>

            {coupons.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <Ticket className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin cupones</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Crea descuentos para atraer nuevos alumnos o premiar a los más activos.</p>
                    <button onClick={() => setShowModal(true)} className="bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Crear cupón</button>
                </div>
            ) : (
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/[0.08]">
                            <tr>
                                {["Código", "Descripción", "Descuento", "Usos", "Expira", "Estado", ""].map(h => (
                                    <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {coupons.map(c => (
                                <tr key={c.id} className={`hover:bg-white/5 transition-colors ${!c.active ? "opacity-50" : ""}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-white bg-white/5/10 px-2 py-0.5 rounded">{c.code}</span>
                                            <button onClick={() => copyCode(c.code)} className="text-white/40 hover:text-white/70 transition-colors">
                                                {copied === c.code ? <span className="text-xs text-green-600">✓</span> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-white/60">{c.description}</td>
                                    <td className="px-4 py-3 font-bold text-green-600">{c.type === "porcentaje" ? `${c.value}%` : `$${c.value}`}</td>
                                    <td className="px-4 py-3 text-white/50">{c.uses}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                                    <td className="px-4 py-3 text-white/50 text-xs">{c.expiresAt ?? "Sin límite"}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => toggle(c.id)} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${c.active ? "bg-green-100 text-green-700" : "bg-white/5/10 text-white/50"}`}>{c.active ? "Activo" : "Inactivo"}</button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => remove(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
                        <div className="p-6 border-b"><h2 className="text-lg font-black">Nuevo cupón</h2></div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Código</label>
                                <div className="flex gap-2">
                                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="flex-1 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-400" />
                                    <button type="button" onClick={() => setForm(f => ({ ...f, code: randomCode() }))} className="px-3 py-2.5 border border-white/[0.08] rounded-xl text-xs text-white/50 hover:bg-white/5">Generar</button>
                                </div>
                            </div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descuento de bienvenida" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Tipo</label>
                                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DiscountType }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400">
                                        <option value="porcentaje">Porcentaje (%)</option>
                                        <option value="fijo">Monto fijo ($)</option>
                                    </select>
                                </div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Valor</label><input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Usos máx. (opcional)</label><input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="Ilimitado" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Expira (opcional)</label><input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            </div>
                        </div>
                        <div className="p-6 border-t flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.code || !form.description} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Crear cupón</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
