// admin/sustituciones.tsx — Coach substitution approval flow (Supabase)
import type { Route } from "./+types/sustituciones";
import { useFetcher } from "react-router";
import { useState } from "react";
import { ArrowLeftRight, Check, X } from "lucide-react";

type Status = "pendiente" | "aprobada" | "rechazada";

interface Substitution {
    id: string;
    session_name: string;
    session_date: string;
    session_time: string;
    original_coach: string;
    substitute_coach: string;
    reason: string;
    status: Status;
    created_at: string;
}

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
    pendiente: { label: "Pendiente", bg: "bg-amber-100", text: "text-amber-700" },
    aprobada: { label: "Aprobada", bg: "bg-green-100", text: "text-green-700" },
    rechazada: { label: "Rechazada", bg: "bg-red-100", text: "text-red-700" },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "hace unos minutos";
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/sustituciones");

    const { data, error } = await supabaseAdmin
        .from("substitutions")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

    if (error) console.error("[sustituciones] Error:", error);
    return { substitutions: (data ?? []) as Substitution[] };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const id = formData.get("id") as string;

    if (intent === "approve") {
        await supabaseAdmin.from("substitutions").update({ status: "aprobada" }).eq("id", id).eq("gym_id", gymId);
    }
    if (intent === "reject") {
        await supabaseAdmin.from("substitutions").update({ status: "rechazada" }).eq("id", id).eq("gym_id", gymId);
    }

    return { success: true };
}

export default function Sustituciones({ loaderData }: Route.ComponentProps) {
    const { substitutions } = loaderData;
    const fetcher = useFetcher();
    const [filter, setFilter] = useState<Status | "todas">("todas");

    const filtered = filter === "todas" ? substitutions : substitutions.filter(s => s.status === filter);
    const pending = substitutions.filter(s => s.status === "pendiente").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Sustituciones</h1>
                    <p className="text-white/50 text-sm mt-0.5">Aprueba o rechaza solicitudes de cambio de coach para sesiones específicas.</p>
                </div>
                {pending > 0 && (
                    <span className="bg-amber-400 text-black text-sm font-bold px-3 py-1.5 rounded-full">{pending} pendiente{pending > 1 ? "s" : ""}</span>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl p-1 w-fit">
                {(["todas", "pendiente", "aprobada", "rechazada"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? "bg-white/5 shadow-sm text-white" : "text-white/50 hover:text-white/70"}`}>
                        {f === "todas" ? "Todas" : STATUS_CONFIG[f].label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <ArrowLeftRight className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <p className="text-white/50">No hay solicitudes en esta categoría.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(s => {
                        const cfg = STATUS_CONFIG[s.status];
                        return (
                            <div key={s.id} className="bg-white/5 rounded-xl border border-white/[0.08] p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                            <ArrowLeftRight className="w-5 h-5 text-white/40" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-white">{s.session_name}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                                            </div>
                                            <p className="text-sm text-white/50">{s.session_date} · {s.session_time}</p>
                                            <div className="flex items-center gap-2 mt-2 text-sm">
                                                <span className="text-white/60 font-medium">{s.original_coach}</span>
                                                <ArrowLeftRight className="w-3.5 h-3.5 text-white/40" />
                                                <span className="text-white font-bold">{s.substitute_coach}</span>
                                            </div>
                                            <p className="text-xs text-white/40 mt-1">Motivo: {s.reason} · Solicitado {timeAgo(s.created_at)}</p>
                                        </div>
                                    </div>

                                    {s.status === "pendiente" && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <fetcher.Form method="post" className="inline">
                                                <input type="hidden" name="intent" value="reject" />
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit" className="flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] rounded-lg text-sm text-white/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
                                                    <X className="w-3.5 h-3.5" /> Rechazar
                                                </button>
                                            </fetcher.Form>
                                            <fetcher.Form method="post" className="inline">
                                                <input type="hidden" name="intent" value="approve" />
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all">
                                                    <Check className="w-3.5 h-3.5" /> Aprobar
                                                </button>
                                            </fetcher.Form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
