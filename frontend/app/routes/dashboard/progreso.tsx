// app/routes/dashboard/progreso.tsx
// Full Strava activity history with metrics and summary cards.

import type { Route } from "./+types/progreso";
import { Link } from "react-router";
import { Activity, Heart, Flame, Clock, TrendingUp, ChevronLeft, Zap } from "lucide-react";
import { useDashboardTheme } from "~/hooks/useDashboardTheme";

// ─── Loader ───────────────────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { getStravaConnection, getStoredActivities } = await import("~/services/strava.server");

    const { profile, gymId } = await requireGymAuth(request);

    const conn = await getStravaConnection(profile.id, gymId);
    if (!conn) {
        return {
            connected: false,
            activities: [],
            summary: { totalSessions: 0, totalMinutes: 0, totalCalories: 0, avgHR: 0, maxHR: 0 },
        };
    }

    const activities = await getStoredActivities(profile.id, gymId, 50);

    const totalSessions = activities.length;
    const totalMinutes  = activities.reduce((s: number, a: any) => s + Math.round(a.moving_time / 60), 0);
    const totalCalories = activities.reduce((s: number, a: any) => s + (Number(a.calories) || 0), 0);

    const hrActivities = activities.filter((a: any) => a.has_heartrate && a.average_heartrate);
    const avgHR = hrActivities.length > 0
        ? Math.round(hrActivities.reduce((s: number, a: any) => s + Number(a.average_heartrate), 0) / hrActivities.length)
        : 0;
    const maxHR = hrActivities.length > 0
        ? Math.round(Math.max(...hrActivities.map((a: any) => Number(a.max_heartrate || 0))))
        : 0;

    return {
        connected: true,
        activities,
        summary: { totalSessions, totalMinutes, totalCalories: Math.round(totalCalories), avgHR, maxHR },
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMinutes(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function sportLabel(type: string) {
    const map: Record<string, string> = {
        Run: "Carrera", Ride: "Ciclismo", Walk: "Caminata", Hike: "Senderismo",
        WeightTraining: "Pesas", Workout: "Entrenamiento", Swim: "Natación",
        Yoga: "Yoga", Crossfit: "CrossFit", Elliptical: "Elíptica",
    };
    return map[type] ?? type;
}

function sportColor(type: string) {
    const map: Record<string, string> = {
        Run: "#FC4C02", Ride: "#3b82f6", Walk: "#10b981", Hike: "#84cc16",
        WeightTraining: "#a855f7", Workout: "#f59e0b", Swim: "#06b6d4",
    };
    return map[type] ?? "#6b7280";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProgresoPage({ loaderData }: Route.ComponentProps) {
    const { connected, activities, summary } = loaderData as any;
    const th = useDashboardTheme();

    if (!connected) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
                <div className="bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-2xl p-10 space-y-4">
                    <Activity className="w-12 h-12 text-[#FC4C02] mx-auto" />
                    <h2 className={`text-xl font-bold ${th.title}`}>Conecta tu cuenta de Strava</h2>
                    <p className={`${th.muted} text-sm`}>
                        Vincula tu Strava para ver tu historial completo de actividades, calorías y frecuencia cardíaca.
                    </p>
                    <Link
                        to="/dashboard/strava/connect"
                        className="inline-block bg-[#FC4C02] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#FC4C02]/90 transition-all"
                    >
                        Conectar Strava
                    </Link>
                </div>
            </div>
        );
    }

    const summaryCards = [
        { label: "Sesiones",      value: String(summary.totalSessions),           unit: "",     icon: Activity,   color: "#FC4C02" },
        { label: "Tiempo total",  value: formatMinutes(summary.totalMinutes),      unit: "",     icon: Clock,      color: "#3b82f6" },
        { label: "Calorías",      value: summary.totalCalories.toLocaleString(),   unit: "kcal", icon: Flame,      color: "#f59e0b" },
        { label: "FC promedio",   value: summary.avgHR > 0 ? String(summary.avgHR) : "—",  unit: summary.avgHR > 0 ? "bpm" : "", icon: Heart, color: "#ef4444" },
        { label: "FC máxima",     value: summary.maxHR > 0 ? String(summary.maxHR)  : "—",  unit: summary.maxHR > 0 ? "bpm" : "", icon: TrendingUp, color: "#a855f7" },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <Link to="/dashboard" className={`${th.muted} hover:${th.title} transition-colors`}>
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className={`text-2xl font-bold ${th.title}`}>Mi Progreso</h1>
                    <p className={`${th.muted} text-sm flex items-center gap-1`}>
                        <span className="inline-block w-2 h-2 rounded-full bg-[#FC4C02]" />
                        Strava conectado
                    </p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {summaryCards.map((c) => (
                    <div key={c.label} className={`${th.card} rounded-2xl p-4 flex flex-col gap-1`}>
                        <c.icon className="w-4 h-4 mb-1" style={{ color: c.color }} />
                        <p className={`text-xl font-bold ${th.title} leading-none`}>
                            {c.value}
                            {c.unit && <span className="text-xs font-normal ml-1">{c.unit}</span>}
                        </p>
                        <p className={`${th.muted} text-xs`}>{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Activity list */}
            <div className={`${th.card} rounded-2xl overflow-hidden`}>
                <div className="px-5 py-4 border-b border-white/5">
                    <h2 className={`font-bold ${th.title}`}>Historial de actividades</h2>
                </div>

                {activities.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className={`${th.muted} text-sm`}>Sin actividades sincronizadas aún</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {activities.map((act: any) => (
                            <div key={act.strava_activity_id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors">

                                {/* Sport icon dot */}
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${sportColor(act.sport_type)}20` }}
                                >
                                    <Activity className="w-4 h-4" style={{ color: sportColor(act.sport_type) }} />
                                </div>

                                {/* Name + date */}
                                <div className="flex-1 min-w-0">
                                    <p className={`${th.title} font-semibold text-sm truncate`}>{act.name}</p>
                                    <p className={`${th.muted} text-xs`}>
                                        {sportLabel(act.sport_type)} · {new Date(act.start_date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                </div>

                                {/* Metrics */}
                                <div className="flex items-center gap-4 shrink-0 text-right">
                                    <div>
                                        <p className={`${th.title} text-sm font-semibold`}>{formatMinutes(Math.round(act.moving_time / 60))}</p>
                                        <p className={`${th.muted} text-[10px]`}>duración</p>
                                    </div>

                                    {act.calories != null && Number(act.calories) > 0 && (
                                        <div>
                                            <p className="text-sm font-semibold text-[#FC4C02]">{Math.round(act.calories)} kcal</p>
                                            <p className={`${th.muted} text-[10px]`}>calorías</p>
                                        </div>
                                    )}

                                    {act.has_heartrate && act.average_heartrate != null && (
                                        <div className="hidden sm:block">
                                            <p className="text-sm font-semibold text-red-400 flex items-center gap-0.5">
                                                <Heart className="w-3 h-3" />
                                                {Math.round(act.average_heartrate)}
                                            </p>
                                            <p className={`${th.muted} text-[10px]`}>avg bpm</p>
                                        </div>
                                    )}

                                    {act.fitcoins_awarded && (
                                        <div className="hidden sm:flex items-center gap-0.5 text-yellow-400">
                                            <Zap className="w-3 h-3" />
                                            <span className="text-xs font-bold">+15</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
