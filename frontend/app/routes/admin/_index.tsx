// app/routes/admin/_index.tsx
// Admin Dashboard – Studio Setup + Live KPIs (RESETS TO ZERO).
import type { Route } from "./+types/_index";
import {
    Users, DollarSign, TrendingUp, AlertTriangle, Package,
    CreditCard, Snowflake, PhoneForwarded, RefreshCw, Activity,
    CheckCircle2, Circle, ArrowRight, UserPlus, MessageCircle, Phone
} from "lucide-react";
// Auth, Supabase and n8n services moved to dynamic imports inside loader/action

// ─── Mock Data (RESET) ───────────────────────────────────────────
const MOCK_LIVE = {
    currentOccupancy: 0,
    maxCapacity: 0,
    activeMembers: 0,
    totalUsers: 0,
    todayRevenue: 0,
    mrr: 0,
    churnRiskUsers: [],
};

const MOCK_ACTIONS: any[] = [];

// ─── Setup Steps ────────────────────────────────────────────────
const SETUP_STEPS = [
    { name: "Mi Estudio", path: "/admin/studio", completed: false },
    { name: "Ubicación", path: "/admin/ubicaciones", completed: false },
    { name: "Sala", path: "/admin/operaciones", completed: false },
    { name: "Clases", path: "/admin/operaciones", completed: false },
    { name: "Coaches", path: "/admin/coaches", completed: false },
    { name: "Horarios", path: "/admin/horarios", completed: false },
    { name: "Planes", path: "/admin/planes", completed: false },
    { name: "Pagos", path: "/admin/pos", completed: false },
];

import { useTenant } from "~/context/TenantContext";

function StudioSetup() {
    const { config } = useTenant();
    const completedCount = SETUP_STEPS.filter(s => s.completed).length;
    const progress = (completedCount / SETUP_STEPS.length) * 100;

    return (
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-black text-white">Configura tu estudio</h2>
                        <span className="text-xs font-bold text-white/50">{completedCount}/{SETUP_STEPS.length}</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%`, backgroundColor: config.primaryColor }}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {SETUP_STEPS.map((step, idx) => (
                        <Link
                            key={idx}
                            to={step.path}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${step.completed
                                ? "bg-green-500/20 border-green-500/30 text-green-400"
                                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:scale-105"
                                }`}
                            style={!step.completed ? { borderColor: `${config.primaryColor}20`, color: config.primaryColor } : {}}
                        >
                            {step.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            {step.name}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── SVG Gauge Component ─────────────────────────────────────────
function OccupancyGauge({ current, max }: { current: number; max: number }) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const isAlert = pct >= 90;
    const isWarning = pct >= 75;

    const r = 70, cx = 90, cy = 90;
    const startAngle = Math.PI;
    const endAngle = startAngle + (pct / 100) * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = pct > 50 ? 1 : 0;

    const color = max === 0 ? "#e5e7eb" : isAlert ? "#ef4444" : isWarning ? "#f59e0b" : "#22c55e";

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 180 100" className="w-full max-w-[220px]">
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
                {pct > 0 && (
                    <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
                )}
                <text x={cx} y={cy - 10} textAnchor="middle" className="text-3xl font-black" fill={color}>{current}</text>
                <text x={cx} y={cy + 8} textAnchor="middle" className="text-[10px] font-medium" fill="rgba(255,255,255,0.5)">de {max} personas</text>
            </svg>
            <div className={`text-sm font-bold mt-1 ${max === 0 ? "text-white/30" : isAlert ? "text-red-500" : isWarning ? "text-amber-500" : "text-green-500"}`}>
                {max === 0 ? "Sin datos" : isAlert ? "⚠️ Capacidad crítica" : isWarning ? "Tráfico alto" : "Tráfico normal"}
            </div>
        </div>
    );
}

// ─── CRM Leads Component ─────────────────────────────────────────
const MOCK_LEADS = [
    { id: 1, name: "Ana Sofia", phase: "Nuevo", date: "Hace 10 min", source: "Instagram" },
    { id: 2, name: "Carlos R.", phase: "Contactado", date: "Hace 2 horas", source: "Referido" },
    { id: 3, name: "Mariana G.", phase: "Clase de Prueba", date: "Hoy 09:00 AM", source: "Google" },
    { id: 4, name: "Diego T.", phase: "Inscrito", date: "Ayer", source: "Instagram" },
];

function CRMLeadsOverview() {
    return (
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">CRM — Leads Recientes</h2>
                </div>
                <Link to="/admin/crm" className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1">
                    Ver pipeline completo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Nuevos Hoy", value: 12, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { label: "Contactados", value: 8, color: "text-amber-400", bg: "bg-amber-500/10" },
                    { label: "Pruebas Agendadas", value: 5, color: "text-purple-400", bg: "bg-purple-500/10" },
                    { label: "Convertidos", value: 3, color: "text-green-400", bg: "bg-green-500/10" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 flex flex-col justify-center border border-white/[0.04]">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">{stat.label}</span>
                        <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                {MOCK_LEADS.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/[0.04] group cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <span className="font-bold text-white/70 text-sm">{lead.name.slice(0, 1)}</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{lead.name}</p>
                                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mt-0.5">{lead.source} • {lead.date}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${lead.phase === "Nuevo" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                lead.phase === "Contactado" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                    lead.phase === "Clase de Prueba" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                        "bg-green-500/10 text-green-400 border-green-500/20"
                                }`}>
                                {lead.phase}
                            </span>
                            <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"><MessageCircle className="w-4 h-4" /></button>
                                <button className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"><Phone className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { useFetcher, Link } from "react-router";

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAdmin(request);

    // Fetch stats from materialized view (Enforced multitenancy via gymId)
    const { data: stats } = await supabaseAdmin
        .from("admin_dashboard_view")
        .select("*")
        .eq("gym_id", gymId)
        .single();

    // Fetch churn risk users via RPC
    const { data: churnUsers } = await supabaseAdmin
        .rpc("get_churn_risk_users", { days_threshold: 7 });
        // NOTE: RPC get_churn_risk_users doesn't filter by gym_id internally in the SQL provided 
        // in previous step, I should double check that or filter here.
        // Actually the SQL was: SELECT ... WHERE m.gym_id = m.gym_id ... GROUP BY ...
        // Wait, the SQL RPC I created was:
        /*
        CREATE OR REPLACE FUNCTION public.get_churn_risk_users(days_threshold INT DEFAULT 7)
        ...
        WHERE m.status = 'active'
        GROUP BY p.id, p.full_name, p.phone, p.email, m.gym_id, m.end_date, m.id
        */
        // It returns data for all gyms if not filtered.
        const filteredChurn = churnUsers?.filter((u: any) => u.gym_id === gymId) || [];

    const liveData = {
        currentOccupancy: stats?.current_occupancy || 0,
        maxCapacity: stats?.max_capacity || 0,
        activeMembers: stats?.active_members || 0,
        totalUsers: (stats?.active_members || 0) + (stats?.expired_members || 0),
        todayRevenue: stats?.today_revenue || 0,
        mrr: stats?.mrr || 0,
        churnRiskUsers: filteredChurn,
    };

    return { live: liveData, actions: MOCK_ACTIONS };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "refresh_stats") {
        const { triggerAdminStatsUpdate } = await import("~/services/n8n.server");
        await triggerAdminStatsUpdate(gymId);
        return { success: true, message: "Estadísticas en proceso de actualización." };
    }

    return { success: true, intent };
}

// ─── Main Component ──────────────────────────────────────────────
export default function AdminDashboardIndex({ loaderData }: Route.ComponentProps) {
    const { live, actions } = loaderData;
    const fetcher = useFetcher();

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-white">Panel de Control</h1>
                    <p className="text-white/50 text-sm">Estado en tiempo real de tu estudio.</p>
                </div>
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="refresh_stats" />
                    <button
                        type="submit"
                        disabled={fetcher.state !== "idle"}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${fetcher.state !== "idle" ? "animate-spin text-blue-400" : ""}`} />
                        {fetcher.state !== "idle" ? "Actualizando..." : "Actualizar Estadísticas"}
                    </button>
                </fetcher.Form>
            </header>

            {/* SETUP BAR */}
            <StudioSetup />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Miembros activos", value: live.activeMembers, sub: `de ${live.totalUsers} registrados`, icon: <Users className="w-5 h-5 text-blue-400" />, bg: "bg-blue-500/20" },
                    { label: "Ingreso hoy", value: `$${live.todayRevenue}`, sub: "vs. promedio diario", icon: <DollarSign className="w-5 h-5 text-green-400" />, bg: "bg-green-500/20", color: "text-green-400" },
                    { label: "MRR", value: `$${live.mrr}`, sub: "Ingreso mensual", icon: <TrendingUp className="w-5 h-5 text-purple-400" />, bg: "bg-purple-500/20", color: "text-purple-400" },
                    { label: "Riesgo de fuga", value: live.churnRiskUsers.length, sub: "usuarios inactivos", icon: <AlertTriangle className="w-5 h-5 text-red-400" />, bg: "bg-red-500/20", color: "text-red-400" },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white/[0.03] backdrop-blur-2xl p-5 rounded-2xl shadow-2xl border border-white/[0.08]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 ${kpi.bg} rounded-xl`}>{kpi.icon}</div>
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none">{kpi.label}</span>
                        </div>
                        <p className={`text-3xl font-black ${kpi.color || "text-white"}`}>{kpi.value}</p>
                        <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-tight">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* CRM LEADS OVERVIEW */}
            <CRMLeadsOverview />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-white/40" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Ocupación en vivo</h2>
                    </div>
                    <OccupancyGauge current={live.currentOccupancy} max={live.maxCapacity} />
                </div>

                <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6">⚠️ Usuarios en riesgo de fuga</h2>
                    {live.churnRiskUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                                <Users className="w-6 h-6 text-white/20" />
                            </div>
                            <p className="text-white/40 font-medium text-sm italic">No hay usuarios en riesgo actualmente.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {live.churnRiskUsers.slice(0, 5).map((user: any) => (
                                <div key={user.user_id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{user.first_name}</p>
                                            <p className="text-[10px] text-white/40 uppercase tracking-wider">{user.days_inactive} días inactivo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full">ALTO RIESGO</span>
                                        <button className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors">
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Items */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Acciones requeridas</h2>
                {actions.length === 0 ? (
                    <div className="py-4 text-center">
                        <p className="text-white/40 font-medium text-sm italic">Todo al día. No hay acciones pendientes.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Feed items would go here */}
                    </div>
                )}
            </div>
        </div>
    );
}
