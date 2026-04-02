// admin/cupones.tsx — Discount coupons management (Supabase)
import type { Route } from "./+types/cupones";
import { useFetcher } from "react-router";
import { useState } from "react";
import { Ticket, Plus, Trash2, Copy } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type DiscountType = "porcentaje" | "fijo";
interface Coupon {
    id: string;
    code: string;
    description: string;
    discount_type: DiscountType;
    value: number;
    uses: number;
    max_uses: number | null;
    expires_at: string | null;
    is_active: boolean;
}

// ─── Loader ─────────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/cupones");

    const { data, error } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

    if (error) console.error("[cupones] Error:", error);
    return { coupons: (data ?? []) as Coupon[] };
}

// ─── Action ─────────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
        const { error } = await supabaseAdmin.from("coupons").insert({
            gym_id: gymId,
            code: formData.get("code") as string,
            description: formData.get("description") as string,
            discount_type: formData.get("discount_type") as DiscountType,
            value: Number(formData.get("value")),
            max_uses: formData.get("max_uses") ? Number(formData.get("max_uses")) : null,
            expires_at: formData.get("expires_at") || null,
            is_active: true,
            uses: 0,
        });
        if (error) return { error: error.message };
    }

    if (intent === "toggle") {
        const id = formData.get("id") as string;
        const is_active = formData.get("is_active") === "true";
        await supabaseAdmin.from("coupons").update({ is_active }).eq("id", id).eq("gym_id", gymId);
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        await supabaseAdmin.from("coupons").delete().eq("id", id).eq("gym_id", gymId);
    }

    return { success: true };
}

// ─── Component ──────────────────────────────────────────────────────
function randomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function Cupones({ loaderData }: Route.ComponentProps) {
    const { coupons } = loaderData;
    const fetcher = useFetcher();
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [code, setCode] = useState(randomCode());

    function copyCode(c: string) {
        navigator.clipboard?.writeText(c);
        setCopied(c);
        setTimeout(() => setCopied(null), 1500);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Cupones</h1>
                    <p className="text-white/50 text-sm mt-0.5">Crea y gestiona códigos de descuento para tus planes y eventos.</p>
                </div>
                <button onClick={() => { setCode(randomCode()); setShowModal(true); }} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nuevo cupón
                </button>
            </div>

            {coupons.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <Ticket className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin cupones</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Crea descuentos para atraer nuevos alumnos o premiar a los más activos.</p>
                    <button onClick={() => { setCode(randomCode()); setShowModal(true); }} className="bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Crear cupón</button>
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
                                <tr key={c.id} className={`hover:bg-white/5 transition-colors ${!c.is_active ? "opacity-50" : ""}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">{c.code}</span>
                                            <button onClick={() => copyCode(c.code)} className="text-white/40 hover:text-white/70 transition-colors">
                                                {copied === c.code ? <span className="text-xs text-green-600">✓</span> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-white/60">{c.description}</td>
                                    <td className="px-4 py-3 font-bold text-green-600">{c.discount_type === "porcentaje" ? `${c.value}%` : `$${c.value}`}</td>
                                    <td className="px-4 py-3 text-white/50">{c.uses}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                                    <td className="px-4 py-3 text-white/50 text-xs">{c.expires_at ?? "Sin límite"}</td>
                                    <td className="px-4 py-3">
                                        <fetcher.Form method="post" className="inline">
                                            <input type="hidden" name="intent" value="toggle" />
                                            <input type="hidden" name="id" value={c.id} />
                                            <input type="hidden" name="is_active" value={String(!c.is_active)} />
                                            <button type="submit" className={`text-xs px-2.5 py-1 rounded-full font-semibold ${c.is_active ? "bg-green-100 text-green-700" : "bg-white/10 text-white/50"}`}>
                                                {c.is_active ? "Activo" : "Inactivo"}
                                            </button>
                                        </fetcher.Form>
                                    </td>
                                    <td className="px-4 py-3">
                                        <fetcher.Form method="post" className="inline">
                                            <input type="hidden" name="intent" value="delete" />
                                            <input type="hidden" name="id" value={c.id} />
                                            <button type="submit" className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                        </fetcher.Form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-md border border-white/[0.08]">
                        <div className="p-6 border-b border-white/[0.08]"><h2 className="text-lg font-black text-white">Nuevo cupón</h2></div>
                        <fetcher.Form method="post" onSubmit={() => setShowModal(false)}>
                            <input type="hidden" name="intent" value="create" />
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Código</label>
                                    <div className="flex gap-2">
                                        <input name="code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="flex-1 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-mono bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                        <button type="button" onClick={() => setCode(randomCode())} className="px-3 py-2.5 border border-white/[0.08] rounded-xl text-xs text-white/50 hover:bg-white/5">Generar</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label>
                                    <input name="description" required placeholder="Descuento de bienvenida" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Tipo</label>
                                        <select name="discount_type" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400">
                                            <option value="porcentaje">Porcentaje (%)</option>
                                            <option value="fijo">Monto fijo ($)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Valor</label>
                                        <input name="value" type="number" defaultValue={10} required className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Usos máx. (opcional)</label>
                                        <input name="max_uses" type="number" placeholder="Ilimitado" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Expira (opcional)</label>
                                        <input name="expires_at" type="date" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-white/[0.08] flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Crear cupón</button>
                            </div>
                        </fetcher.Form>
                    </div>
                </div>
            )}
        </div>
    );
}
