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
    Clock, MapPin, User, X, Trash2
} from "lucide-react";
import { AdminOnboardingWidget } from "~/components/admin/AdminOnboardingWidget";
import { RoomLayoutWidget } from "~/components/admin/RoomLayoutWidget";
import type { GymRoom } from "~/services/room.server";

// ─── Types ──────────────────────────────────────────────────────
type SetupStep = { name: string; description: string; path: string; completed: boolean };
type LeadRow = { id: string; full_name: string; stage: string; source: string; created_at: string };

// ─── Loader ─────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAdmin(request);

    // ── Parallel data fetches ──
    // Use ISO date string for today so Supabase filters by calendar day in UTC,
    // which matches how created_at is stored (Supabase always stores in UTC).
    // For MX gyms this is close enough; a per-gym timezone offset can be added later.
    const todayIso = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const todayStart = `${todayIso}T00:00:00.000Z`;
    const todayEnd   = `${todayIso}T23:59:59.999Z`;

    const [
        { data: gym },
        { data: churnUsers },
        { count: locationCount },
        { count: roomCount },
        { count: classTypeCount },
        { count: coachCount },
        { count: scheduleCount },
        { count: planCount },
        { count: productCount },
        { data: todayOrders },
        { data: activeMemberships },
        { count: totalMembers },
        { count: activeMembers },
    ] = await Promise.all([
        // Gym branding & layout
        supabaseAdmin.from("gyms").select("name, primary_color, brand_color, studio_type, booking_mode, layout_config, default_capacity").eq("id", gymId).single(),
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
        // Today revenue from orders — all paid orders in the current calendar day (UTC)
        supabaseAdmin.from("orders").select("total").eq("gym_id", gymId).eq("status", "paid").gte("created_at", todayStart).lte("created_at", todayEnd),
        // MRR from active memberships
        supabaseAdmin.from("memberships").select("price").eq("gym_id", gymId).eq("status", "active"),
        // Member counts
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("role", "member"),
        supabaseAdmin.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).eq("status", "active"),
    ]);

    const todayRevenue = (todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const mrr = (activeMemberships ?? []).reduce((s, m) => s + Number(m.price), 0);

    const stats = {
        today_revenue: todayRevenue,
        mrr,
        active_members: activeMembers ?? 0,
        expired_members: Math.max(0, (totalMembers ?? 0) - (activeMembers ?? 0)),
        current_occupancy: 0,
        max_capacity: 0,
    };

    const { getClassesForGym } = await import("~/services/booking.server");
    const { getGymRooms } = await import("~/services/room.server");
    const { getGymEvents } = await import("~/services/event.server");
    const [classes, rooms, rawEvents] = await Promise.all([
        getClassesForGym(gymId),
        getGymRooms(gymId),
        getGymEvents(gymId),
    ]);

    const eventItems = rawEvents.map(e => ({
        id: e.id,
        title: e.name,
        start_time: e.start_time,
        capacity: e.max_capacity,
        current_enrolled: e.current_enrolled,
        coach_name: "Evento Exclusivo",
        isEvent: true,
    }));
    const allScheduleItems = [...classes, ...eventItems];

    // Fetch Active Clients (recent members)
    const { data: recentClientsData } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, created_at, memberships(status, plan_name)")
        .eq("gym_id", gymId)
        .eq("role", "member")
        .order("created_at", { ascending: false })
        .limit(6);
        
    // Fetch Gym Plans for Create form
    const { getGymPlans } = await import("~/services/plan.server");
    const gymPlans = await getGymPlans(gymId);

    // Identificar la próxima clase inminente (a partir de ahora)
    const now = new Date();
    const upcomingClasses = allScheduleItems
        .filter(c => new Date(c.start_time) >= now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const nextClass = upcomingClasses.length > 0 ? upcomingClasses[0] : null;

    const filteredChurn = churnUsers?.filter((u: any) => u.gym_id === gymId) || [];

    // Build setup steps
    const setupSteps: SetupStep[] = [
        { name: "Mi Estudio", description: "Sube tu logotipo y configura los colores de tu marca.", path: "/admin/studio", completed: !!(gym?.name) },
        { name: "Sedes y Salones", description: "Agrega tus ubicaciones y configura la capacidad de los salones.", path: "/admin/ubicaciones", completed: (locationCount ?? 0) > 0 && (roomCount ?? 0) > 0 },
        { name: "Coaches", description: "Registra a los instructores que impartirán tus clases.", path: "/admin/coaches", completed: (coachCount ?? 0) > 0 },
        { name: "Planes de Membresía", description: "Define el costo y los créditos de tus paquetes o planes.", path: "/admin/planes", completed: (planCount ?? 0) > 0 },
        { name: "Métodos de Cobro", description: "Conecta Stripe o Mercado Pago para procesar pagos en línea.", path: "/admin/pagos", completed: true }, // As payments might be optional/different, defaulting or checking differently, ideally checking keys but we will let it just be present.
        { name: "Punto de Venta", description: "Configura productos físicos para vender en mostrador.", path: "/admin/pos", completed: (productCount ?? 0) > 0 },
        { name: "Usuarios", description: "Agrega a tus primeros clientes o importa tu base de datos.", path: "/admin/users", completed: (totalMembers ?? 0) > 0 },
        { name: "Clases y Horarios", description: "Crea los formatos de clase y programa tu calendario semanal.", path: "/admin/horarios", completed: (classTypeCount ?? 0) > 0 && (scheduleCount ?? 0) > 0 },
    ];

    return {
        gymId,
        primaryColor: gym?.brand_color || gym?.primary_color || "#7c3aed",
        studioType: gym?.studio_type || null,
        gym: gym || null,
        nextClass,
        setupSteps,
        live: {
            currentOccupancy: stats.current_occupancy,
            maxCapacity: stats.max_capacity,
            activeMembers: stats.active_members,
            totalUsers: totalMembers ?? 0,
            todayRevenue: stats.today_revenue,
            mrr: stats.mrr,
            churnRiskUsers: filteredChurn,
        },
        activeClients: recentClientsData || [],
        gymPlans: gymPlans.filter(p => p.is_active) || [],
        classes: allScheduleItems,
        rooms,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "refresh_stats") {
        // Stats now computed live on page load — just return success to trigger a reload
        return { success: true, message: "Estadísticas actualizadas." };
    }

    if (intent === "save_room_layout") {
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const roomId = formData.get("roomId") as string;
        const layoutConfigRaw = formData.get("layoutConfig") as string;
        const resourcesRaw = formData.get("resources") as string;
        const layoutConfig = JSON.parse(layoutConfigRaw);
        const resources: Array<{ row: number; col: number; name: string; resourceType: string }> = JSON.parse(resourcesRaw);

        const { error: err1 } = await supabaseAdmin.from("rooms").update({ layout_config: layoutConfig }).eq("id", roomId).eq("gym_id", gymId);
        if (err1) {
            console.error("Error updating layout_config:", err1);
            return { success: false, error: err1.message };
        }

        // Replace resources for this room
        const { error: err2 } = await supabaseAdmin.from("resources").delete().eq("room_id", roomId).eq("gym_id", gymId);
        if (err2) {
            console.error("Error deleting old resources:", err2);
            return { success: false, error: err2.message };
        }

        if (resources.length > 0) {
            // Make names unique per room by appending a room-scoped suffix.
            // This avoids the UNIQUE(gym_id, name) constraint until migration 014
            // (which drops that constraint) is applied in Supabase.
            const roomSuffix = roomId.replace(/-/g, "").slice(-6);
            const rows = resources.map(r => ({
                gym_id: gymId,
                room_id: roomId,
                name: `${r.name}__${roomSuffix}`,
                resource_type: r.resourceType,
                position_row: r.row,
                position_col: r.col,
                is_active: true,
            }));

            const { error: err3 } = await supabaseAdmin.from("resources").insert(rows);
            if (err3) {
                console.error("Error inserting resources:", err3);
                return { success: false, error: err3.message };
            }
        }
        return { success: true, intent };
    }

    if (intent === "create_room") {
        const { createRoom } = await import("~/services/room.server");
        const name = formData.get("name") as string;
        const capacity = parseInt(formData.get("capacity") as string) || 10;
        try {
            await createRoom({ gymId, name, locationId: null, capacity, equipment: null });
            return { success: true, intent };
        } catch (error: any) {
            console.error("Error creating room:", error);
            return { success: false, error: error.message };
        }
    }

    if (intent === "delete_room") {
        const { deleteRoom } = await import("~/services/room.server");
        const roomId = formData.get("roomId") as string;
        await deleteRoom(roomId, gymId);
        return { success: true, intent };
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

// ─── Active Clients Component (Replaces CRM Leads) ──────────────────
function ActiveClientsOverview({ clients, plans }: { clients: any[]; plans: any[] }) {
    const [showAdd, setShowAdd] = useState(false);
    const fetcher = useFetcher();

    // Reset form and close on successful creation
    useMemo(() => {
        if (fetcher.state === "idle" && fetcher.data?.success && showAdd) {
            setShowAdd(false);
        }
    }, [fetcher.state, fetcher.data, showAdd]);

    function timeAgo(dateStr: string) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return "Hoy";
        if (days === 1) return "Ayer";
        return `Hace ${days}d`;
    }

    return (
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Clientes Recientes</h2>
                </div>
                <div className="flex gap-4 items-center">
                    <Link to="/admin/users" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                        Ver todos <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button 
                        onClick={() => setShowAdd(!showAdd)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        {showAdd ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                        {showAdd ? "Cancelar" : "Nuevo Cliente"}
                    </button>
                </div>
            </div>

            {/* Quick Add Form */}
            {showAdd && (
                <div className="mb-6 p-4 bg-white/5 border border-indigo-500/30 rounded-xl">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Registrar Nuevo Cliente</h3>
                    {fetcher.data?.error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-xs font-bold text-red-200">
                            {fetcher.data.error}
                        </div>
                    )}
                    <fetcher.Form action="/admin/users" method="post" className="flex flex-col md:flex-row gap-3 items-end">
                        <input type="hidden" name="intent" value="create_user" />
                        
                        <div className="w-full md:w-1/3">
                            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Nombre Completo</label>
                            <input 
                                required 
                                type="text" 
                                name="full_name" 
                                placeholder="Ej. Ana García" 
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                            />
                        </div>
                        
                        <div className="w-full md:w-1/3">
                            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Correo Electrónico</label>
                            <input 
                                required 
                                type="email" 
                                name="email" 
                                placeholder="ana@ejemplo.com" 
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                            />
                        </div>

                        <div className="w-full md:w-1/4">
                            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Plan Inicial</label>
                            <select 
                                name="planId" 
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="none">Sin plan (Créditos en 0)</option>
                                {plans.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.credits === null ? 'Ilimitado' : p.credits + ' cr'})</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            disabled={fetcher.state !== "idle"}
                            className="w-full md:w-auto mt-2 md:mt-0 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {fetcher.state === "submitting" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Crear
                        </button>
                    </fetcher.Form>
                </div>
            )}

            {clients.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-6 italic">No hay clientes activos aún.</p>
            ) : (
                <div className="space-y-2">
                    {clients.map(client => {
                        const planName = client.memberships?.[0]?.plan_name || "Sin membresía";
                        const isActive = client.memberships?.[0]?.status === 'active';

                        return (
                            <div key={client.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/[0.04] group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                        <span className="font-black text-indigo-400 text-sm">
                                            {client.full_name ? client.full_name.slice(0, 1).toUpperCase() : "U"}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{client.full_name || "Usuario sin nombre"}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-white/40 font-medium">Registrado {timeAgo(client.created_at)}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${isActive ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>
                                                {planName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Acciones rápidas */}
                                <div className="flex items-center gap-2">
                                    <fetcher.Form action="/admin/users" method="post" onSubmit={(e) => {
                                        if(!confirm(`¿Estás seguro de eliminar a ${client.full_name}? Esto borrará todo su historial. Esta acción no se puede deshacer.`)) {
                                            e.preventDefault();
                                        }
                                    }}>
                                        <input type="hidden" name="intent" value="delete_user" />
                                        <input type="hidden" name="userId" value={client.id} />
                                        <button 
                                            type="submit" 
                                            title="Eliminar Cliente"
                                            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-white/20 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </fetcher.Form>
                                </div>
                            </div>
                        );
                    })}
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
    const [dayModalItems, setDayModalItems] = useState<{date: Date, classes: any[]} | null>(null);

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
                                            <div key={cls.id} className={`p-2.5 rounded-xl border group transition-all cursor-default ${cls.isEvent ? "bg-violet-500/10 border-violet-500/30 hover:border-violet-500/50" : "bg-white/5 border-white/10 hover:border-purple-500/30"}`}>
                                                <p className={`text-xs font-black leading-tight transition-colors line-clamp-1 ${cls.isEvent ? "text-violet-300 group-hover:text-violet-200" : "text-white group-hover:text-purple-400"}`}>{cls.title}</p>
                                                <div className="flex flex-col gap-1 mt-2">
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/30 uppercase">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                                                            <User className="w-2.5 h-2.5" />
                                                            {(cls as any).coach_name || cls.coach?.name || "Sin coach"}
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
                                            <div key={cls.id} className={`text-[9px] font-bold truncate px-1.5 py-0.5 rounded-md border ${cls.isEvent ? "bg-violet-500/10 text-violet-300 border-violet-500/30" : "bg-white/5 text-white/60 border-white/5"}`}>
                                                {new Date(cls.start_time).getHours()}:00 {cls.title}
                                            </div>
                                        ))}
                                        {dayClasses.length > 2 && (
                                            <button 
                                                onClick={() => setDayModalItems({ date, classes: dayClasses })}
                                                className="w-full text-[8px] font-black text-white/40 hover:text-white text-center uppercase py-0.5 transition-colors"
                                            >
                                                +{dayClasses.length - 2} más
                                            </button>
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

            {dayModalItems && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setDayModalItems(null)}>
                    <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col text-white max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                            <h3 className="font-bold text-sm uppercase tracking-wider capitalize">
                                {dayModalItems.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                            </h3>
                            <button onClick={() => setDayModalItems(null)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2">
                            {dayModalItems.classes.map(cls => (
                                <div key={cls.id} className={`p-3 rounded-xl border ${cls.isEvent ? "bg-violet-500/10 border-violet-500/30" : "bg-white/5 border-white/10"}`}>
                                    <div className="flex justify-between items-start gap-2">
                                        <p className={`text-sm font-black leading-tight ${cls.isEvent ? "text-violet-300" : "text-white"}`}>{cls.title}</p>
                                        {cls.isEvent && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold uppercase tracking-widest border border-violet-500/30 shrink-0">Evento</span>}
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-white/40 uppercase">
                                            <Clock className="w-3 h-3" />
                                            {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="text-[10px] font-black text-white/20">
                                            {cls.current_enrolled}/{cls.capacity} pax
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function AdminDashboardIndex({ loaderData }: Route.ComponentProps) {
    const { live, primaryColor, activeClients, gymPlans, classes, gymId, setupSteps, gym, nextClass, rooms } = loaderData;
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

            {/* ROOM LAYOUT WIDGET — shown when booking_mode is assigned_resource OR there are rooms */}
            {(gym?.booking_mode === "assigned_resource" || (rooms && rooms.length > 0)) && (
                <RoomLayoutWidget
                    gym={gym}
                    rooms={rooms || []}
                    nextClass={nextClass}
                />
            )}

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

            {/* ACTIVE CLIENTS OVERVIEW */}
            <ActiveClientsOverview clients={activeClients} plans={gymPlans} />

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
