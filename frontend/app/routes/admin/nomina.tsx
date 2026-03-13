// admin/nomina.tsx — Coach payroll management
import { useState } from "react";
import { Wallet, Download, Check } from "lucide-react";

interface CoachPay {
    id: string;
    name: string;
    avatar: string;
    role: string;
    sessions: number;
    ratePerSession: number;
    bonus: number;
    paid: boolean;
    period: string;
}

const MOCK: CoachPay[] = [];

export default function Nomina() {
    const [coaches, setCoaches] = useState<CoachPay[]>(MOCK);

    const total = coaches.reduce((acc, c) => acc + c.sessions * c.ratePerSession + c.bonus, 0);
    const pending = coaches.filter(c => !c.paid).reduce((acc, c) => acc + c.sessions * c.ratePerSession + c.bonus, 0);
    const markPaid = (id: string) => setCoaches(c => c.map(x => x.id === id ? { ...x, paid: true } : x));

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
                    <p className="text-xs text-white/40 mt-1">Mayo 2025</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <p className="text-xs text-amber-700 uppercase tracking-wider mb-1">Por pagar</p>
                    <p className="text-2xl font-black text-amber-700">${pending.toLocaleString("es-MX")}</p>
                    <p className="text-xs text-amber-500 mt-1">{coaches.filter(c => !c.paid).length} coaches pendientes</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                    <p className="text-xs text-green-700 uppercase tracking-wider mb-1">Pagado</p>
                    <p className="text-2xl font-black text-green-700">${(total - pending).toLocaleString("es-MX")}</p>
                    <p className="text-xs text-green-500 mt-1">{coaches.filter(c => c.paid).length} coaches liquidados</p>
                </div>
            </div>

            {/* Coach list */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                    <h2 className="font-bold text-white">Detalle por coach — Mayo 2025</h2>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-white/5 border-b border-white/5">
                        <tr>{["Coach", "Rol", "Sesiones", "Tarifa", "Bono", "Total", "Estado", ""].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {coaches.map(c => {
                            const subtotal = c.sessions * c.ratePerSession + c.bonus;
                            return (
                                <tr key={c.id} className="hover:bg-white/5">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-xs font-black flex items-center justify-center shrink-0">{c.avatar}</div>
                                            <span className="font-semibold text-white">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-white/50 text-xs">{c.role}</td>
                                    <td className="px-4 py-4 text-white/70">{c.sessions}</td>
                                    <td className="px-4 py-4 text-white/50">${c.ratePerSession}/ses.</td>
                                    <td className="px-4 py-4 text-white/50">{c.bonus > 0 ? `$${c.bonus}` : "—"}</td>
                                    <td className="px-4 py-4 font-black text-white">${subtotal.toLocaleString("es-MX")}</td>
                                    <td className="px-4 py-4">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${c.paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                            {c.paid ? "Pagado" : "Pendiente"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {!c.paid && (
                                            <button onClick={() => markPaid(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors">
                                                <Check className="w-3 h-3" /> Marcar pagado
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
