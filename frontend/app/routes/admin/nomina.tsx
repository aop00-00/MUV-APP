// admin/nomina.tsx — Coach payroll management (Supabase)
import type { Route } from "./+types/nomina";
import { useFetcher } from "react-router";
import { Wallet, Download, Check, Save, Edit2 } from "lucide-react";
import { useState } from "react";

interface CoachPay {
    id: string;
    name: string;
    specialty: string;
    sessions: number;
    rate_per_session: number;
    bonus: number;
    is_paid: boolean;
}

export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/nomina");

    // Get all active coaches
    const { data: coaches } = await supabaseAdmin
        .from("coaches")
        .select("id, name, specialty, rate_per_session")
        .eq("gym_id", gymId)
        .eq("is_active", true);

    // Get current month's completed bookings per coach
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: completedClasses } = await supabaseAdmin
        .from("classes")
        .select("coach_id, id")
        .eq("gym_id", gymId)
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd);

    // Count sessions per coach
    const sessionCount: Record<string, number> = {};
    for (const cls of (completedClasses ?? [])) {
        if (cls.coach_id) {
            sessionCount[cls.coach_id] = (sessionCount[cls.coach_id] || 0) + 1;
        }
    }

    // Check payroll records for this month
    const { data: payrolls } = await supabaseAdmin
        .from("coach_payroll")
        .select("coach_id, is_paid, bonus")
        .eq("gym_id", gymId)
        .eq("period", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    const payrollMap = new Map((payrolls ?? []).map((p: any) => [p.coach_id, p]));

    const coachPayroll: CoachPay[] = (coaches ?? []).map((c: any) => {
        const payroll = payrollMap.get(c.id);
        return {
            id: c.id,
            name: c.name,
            specialty: c.specialty || "Coach",
            sessions: sessionCount[c.id] || 0,
            rate_per_session: c.rate_per_session || 200,
            bonus: payroll?.bonus || 0,
            is_paid: payroll?.is_paid || false,
        };
    });

    const currentMonth = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

    return { coaches: coachPayroll, currentMonth };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (intent === "mark_paid") {
        const coachId = formData.get("coach_id") as string;
        const total = Number(formData.get("total"));

        await supabaseAdmin.from("coach_payroll").upsert({
            gym_id: gymId,
            coach_id: coachId,
            period,
            total,
            is_paid: true,
            paid_at: new Date().toISOString(),
        }, { onConflict: "gym_id,coach_id,period" });
    }

    if (intent === "update_amounts") {
        const coachId = formData.get("coach_id") as string;
        const rate = Number(formData.get("rate"));
        const bonus = Number(formData.get("bonus"));

        // 1. Update coach rate
        const { error: coachError } = await supabaseAdmin
            .from("coaches")
            .update({ rate_per_session: rate })
            .eq("id", coachId)
            .eq("gym_id", gymId);

        if (coachError) throw new Error(`Error updating coach rate: ${coachError.message}`);

        // 2. Update/Insert bonus for this period
        const { error: payrollError } = await supabaseAdmin
            .from("coach_payroll")
            .upsert({
                gym_id: gymId,
                coach_id: coachId,
                period,
                bonus,
                total: 0, // Placeholder, usually updated on mark_paid or calculated on fly
            }, { onConflict: "gym_id,coach_id,period" });

        if (payrollError) throw new Error(`Error updating payroll bonus: ${payrollError.message}`);
    }

    return { success: true };
}

export default function Nomina({ loaderData }: Route.ComponentProps) {
    const { coaches, currentMonth } = loaderData;
    const fetcher = useFetcher();

    const total = coaches.reduce((acc, c) => acc + c.sessions * c.rate_per_session + c.bonus, 0);
    const pending = coaches.filter(c => !c.is_paid).reduce((acc, c) => acc + c.sessions * c.rate_per_session + c.bonus, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Nómina</h1>
                    <p className="text-white/50 text-sm mt-0.5">Resumen de pagos a coaches basado en sesiones impartidas.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-white/60 hover:bg-white/5 transition-colors">
                    <Download className="w-4 h-4" /> Exportar nómina
                </button>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl border border-white/[0.08] p-5">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Total del período</p>
                    <p className="text-2xl font-black text-white">${total.toLocaleString("es-MX")}</p>
                    <p className="text-xs text-white/40 mt-1 capitalize">{currentMonth}</p>
                </div>
                <div className="bg-amber-500/10 rounded-xl border border-amber-400/20 p-5">
                    <p className="text-xs text-amber-400 uppercase tracking-wider mb-1">Por pagar</p>
                    <p className="text-2xl font-black text-amber-400">${pending.toLocaleString("es-MX")}</p>
                    <p className="text-xs text-amber-400/60 mt-1">{coaches.filter(c => !c.is_paid).length} coaches pendientes</p>
                </div>
                <div className="bg-green-500/10 rounded-xl border border-green-400/20 p-5">
                    <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Pagado</p>
                    <p className="text-2xl font-black text-green-400">${(total - pending).toLocaleString("es-MX")}</p>
                    <p className="text-xs text-green-400/60 mt-1">{coaches.filter(c => c.is_paid).length} coaches liquidados</p>
                </div>
            </div>

            {/* Coach list */}
            {coaches.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <Wallet className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin coaches registrados</h2>
                    <p className="text-white/50 text-sm max-w-sm mx-auto">Agrega coaches en la sección de Coaches para que aparezcan aquí.</p>
                </div>
            ) : (
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="font-bold text-white capitalize">Detalle por coach — {currentMonth}</h2>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Haz clic en los valores para editarlos</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/5">
                            <tr>{["Coach", "Rol", "Sesiones", "Tarifa", "Bono", "Total", "Estado", ""].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {coaches.map(c => <CoachRow key={c.id} coach={c} fetcher={fetcher} />)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function CoachRow({ coach, fetcher }: { coach: CoachPay; fetcher: any }) {
    const [isEditing, setIsEditing] = useState(false);
    const [rate, setRate] = useState(coach.rate_per_session);
    const [bonus, setBonus] = useState(coach.bonus);

    const subtotal = (coach.sessions * rate) + bonus;

    function handleSave() {
        const formData = new FormData();
        formData.set("intent", "update_amounts");
        formData.set("coach_id", coach.id);
        formData.set("rate", String(rate));
        formData.set("bonus", String(bonus));
        fetcher.submit(formData, { method: "post" });
        setIsEditing(false);
    }

    return (
        <tr className={`hover:bg-white/5 transition-colors ${isEditing ? "bg-white/[0.02]" : ""}`}>
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0">{coach.name.slice(0, 2).toUpperCase()}</div>
                    <span className="font-semibold text-white">{coach.name}</span>
                </div>
            </td>
            <td className="px-4 py-4 text-white/50 text-xs">{coach.specialty}</td>
            <td className="px-4 py-4 text-white/70">{coach.sessions}</td>
            <td className="px-4 py-4">
                {isEditing ? (
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/30">$</span>
                        <input
                            type="number"
                            value={rate}
                            onChange={(e) => setRate(Number(e.target.value))}
                            className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white font-bold focus:border-amber-500 outline-none"
                        />
                    </div>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 group">
                        ${coach.rate_per_session}/ses.
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                    </button>
                )}
            </td>
            <td className="px-4 py-4">
                {isEditing ? (
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/30">$</span>
                        <input
                            type="number"
                            value={bonus}
                            onChange={(e) => setBonus(Number(e.target.value))}
                            className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white font-bold focus:border-amber-500 outline-none"
                        />
                    </div>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 group">
                        {coach.bonus > 0 ? `$${coach.bonus}` : "—"}
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                    </button>
                )}
            </td>
            <td className="px-4 py-4 font-black text-white">${subtotal.toLocaleString("es-MX")}</td>
            <td className="px-4 py-4">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${coach.is_paid ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                    {coach.is_paid ? "Liquidado" : "Pendiente"}
                </span>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <button
                            onClick={handleSave}
                            disabled={fetcher.state !== "idle"}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black rounded-lg transition-all shadow-lg shadow-amber-500/10"
                        >
                            <Save className="w-3.5 h-3.5" /> Guardar
                        </button>
                    ) : coach.is_paid ? (
                        <div className="w-full flex justify-end pr-4 text-green-400/30">
                            <Check className="w-4 h-4" />
                        </div>
                    ) : (
                        <fetcher.Form method="post" className="inline">
                            <input type="hidden" name="intent" value="mark_paid" />
                            <input type="hidden" name="coach_id" value={coach.id} />
                            <input type="hidden" name="total" value={subtotal} />
                            <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/20 text-xs font-bold rounded-lg transition-all">
                                <Wallet className="w-3 h-3" /> Pagar
                            </button>
                        </fetcher.Form>
                    )}
                </div>
            </td>
        </tr>
    );
}
