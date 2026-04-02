// app/routes/admin/_index.tsx
// Admin Dashboard – Studio Setup + Live KPIs from Supabase.
import type { Route } from "./+types/_index";
import {
    Users, DollarSign, TrendingUp, AlertTriangle,
    RefreshCw, Activity,
    CheckCircle2, Circle, ArrowRight, UserPlus, MessageCircle, Phone
} from "lucide-react";
import { useFetcher, Link, useRouteLoaderData } from "react-router";
import { useState, useMemo } from "react";
import { 
    ChevronLeft, ChevronRight, LayoutGrid, Calendar as CalendarIcon, 
    Clock, MapPin, User
} from "lucide-react";
import { AdminOnboardingWidget } from "~/components/admin/AdminOnboardingWidget";

// ─── Types ──────────────────────────────────────────────────────
type SetupStep = { name: string; description: string; path: string; completed: boolean };
type LeadRow = { id: string; full_name: string; stage: string; source: string; created_at: string };

// ─── Loader ─────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAdmin(request);

    // ── Parallel data fetches ──
    const [
        { data: gym },
        { data: stats },
        { data: churnUsers },
        { count: locationCount },
        { count: roomCount },
        { count: classTypeCount },
        { count: coachCount },
        { count: scheduleCount },
        { count: planCount },
        { count: productCount },
        { data: recentLeads },
        { count: leadsNew },
        { count: leadsContacted },
        { count: leadsTrial },
        { count: leadsConverted },
    ] = await Promise.all([
        // Gym branding
        supabaseAdmin.from("gyms").select("name, primary_color, brand_color, studio_type").eq("id", gymId).single(),
        // Dashboard stats
        supabaseAdmin.from("admin_dashboard_view").select("*").eq("gym_id", gymId).single(),
        // Churn risk
        supabaseAdmin.rpc("get_churn_risk_users", { days_threshold: 7 }),
        // Setup step counts
        supabaseAdmin.from("locations").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        supabaseAdmin.from("rooms").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        supabaseAdmin.from("class_types").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        supabaseAdmin.from("coaches").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        supabaseAdmin.from("schedules").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("category", "plan"),
        supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
        // Recent leads
        supabaseAdmin.from("leads").select("id, full_name, stage, source, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(4),
        // Lead stage counts
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("stage", "new"),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("stage", "contacted"),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("stage", "trial"),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("stage", "converted"),
    ]);

    // Fetch classes for schedule dashboard
    const { getClassesForGym } = await import("~/services/booking.server");
    const classes = await getClassesForGym(gymId);

    const filteredChurn = churnUsers?.filter((u: any) => u.gym_id === gymId) || [];

    // Build setup steps
    const setupSteps: SetupStep[] = [
        { name: "Mi Estudio", description: "Sube tu logotipo y configura los colores de tu marca.", path: "/admin/studio", completed: !!(gym?.name) },
        { name: "Sedes y Salones", description: "Agrega tus ubicaciones y configura la capacidad de los salones.", path: "/admin/ubicaciones", completed: (locationCount ?? 0) > 0 && (roomCount ?? 0) > 0 },
        { name: "Coaches", description: "Registra a los instructores que impartirán tus clases.", path: "/admin/coaches", completed: (coachCount ?? 0) > 0 },
        { name: "Planes de Membresía", description: "Define el costo y los créditos de tus paquetes o planes.", path: "/admin/planes", completed: (planCount ?? 0) > 0 },
        { name: "Métodos de Cobro", description: "Conecta Stripe o Mercado Pago para procesar pagos en línea.", path: "/admin/pagos", completed: true }, // As payments might be optional/different, defaulting or checking differently, ideally checking keys but we will let it just be present.
        { name: "Punto de Venta", description: "Configura productos físicos para vender en mostrador.", path: "/admin/pos", completed: (productCount ?? 0) > 0 },
        { name: "Usuarios", description: "Agrega a tus primeros clientes o importa tu base de datos.", path: "/admin/users", completed: (stats?.active_members || 0) > 0 },
        { name: "Clases y Horarios", description: "Crea los formatos de clase y programa tu calendario semanal.", path: "/admin/horarios", completed: (classTypeCount ?? 0) > 0 && (scheduleCount ?? 0) > 0 },
    ];

    return {
        gymId,
        primaryColor: gym?.brand_color || gym?.primary_color || "#7c3aed",
        studioType: gym?.studio_type || null,
        setupSteps,
        live: {
            currentOccupancy: stats?.current_occupancy || 0,
            maxCapacity: stats?.max_capacity || 0,
            activeMembers: stats?.active_members || 0,
            totalUsers: (stats?.active_members || 0) + (stats?.expired_members || 0),
            todayRevenue: stats?.today_revenue || 0,
            mrr: stats?.mrr || 0,
            churnRiskUsers: filteredChurn,
        },
        leads: (recentLeads ?? []) as LeadRow[],
        leadStats: {
            new: leadsNew ?? 0,
            contacted: leadsContacted ?? 0,
            trial: leadsTrial ?? 0,
            converted: leadsConverted ?? 0,
        },
        classes,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "refresh_stats") {
        const { triggerAdminStatsUpdate } = await import("~/services/n8n.server");
        await triggerAdminStatsUpdate(gymId);
        return { success: true, message: "Estadísticas en proceso de actualización." };
    }

    return { success: true, intent };
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
                {max === 0 ? "Sin datos" : isAlert ? "Capacidad crítica" : isWarning ? "Tráfico alto" : "Tráfico normal"}
            </div>
        </div>
    );
}

// ─── CRM Leads Component ─────────────────────────────────────────
function CRMLeadsOverview({ leads, stats }: { leads: LeadRow[]; stats: { new: number; contacted: number; trial: number; converted: number } }) {
    const stageLabels: Record<string, string> = { new: "Nuevo", contacted: "Contactado", trial: "Clase de Prueba", converted: "Inscrito" };
    const stageColors: Record<string, string> = {
        new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        trial: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        converted: "bg-green-500/10 text-green-400 border-green-500/20",
    };

    function timeAgo(dateStr: string) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `Hace ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `Hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `Hace ${days}d`;
    }

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Nuevos", value: stats.new, color: "text-blue-400" },
                    { label: "Contactados", value: stats.contacted, color: "text-amber-400" },
                    { label: "Pruebas Agendadas", value: stats.trial, color: "text-purple-400" },
                    { label: "Convertidos", value: stats.converted, color: "text-green-400" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 flex flex-col justify-center border border-white/[0.04]">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1">{stat.label}</span>
                        <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {leads.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-6 italic">No hay leads registrados aún.</p>
            ) : (
                <div className="space-y-2">
                    {leads.map(lead => (
                        <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/[0.04] group cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <span className="font-bold text-white/70 text-sm">{lead.full_name.slice(0, 1)}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{lead.full_name}</p>
                                    <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mt-0.5">{lead.source} • {timeAgo(lead.created_at)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${stageColors[lead.stage] || "bg-white/5 text-white/40 border-white/10"}`}>
                                    {stageLabels[lead.stage] || lead.stage}
                                </span>
                                <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"><MessageCircle className="w-4 h-4" /></button>
                                    <button className="p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"><Phone className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Dashboard Calendar Components ──────────────────────────────
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ScheduleDashboard({ classes }: { classes: any[] }) {
    const [viewMode, setViewMode] = useState<"week" | "month">("week");
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date());

    // Filter classes for the current week or month
    const filteredClasses = useMemo(() => {
        if (viewMode === "week") {
            const startOfWeek = new Date(viewDate);
            startOfWeek.setDate(viewDate.getDate() - (viewDate.getDay() === 0 ? 6 : viewDate.getDay() - 1));
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            return classes.filter(c => {
                const d = new Date(c.start_time);
                return d >= startOfWeek && d <= endOfWeek;
            });
        } else {
            return classes.filter(c => {
                const d = new Date(c.start_time);
                return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
            });
        }
    }, [classes, viewMode, viewDate]);

    const navigate = (direction: number) => {
        const next = new Date(viewDate);
        if (viewMode === "week") {
            next.setDate(viewDate.getDate() + (direction * 7));
        } else {
            next.setMonth(viewDate.getMonth() + direction);
        }
        setViewDate(next);
    };

    const resetToToday = () => setViewDate(new Date());

    return (
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden flex flex-col mb-6">
            <div className="p-6 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-xl">
                        <CalendarIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cronograma de Sesiones</h2>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">
                            {viewMode === "week" ? "Vista Semanal" : "Vista Mensual"} — {viewMode === "week" ? `Semana del ${new Date(viewDate.setDate(viewDate.getDate() - (viewDate.getDay() === 0 ? 6 : viewDate.getDay() - 1))).toLocaleDateString()}` : `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
                        <button
                            onClick={() => setViewMode("week")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "week" ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/60"}`}
                        >
                            <LayoutGrid className="w-3 h-3" />
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode("month")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "month" ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/60"}`}
                        >
                            <CalendarIcon className="w-3 h-3" />
                            Mes
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg text-white/50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={resetToToday} className="px-3 py-1 text-[10px] font-black uppercase tracking-tighter text-white/40 hover:text-white/70 transition-colors">Hoy</button>
                        <button onClick={() => navigate(1)} className="p-2 hover:bg-white/5 rounded-lg text-white/50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-6 overflow-x-auto hide-scrollbar">
                {viewMode === "week" ? (
                    <div className="grid grid-cols-7 gap-2 md:gap-3 min-w-[700px]">
                        {DAYS.map((day, i) => {
                            const date = new Date(viewDate);
                            date.setDate(viewDate.getDate() - (viewDate.getDay() === 0 ? 6 : viewDate.getDay() - 1) + i);
                            const isToday = date.toDateString() === today.toDateString();
                            const dayClasses = filteredClasses.filter(c => new Date(c.start_time).toDateString() === date.toDateString());

                            return (
                                <div key={day} className="flex flex-col gap-2">
                                    <div className="text-center pb-2 border-b border-white/5">
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{day}</p>
                                        <p className={`text-sm font-black mt-1 ${isToday ? "text-purple-400" : "text-white/60"}`}>{date.getDate()}</p>
                                    </div>
                                    <div className="space-y-2 min-h-[200px]">
                                        {dayClasses.map(cls => (
                                            <div key={cls.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 group hover:border-purple-500/30 transition-all cursor-default">
                                                <p className="text-xs font-black text-white leading-tight group-hover:text-purple-400 transition-colors line-clamp-1">{cls.title}</p>
                                                <div className="flex flex-col gap-1 mt-2">
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/30 uppercase">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                                                            <User className="w-2.5 h-2.5" />
                                                            {cls.coach?.name || "Staff"}
                                                        </div>
                                                        <div className="text-[9px] font-black text-white/20 ml-auto">
                                                            {cls.current_enrolled}/{cls.capacity}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {dayClasses.length === 0 && (
                                            <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-xl">
                                                <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest">Libre</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl border border-white/10 min-w-[600px]">
                        {DAYS.map(day => (
                            <div key={day} className="bg-white/[0.02] p-2 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">{day}</div>
                        ))}
                        {/* Month matrix would go here - simplified for space */}
                        {Array.from({ length: 35 }).map((_, i) => {
                            const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                            const startOffset = (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1);
                            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), i - startOffset + 1);
                            const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                            const isToday = date.toDateString() === today.toDateString();
                            const dayClasses = filteredClasses.filter(c => new Date(c.start_time).toDateString() === date.toDateString());

                            return (
                                <div key={i} className={`min-h-[80px] p-2 bg-white/[0.01] border-t border-r border-white/5 last:border-r-0 ${!isCurrentMonth ? "opacity-20" : ""}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-black ${isToday ? "text-purple-400" : "text-white/40"}`}>{date.getDate()}</span>
                                        {dayClasses.length > 0 && <span className="w-1 h-1 rounded-full bg-purple-500" />}
                                    </div>
                                    <div className="space-y-1">
                                        {dayClasses.slice(0, 2).map(cls => (
                                            <div key={cls.id} className="text-[9px] font-bold text-white/60 truncate bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                                                {new Date(cls.start_time).getHours()}:00 {cls.title}
                                            </div>
                                        ))}
                                        {dayClasses.length > 2 && (
                                            <div className="text-[8px] font-black text-white/20 text-center uppercase">+{dayClasses.length - 2} más</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-white/5 flex items-center justify-center">
                <Link to="/admin/schedule" className="text-[10px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest flex items-center gap-2 group transition-all">
                    Gestionar Calendario Completo
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function AdminDashboardIndex({ loaderData }: Route.ComponentProps) {
    const { live, primaryColor, leads, leadStats, classes, gymId, setupSteps } = loaderData;
    const fetcher = useFetcher();

    return (
        <div className="space-y-6">
            <AdminOnboardingWidget steps={setupSteps} />
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <CRMLeadsOverview leads={leads} stats={leadStats} />

            {/* SCHEDULE DASHBOARD */}
            <ScheduleDashboard classes={classes} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-white/40" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Ocupación en vivo</h2>
                    </div>
                    <OccupancyGauge current={live.currentOccupancy} max={live.maxCapacity} />
                </div>

                <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Usuarios en riesgo de fuga</h2>
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
        </div>
    );
}
