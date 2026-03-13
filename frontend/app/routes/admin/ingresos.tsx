// admin/ingresos.tsx — Revenue reports & financial analytics
import { useState } from "react";
import { TrendingUp, Download, DollarSign, CreditCard, Banknote, BarChart2 } from "lucide-react";

const PERIODS = ["Últimos 7 días", "Últimos 30 días", "Este mes", "Este año"] as const;
type Period = typeof PERIODS[number];

const MOCK_KPI = { total: 0, online: 0, efectivo: 0, transferencia: 0, pending: 0 };

const DAILY = [
    { day: "Lun", amount: 0 }, { day: "Mar", amount: 0 }, { day: "Mié", amount: 0 },
    { day: "Jue", amount: 0 }, { day: "Vie", amount: 0 }, { day: "Sáb", amount: 0 }, { day: "Dom", amount: 0 },
];

const RECENT_TX: any[] = [];

const METHOD_ICONS: Record<string, React.ReactNode> = {
    card: <CreditCard className="w-3.5 h-3.5" />,
    transfer: <Banknote className="w-3.5 h-3.5" />,
    cash: <DollarSign className="w-3.5 h-3.5" />,
};
const STATUS_CFG: Record<string, { bg: string; text: string }> = {
    pagado: { bg: "bg-green-100", text: "text-green-700" },
    pendiente: { bg: "bg-amber-100", text: "text-amber-700" },
    fallido: { bg: "bg-red-100", text: "text-red-700" },
};

export default function Ingresos() {
    const [period, setPeriod] = useState<Period>("Últimos 30 días");
    const maxDay = Math.max(...DAILY.map(d => d.amount));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-white">Mis Ingresos</h1>
                    <p className="text-white/50 text-sm mt-0.5">Reportes financieros detallados por período, método de pago y estado.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5/10 rounded-xl p-1 gap-1">
                        {PERIODS.map(p => (
                            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? "bg-white/5 shadow-sm text-white" : "text-white/50"}`}>{p}</button>
                        ))}
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] rounded-xl text-sm text-white/60 hover:bg-white/5 transition-colors">
                        <Download className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total ingresos", value: `$${MOCK_KPI.total.toLocaleString("es-MX")}`, sub: period, icon: <TrendingUp className="w-5 h-5 text-green-600" />, color: "bg-green-50" },
                    { label: "Online (tarjeta)", value: `$${MOCK_KPI.online.toLocaleString("es-MX")}`, sub: `${Math.round(MOCK_KPI.online / MOCK_KPI.total * 100)}% del total`, icon: <CreditCard className="w-5 h-5 text-blue-600" />, color: "bg-blue-50" },
                    { label: "Efectivo", value: `$${MOCK_KPI.efectivo.toLocaleString("es-MX")}`, sub: `${Math.round(MOCK_KPI.efectivo / MOCK_KPI.total * 100)}% del total`, icon: <DollarSign className="w-5 h-5 text-amber-600" />, color: "bg-amber-50" },
                    { label: "Pagos pendientes", value: `$${MOCK_KPI.pending.toLocaleString("es-MX")}`, sub: "Por cobrar", icon: <BarChart2 className="w-5 h-5 text-red-500" />, color: "bg-red-50" },
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
                <h2 className="font-bold text-white mb-6">Ingresos por día (esta semana)</h2>
                <div className="flex items-end gap-3 h-48">
                    {DAILY.map(d => {
                        const height = (d.amount / maxDay) * 100;
                        return (
                            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                                <span className="text-xs text-white/50">${(d.amount / 1000).toFixed(1)}k</span>
                                <div className="w-full flex items-end justify-center" style={{ height: "140px" }}>
                                    <div className="w-full bg-amber-400 rounded-t-lg transition-all hover:bg-amber-500" style={{ height: `${height}%` }} />
                                </div>
                                <span className="text-xs font-medium text-white/60">{d.day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Transactions table */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="font-bold text-white">Transacciones recientes</h2>
                    <button className="text-xs text-amber-600 font-semibold hover:underline">Ver todo</button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/5">
                        <tr>{["Alumno", "Plan", "Método", "Monto", "Estado", "Fecha"].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {RECENT_TX.map(tx => {
                            const scfg = STATUS_CFG[tx.status];
                            return (
                                <tr key={tx.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3 font-semibold text-white">{tx.name}</td>
                                    <td className="px-4 py-3 text-white/50 text-xs">{tx.plan}</td>
                                    <td className="px-4 py-3"><div className="flex items-center gap-1.5 text-white/50">{METHOD_ICONS[tx.method]}{tx.method}</div></td>
                                    <td className="px-4 py-3 font-bold text-white">${tx.amount.toLocaleString("es-MX")}</td>
                                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${scfg.bg} ${scfg.text}`}>{tx.status}</span></td>
                                    <td className="px-4 py-3 text-white/40 text-xs">{tx.date}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
