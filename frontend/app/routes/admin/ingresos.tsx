// admin/ingresos.tsx — Revenue reports & financial analytics (Supabase)
import type { Route } from "./+types/ingresos";
import { TrendingUp, DollarSign, CreditCard, Banknote, BarChart2 } from "lucide-react";

interface OrderRow {
    id: string;
    total: number;
    payment_method: string;
    status: string;
    customer_name: string | null;
    created_at: string;
}

export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/ingresos");

    // Fetch last 30 days of orders
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select("id, total, payment_method, status, customer_name, created_at")
        .eq("gym_id", gymId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

    if (error) console.error("[ingresos] Error:", error);

    const allOrders = (orders ?? []) as OrderRow[];
    const paidOrders = allOrders.filter(o => o.status === "paid");

    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const onlineRevenue = paidOrders.filter(o => o.payment_method !== "cash").reduce((s, o) => s + Number(o.total), 0);
    const cashRevenue = paidOrders.filter(o => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0);
    const pendingRevenue = allOrders.filter(o => o.status === "pending").reduce((s, o) => s + Number(o.total), 0);

    // Build daily chart data (last 7 days)
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dailyData: { day: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split("T")[0];
        const dayAmount = paidOrders
            .filter(o => o.created_at.startsWith(dayStr))
            .reduce((s, o) => s + Number(o.total), 0);
        dailyData.push({ day: dayNames[d.getDay()], amount: dayAmount });
    }

    // Recent transactions
    const recentTx = allOrders.slice(0, 20);

    return {
        kpi: { total: totalRevenue, online: onlineRevenue, cash: cashRevenue, pending: pendingRevenue },
        dailyData,
        recentTx,
    };
}

const METHOD_LABELS: Record<string, string> = {
    cash: "Efectivo",
    mercado_pago: "Mercado Pago",
    card: "Tarjeta",
};
const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
    paid: { bg: "bg-green-100", text: "text-green-700", label: "Pagado" },
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pendiente" },
    failed: { bg: "bg-red-100", text: "text-red-700", label: "Fallido" },
    refunded: { bg: "bg-gray-100", text: "text-gray-700", label: "Reembolsado" },
};

export default function Ingresos({ loaderData }: Route.ComponentProps) {
    const { kpi, dailyData, recentTx } = loaderData;
    const maxDay = Math.max(1, ...dailyData.map(d => d.amount));

    const pctOnline = kpi.total > 0 ? Math.round((kpi.online / kpi.total) * 100) : 0;
    const pctCash = kpi.total > 0 ? Math.round((kpi.cash / kpi.total) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-white">Mis Ingresos</h1>
                    <p className="text-white/50 text-sm mt-0.5">Reportes financieros detallados por período, método de pago y estado.</p>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total ingresos", value: `$${kpi.total.toLocaleString("es-MX")}`, sub: "Últimos 30 días", icon: <TrendingUp className="w-5 h-5 text-green-600" />, color: "bg-green-50" },
                    { label: "Online (tarjeta)", value: `$${kpi.online.toLocaleString("es-MX")}`, sub: `${pctOnline}% del total`, icon: <CreditCard className="w-5 h-5 text-blue-600" />, color: "bg-blue-50" },
                    { label: "Efectivo", value: `$${kpi.cash.toLocaleString("es-MX")}`, sub: `${pctCash}% del total`, icon: <DollarSign className="w-5 h-5 text-amber-600" />, color: "bg-amber-50" },
                    { label: "Pagos pendientes", value: `$${kpi.pending.toLocaleString("es-MX")}`, sub: "Por cobrar", icon: <BarChart2 className="w-5 h-5 text-red-500" />, color: "bg-red-50" },
                ].map(k => (
                    <div key={k.label} className="bg-white/5 rounded-xl border border-white/[0.08] p-5">
                        <div className={`w-9 h-9 ${k.color} rounded-xl flex items-center justify-center mb-3`}>{k.icon}</div>
                        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{k.label}</p>
                        <p className="text-2xl font-black text-white">{k.value}</p>
                        <p className="text-xs text-white/40 mt-1">{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* Bar chart */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6">
                <h2 className="font-bold text-white mb-6">Ingresos por día (última semana)</h2>
                <div className="flex items-end gap-3 h-48">
                    {dailyData.map((d, i) => {
                        const height = maxDay > 0 ? (d.amount / maxDay) * 100 : 0;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <span className="text-xs text-white/50">${(d.amount / 1000).toFixed(1)}k</span>
                                <div className="w-full flex items-end justify-center" style={{ height: "140px" }}>
                                    <div className="w-full bg-amber-400 rounded-t-lg transition-all hover:bg-amber-500" style={{ height: `${Math.max(height, 2)}%` }} />
                                </div>
                                <span className="text-xs font-medium text-white/60">{d.day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Transactions table */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                    <h2 className="font-bold text-white">Transacciones recientes</h2>
                </div>
                {recentTx.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-sm">No hay transacciones registradas en los últimos 30 días.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/5">
                            <tr>{["Cliente", "Método", "Monto", "Estado", "Fecha"].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {recentTx.map(tx => {
                                const scfg = STATUS_CFG[tx.status] || STATUS_CFG.pending;
                                return (
                                    <tr key={tx.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-semibold text-white">{tx.customer_name || "Venta directa"}</td>
                                        <td className="px-4 py-3 text-white/50">{METHOD_LABELS[tx.payment_method] || tx.payment_method}</td>
                                        <td className="px-4 py-3 font-bold text-white">${Number(tx.total).toLocaleString("es-MX")}</td>
                                        <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${scfg.bg} ${scfg.text}`}>{scfg.label}</span></td>
                                        <td className="px-4 py-3 text-white/40 text-xs">{new Date(tx.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
