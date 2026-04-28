// app/routes/staff/schedule.tsx
// Front Desk: today's class schedule with occupancy + check-in status per attendee.

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, Users, Loader2 } from "lucide-react";
import type { Route } from "./+types/schedule";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymFrontDesk(request);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Classes today with booking count
    const { data: classes } = await supabaseAdmin
        .from("classes")
        .select(`
            id, title, start_time, end_time, capacity, current_enrolled,
            coach_id,
            rooms(name),
            bookings(
                id, status,
                profiles(id, full_name, avatar_url)
            )
        `)
        .eq("gym_id", gymId)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time", { ascending: true });

    // Fetch coach names separately
    const coachIds = [...new Set((classes ?? []).map((c: any) => c.coach_id).filter(Boolean))];
    let coachMap: Record<string, string> = {};
    if (coachIds.length > 0) {
        const { data: coaches } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name")
            .in("id", coachIds);
        coachMap = Object.fromEntries((coaches ?? []).map((c: any) => [c.id, c.full_name]));
    }

    // Get today's access_log entries for cross-referencing check-in status
    const { data: checkins } = await supabaseAdmin
        .from("access_logs")
        .select("user_id, created_at")
        .eq("gym_id", gymId)
        .eq("access_type", "entry")
        .gte("created_at", todayStart.toISOString());

    const checkedInUserIds = new Set((checkins ?? []).map((c: any) => c.user_id));

    const formatted = (classes ?? []).map((cls: any) => ({
        id: cls.id,
        title: cls.title,
        start_time: cls.start_time,
        end_time: cls.end_time,
        capacity: cls.capacity,
        current_enrolled: cls.current_enrolled,
        room_name: cls.rooms?.name ?? null,
        coach_name: coachMap[cls.coach_id] ?? null,
        attendees: (cls.bookings ?? [])
            .filter((b: any) => ["confirmed", "attended"].includes(b.status))
            .map((b: any) => ({
                bookingId: b.id,
                status: b.status,
                profileId: b.profiles?.id ?? "",
                full_name: b.profiles?.full_name ?? "Socio",
                avatar_url: b.profiles?.avatar_url ?? null,
                checked_in: checkedInUserIds.has(b.profiles?.id),
            })),
    }));

    return { classes: formatted };
}

// ─── Component ───────────────────────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function getClassStatus(cls: { start_time: string; end_time: string }) {
    const now = new Date();
    const start = new Date(cls.start_time);
    const end = new Date(cls.end_time);
    if (now >= start && now <= end) return "live";
    if (now > end) return "done";
    return "upcoming";
}

export default function StaffSchedule({ loaderData }: Route.ComponentProps) {
    const { classes } = loaderData;
    const [expanded, setExpanded] = useState<string | null>(null);

    if (classes.length === 0) {
        return (
            <div className="px-4 py-12 text-center">
                <Clock className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No hay clases programadas para hoy</p>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 space-y-3">
            <h1 className="text-white font-black text-xl mb-4">Clases de hoy</h1>

            {classes.map((cls) => {
                const status = getClassStatus(cls);
                const isFull = cls.current_enrolled >= cls.capacity;
                const isExpanded = expanded === cls.id;

                return (
                    <div
                        key={cls.id}
                        className={`rounded-2xl border transition-colors ${
                            status === "live"
                                ? "border-amber-500/60 bg-amber-900/20"
                                : status === "done"
                                ? "border-white/5 bg-white/[0.02] opacity-60"
                                : "border-white/10 bg-gray-900"
                        }`}
                    >
                        {/* Class header row */}
                        <button
                            onClick={() => setExpanded(isExpanded ? null : cls.id)}
                            className="w-full flex items-center gap-3 p-4 text-left"
                        >
                            {/* Time */}
                            <div className="text-center min-w-[3.5rem]">
                                <p className={`font-black text-sm ${status === "live" ? "text-amber-400" : "text-white"}`}>
                                    {formatTime(cls.start_time)}
                                </p>
                                {cls.end_time && (
                                    <p className="text-white/30 text-xs">{formatTime(cls.end_time)}</p>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-bold text-sm truncate">{cls.title}</p>
                                    {status === "live" && (
                                        <span className="text-xs bg-amber-400 text-black font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                            EN CURSO
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                                    {cls.coach_name && <span>{cls.coach_name}</span>}
                                    {cls.room_name && <span>· {cls.room_name}</span>}
                                </div>
                            </div>

                            {/* Occupancy */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Users className="w-4 h-4 text-white/30" />
                                <span className={`text-sm font-bold ${isFull ? "text-red-400" : "text-white/70"}`}>
                                    {cls.current_enrolled}/{cls.capacity}
                                </span>
                            </div>

                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                            )}
                        </button>

                        {/* Expanded attendee list */}
                        {isExpanded && (
                            <div className="border-t border-white/5 px-4 pb-4">
                                {cls.attendees.length === 0 ? (
                                    <p className="text-white/30 text-xs py-3 text-center">Sin reservas confirmadas</p>
                                ) : (
                                    <ul className="space-y-2 pt-3">
                                        {cls.attendees.map((att: any) => (
                                            <li key={att.bookingId} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                    {att.avatar_url ? (
                                                        <img src={att.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-white/30 text-xs font-bold">
                                                            {att.full_name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="flex-1 text-sm text-white/80 truncate">{att.full_name}</span>
                                                {att.checked_in ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                                                ) : (
                                                    <span className="w-5 h-5 rounded-full border-2 border-white/10 shrink-0" />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
