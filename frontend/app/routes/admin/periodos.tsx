// admin/periodos.tsx — Períodos Especiales (holidays, closures, breaks) — Supabase
import type { Route } from "./+types/periodos";
import { useFetcher } from "react-router";
import { useState } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";

type Effect = "cerrar_todo" | "cancelar_sesiones" | "reducir_horario";

interface Period {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    effect: Effect;
    note: string | null;
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

export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/periodos");

    const { data, error } = await supabaseAdmin
        .from("special_periods")
        .select("*")
        .eq("gym_id", gymId)
        .order("start_date", { ascending: true });

    if (error) console.error("[periodos] Error:", error);
    return { periods: (data ?? []) as Period[] };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
        const { error } = await supabaseAdmin.from("special_periods").insert({
            gym_id: gymId,
            name: formData.get("name") as string,
            start_date: formData.get("start_date") as string,
            end_date: formData.get("end_date") as string,
            effect: formData.get("effect") as Effect,
            note: formData.get("note") || null,
        });
        if (error) return { error: error.message };
    }

    if (intent === "delete") {
        await supabaseAdmin.from("special_periods").delete()
            .eq("id", formData.get("id") as string)
            .eq("gym_id", gymId);
    }

    return { success: true };
}

export default function PeriodosEspeciales({ loaderData }: Route.ComponentProps) {
    const { periods } = loaderData;
    const fetcher = useFetcher();
    const [showModal, setShowModal] = useState(false);

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
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                    <CalendarOff className="w-5 h-5 text-white/40" />
                                </div>
                                <div>
                                    <p className="font-bold text-white">{p.name}</p>
                                    <p className="text-sm text-white/50">{p.start_date === p.end_date ? p.start_date : `${p.start_date} → ${p.end_date}`}</p>
                                    {p.note && <p className="text-xs text-white/40 mt-0.5">{p.note}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${EFFECT_COLORS[p.effect]}`}>{EFFECT_LABELS[p.effect]}</span>
                                <fetcher.Form method="post" className="inline">
                                    <input type="hidden" name="intent" value="delete" />
                                    <input type="hidden" name="id" value={p.id} />
                                    <button type="submit" className="p-1.5 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </fetcher.Form>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-md border border-white/[0.08]">
                        <div className="p-6 border-b border-white/[0.08]">
                            <h2 className="text-lg font-black text-white">Nuevo período especial</h2>
                        </div>
                        <fetcher.Form method="post" onSubmit={() => setShowModal(false)}>
                            <input type="hidden" name="intent" value="create" />
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre</label>
                                    <input name="name" required placeholder="Ej: Semana Santa" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Inicio</label>
                                        <input name="start_date" type="date" required className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Fin</label>
                                        <input name="end_date" type="date" required className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Efecto</label>
                                    <select name="effect" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400">
                                        {Object.entries(EFFECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nota interna (opcional)</label>
                                    <input name="note" placeholder="Ej: Avisar a coaches con 1 semana de anticipación" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:outline-none focus:border-amber-400" />
                                </div>
                            </div>
                            <div className="p-6 border-t border-white/[0.08] flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar</button>
                            </div>
                        </fetcher.Form>
                    </div>
                </div>
            )}
        </div>
    );
}
