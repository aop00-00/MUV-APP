// app/routes/admin/finance.tsx
// Admin – Financial reports with stacked bar chart, MRR, cash close (MOCK DATA).
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/finance";
import { useFetcher } from "react-router";
import { useState } from "react";
import { DollarSign, TrendingUp, Banknote, ShoppingBag, Coffee, Wallet, Lock } from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────
const WEEKLY_DATA = [
    { day: "Lun", memberships: 3200, dropins: 450, cafeteria: 680 },
    { day: "Mar", memberships: 2800, dropins: 300, cafeteria: 520 },
    { day: "Mié", memberships: 1600, dropins: 600, cafeteria: 440 },
    { day: "Jue", memberships: 4100, dropins: 150, cafeteria: 710 },
    { day: "Vie", memberships: 2200, dropins: 750, cafeteria: 830 },
    { day: "Sáb", memberships: 5400, dropins: 900, cafeteria: 960 },
    { day: "Dom", memberships: 800, dropins: 200, cafeteria: 350 },
];

const MOCK_ORDERS = [
    { id: "ord-a1b2c3d4", total: 799, payment_method: "mercado_pago", category: "membership", created_at: "2025-02-17T10:00:00Z" },
    { id: "ord-e5f6g7h8", total: 65, payment_method: "cash", category: "cafeteria", created_at: "2025-02-17T14:30:00Z" },
    { id: "ord-i9j0k1l2", total: 150, payment_method: "cash", category: "dropin", created_at: "2025-02-17T09:15:00Z" },
    { id: "ord-m3n4o5p6", total: 35, payment_method: "cash", category: "cafeteria", created_at: "2025-02-17T16:45:00Z" },
    { id: "ord-q7r8s9t0", total: 1399, payment_method: "mercado_pago", category: "membership", created_at: "2025-02-16T11:20:00Z" },
    { id: "ord-u1v2w3x4", total: 55, payment_method: "cash", category: "cafeteria", created_at: "2025-02-16T08:00:00Z" },
    { id: "ord-y5z6a7b8", total: 280, payment_method: "mercado_pago", category: "supplement", created_at: "2025-02-15T13:10:00Z" },
    { id: "ord-c9d0e1f2", total: 350, payment_method: "cash", category: "merch", created_at: "2025-02-15T17:30:00Z" },
];

const MRR = 68400;
const MRR_CHANGE = 4.2;
const TOTAL_CASH_TODAY = MOCK_ORDERS.filter((o) => o.payment_method === "cash" && o.created_at.startsWith("2025-02-17")).reduce((s, o) => s + o.total, 0);

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const totalRevenue = MOCK_ORDERS.reduce((s, o) => s + o.total, 0);
    const cashRevenue = MOCK_ORDERS.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total, 0);
    const mpRevenue = MOCK_ORDERS.filter((o) => o.payment_method === "mercado_pago").reduce((s, o) => s + o.total, 0);

    return {
        orders: MOCK_ORDERS,
        totalRevenue,
        cashRevenue,
        mpRevenue,
        orderCount: MOCK_ORDERS.length,
        weeklyData: WEEKLY_DATA,
        mrr: MRR,
        mrrChange: MRR_CHANGE,
        cashToday: TOTAL_CASH_TODAY,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    if (intent === "cash_close") {
        return { success: true, message: "Corte de caja registrado." };
    }
    return { success: true };
}

// ─── Stacked Bar Chart (pure SVG) ────────────────────────────────
function StackedBarChart({ data }: { data: typeof WEEKLY_DATA }) {
    const maxTotal = Math.max(...data.map((d) => d.memberships + d.dropins + d.cafeteria));
    const barWidth = 40;
    const gap = 20;
    const chartHeight = 200;
    const chartWidth = data.length * (barWidth + gap);

    const colors = { memberships: "#7c3aed", dropins: "#3b82f6", cafeteria: "#f59e0b" };

    return (
        <div>
            <svg viewBox={`0 0 ${chartWidth + 30} ${chartHeight + 30}`} className="w-full max-w-2xl">
                {data.map((d, i) => {
                    const total = d.memberships + d.dropins + d.cafeteria;
                    const x = i * (barWidth + gap) + 15;
                    const scale = chartHeight / maxTotal;

                    const hMem = d.memberships * scale;
                    const hDrop = d.dropins * scale;
                    const hCafe = d.cafeteria * scale;

                    return (
                        <g key={i}>
                            {/* Cafeteria (top) */}
                            <rect x={x} y={chartHeight - hMem - hDrop - hCafe} width={barWidth} height={hCafe} rx={3}
                                fill={colors.cafeteria} className="hover:opacity-80 transition-opacity" />
                            {/* Drop-ins (middle) */}
                            <rect x={x} y={chartHeight - hMem - hDrop} width={barWidth} height={hDrop}
                                fill={colors.dropins} className="hover:opacity-80 transition-opacity" />
                            {/* Memberships (bottom) */}
                            <rect x={x} y={chartHeight - hMem} width={barWidth} height={hMem} rx={3}
                                fill={colors.memberships} className="hover:opacity-80 transition-opacity" />
                            {/* Day label */}
                            <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle"
                                className="text-[10px] font-medium" fill="#9ca3af">
                                {d.day}
                            </text>
                            {/* Total label on hover */}
                            <text x={x + barWidth / 2} y={chartHeight - hMem - hDrop - hCafe - 5} textAnchor="middle"
                                className="text-[9px] font-bold" fill="#6b7280">
                                ${(total / 1000).toFixed(1)}k
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div className="flex items-center gap-6 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.memberships }} /> Membresías
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.dropins }} /> Drop-ins
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.cafeteria }} /> Cafetería
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function Finance({ loaderData }: Route.ComponentProps) {
    const { orders, totalRevenue, cashRevenue, mpRevenue, orderCount, weeklyData, mrr, mrrChange, cashToday } = loaderData;
    const fetcher = useFetcher();
    const [showCashClose, setShowCashClose] = useState(false);

    const categoryLabels: Record<string, string> = {
        membership: "Membresía",
        cafeteria: "Cafetería",
        dropin: "Drop-in",
        supplement: "Suplemento",
        merch: "Merchandise",
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Finanzas</h1>
                <p className="text-white/50 mt-1">Proyección, desglose y control de caja.</p>
            </div>

            {/* ── KPI Cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
                        <DollarSign className="w-4 h-4" /> Ingreso total
                    </div>
                    <p className="text-2xl font-black text-green-600">${totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-purple-200 text-xs uppercase tracking-wider mb-2">
                        <TrendingUp className="w-4 h-4" /> MRR
                    </div>
                    <p className="text-2xl font-black">${mrr.toLocaleString()}</p>
                    <p className="text-xs text-purple-200 mt-1">+{mrrChange}% vs mes anterior</p>
                </div>
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
                        <Wallet className="w-4 h-4" /> Mercado Pago
                    </div>
                    <p className="text-2xl font-black text-blue-600">${mpRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
                        <Banknote className="w-4 h-4" /> Efectivo
                    </div>
                    <p className="text-2xl font-black text-amber-600">${cashRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
                        <ShoppingBag className="w-4 h-4" /> Órdenes
                    </div>
                    <p className="text-2xl font-black text-white">{orderCount}</p>
                </div>
            </div>

            {/* ── Charts ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/5 border border-white/[0.08] rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-white mb-4">Desglose semanal por línea de negocio</h2>
                    <StackedBarChart data={weeklyData} />
                </div>

                {/* Cash Close */}
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="w-5 h-5 text-white/40" />
                        <h2 className="text-lg font-bold text-white">Corte de caja</h2>
                    </div>
                    <p className="text-sm text-white/50 mb-4">Efectivo registrado hoy en sistema:</p>
                    <p className="text-4xl font-black text-amber-600 mb-4">${cashToday.toLocaleString()}</p>
                    <p className="text-xs text-white/40 mb-6">Concilia el efectivo físico al cerrar turno.</p>
                    {!showCashClose ? (
                        <button
                            onClick={() => setShowCashClose(true)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                        >
                            Iniciar corte de caja
                        </button>
                    ) : (
                        <fetcher.Form method="post" className="space-y-3">
                            <input type="hidden" name="intent" value="cash_close" />
                            <div>
                                <label className="text-xs text-white/50 mb-1 block">Efectivo contado (físico)</label>
                                <input
                                    name="counted_cash"
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm"
                                    placeholder="$0.00"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/50 mb-1 block">Notas (opcional)</label>
                                <input
                                    name="notes"
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm"
                                    placeholder="Ej: Billete falso de $200"
                                />
                            </div>
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-colors">
                                Cerrar caja ✓
                            </button>
                        </fetcher.Form>
                    )}
                    {fetcher.data && "success" in fetcher.data && fetcher.data.success && (
                        <p className="text-sm text-green-600 font-medium mt-3 text-center">✅ Corte registrado</p>
                    )}
                </div>
            </div>

            {/* ── Orders Table ──────────────────────────── */}
            <div className="bg-white/5 border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
                <h2 className="text-lg font-semibold text-white p-6 pb-0">Últimas ventas</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-4">
                        <thead>
                            <tr className="border-b border-white/[0.08] text-white/50 text-left bg-white/5">
                                <th className="px-6 py-3 font-medium">ID</th>
                                <th className="px-6 py-3 font-medium">Fecha</th>
                                <th className="px-6 py-3 font-medium">Categoría</th>
                                <th className="px-6 py-3 font-medium">Método</th>
                                <th className="px-6 py-3 font-medium text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-white/5">
                                    <td className="px-6 py-3 font-mono text-xs text-white/40">{order.id.slice(4, 12)}</td>
                                    <td className="px-6 py-3 text-white/50">
                                        {new Date(order.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="text-xs bg-white/5/10 text-white/60 px-2 py-1 rounded-full">
                                            {categoryLabels[order.category] ?? order.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full ${order.payment_method === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                            {order.payment_method === "cash" ? "Efectivo" : "Mercado Pago"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-white">${order.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
