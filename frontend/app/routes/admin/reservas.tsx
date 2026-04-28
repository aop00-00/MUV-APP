// admin/reservas.tsx — Attendance management and waitlist for sessions (Supabase)
import type { Route } from "./+types/reservas";
import { useFetcher } from "react-router";
import { useState } from "react";
import { Check, X, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface Attendee {
    id: string;
    full_name: string;
    email: string;
    status: "confirmed" | "completed" | "cancelled" | "waitlist";
}
interface SessionReserva {
    id: string;
    title: string;
    coach_name: string;
    start_time: string;
    capacity: number;
    attendees: Attendee[];
}

const STATUS_CFG: Record<Attendee["status"], { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    confirmed: { label: "Confirmada", bg: "bg-blue-100", text: "text-blue-700", icon: <Clock className="w-3 h-3" /> },
    completed: { label: "Asistió", bg: "bg-green-100", text: "text-green-700", icon: <Check className="w-3 h-3" /> },
    cancelled: { label: "No asistió", bg: "bg-red-100", text: "text-red-700", icon: <X className="w-3 h-3" /> },
    waitlist: { label: "En espera", bg: "bg-amber-100", text: "text-amber-700", icon: <Users className="w-3 h-3" /> },
};

// ─── Loader ─────────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);

    const { getClassesForGym } = await import("~/services/booking.server");
    const rawClasses = await getClassesForGym(gymId);

    const classIds = rawClasses.map(c => c.id);

    // Fetch all bookings and waitlist in 2 bulk queries instead of N
    const [{ data: allBookings }, { data: allWaitlist }] = await Promise.all([
        classIds.length > 0
            ? supabaseAdmin
                .from("bookings")
                .select("id, class_id, status, user_id, profiles(full_name, email)")
                .in("class_id", classIds)
            : Promise.resolve({ data: [] }),
        classIds.length > 0
            ? supabaseAdmin
                .from("waitlist")
                .select("id, class_id, user_id, position, profiles(full_name, email)")
                .in("class_id", classIds)
                .order("position", { ascending: true })
            : Promise.resolve({ data: [] }),
    ]);

    const sessions: SessionReserva[] = rawClasses.map(cls => {
        const bookings = (allBookings ?? []).filter((b: any) => b.class_id === cls.id);
        const waitlist = (allWaitlist ?? []).filter((w: any) => w.class_id === cls.id);

        const attendees: Attendee[] = [
            ...bookings.map((b: any) => ({
                id: b.id,
                full_name: b.profiles?.full_name ?? "Sin nombre",
                email: b.profiles?.email ?? "",
                status: b.status as Attendee["status"],
            })),
            ...waitlist.map((w: any) => ({
                id: w.id,
                full_name: w.profiles?.full_name ?? "Sin nombre",
                email: w.profiles?.email ?? "",
                status: "waitlist" as const,
            })),
        ];

        return {
            id: cls.id,
            title: cls.title,
            coach_name: (cls as any).coach_name ?? (cls as any).coach?.name ?? "Sin coach",
            start_time: cls.start_time,
            capacity: cls.capacity,
            attendees,
        };
    });

    return { sessions };
}

// ─── Action ─────────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const bookingId = formData.get("booking_id") as string;

    if (intent === "mark_completed") {
        await supabaseAdmin.from("bookings").update({ status: "completed" }).eq("id", bookingId);
    }
    if (intent === "mark_cancelled") {
        await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    }
    if (intent === "confirm_waitlist") {
        // Move from waitlist to booking
        const { data: wl } = await supabaseAdmin.from("waitlist").select("user_id, class_id").eq("id", bookingId).single();
        if (wl) {
            await supabaseAdmin.from("bookings").insert({ user_id: wl.user_id, class_id: wl.class_id, status: "confirmed", gym_id: gymId });
            await supabaseAdmin.from("waitlist").delete().eq("id", bookingId);
        }
    }

    return { success: true };
}

// ─── Helpers ────────────────────────────────────────────────────────
function toLocalDateString(date: Date) {
    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

function isSameLocalDay(isoString: string, dateStr: string) {
    // Compare the date portion of the ISO string (which is stored in local-ish time)
    // with the YYYY-MM-DD string the user selected.
    return isoString.slice(0, 10) === dateStr;
}

// ─── Component ──────────────────────────────────────────────────────
export default function Reservas({ loaderData }: Route.ComponentProps) {
    const { sessions: allSessions } = loaderData;
    const fetcher = useFetcher();

    const today = new Date();
    const [dateStr, setDateStr] = useState<string>(toLocalDateString(today));
    const [selected, setSelected] = useState<string>("");

    // Filter sessions by selected date entirely in client — no UTC offset issues
    const sessions = allSessions.filter(s => isSameLocalDay(s.start_time, dateStr));

    const currentDate = new Date(`${dateStr}T12:00:00`);
    const isToday = dateStr === toLocalDateString(today);
    const dateLabel = currentDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

    function goDate(offset: number) {
        const d = new Date(`${dateStr}T12:00:00`);
        d.setDate(d.getDate() + offset);
        setDateStr(toLocalDateString(d));
        setSelected("");
    }

    const session = sessions.find(s => s.id === selected) ?? sessions[0] ?? null;
    const confirmed = session ? session.attendees.filter(a => a.status !== "waitlist").length : 0;

    const DateNav = () => (
        <div className="flex items-center gap-2">
            <button onClick={() => goDate(-1)} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[160px]">
                <p className="text-sm font-bold text-white capitalize">{dateLabel}</p>
                {isToday && <p className="text-xs text-amber-400 font-semibold">Hoy</p>}
            </div>
            <button onClick={() => goDate(1)} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors">
                <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday && (
                <button onClick={() => { setDateStr(toLocalDateString(today)); setSelected(""); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors">
                    Hoy
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Reservas</h1>
                    <p className="text-white/50 text-sm mt-0.5">Control de asistencia y listas de espera por sesión.</p>
                </div>
                <DateNav />
            </div>

            {sessions.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin sesiones este día</h2>
                    <p className="text-white/50 text-sm max-w-sm mx-auto">No hay clases programadas para esta fecha. Usa las flechas para navegar a otro día.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Session selector */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Sesiones del día</p>
                    {sessions.map(s => {
                        const enrolled = s.attendees.filter(a => a.status !== "waitlist").length;
                        const isActive = s.id === selected;
                        const time = new Date(s.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                        return (
                            <button key={s.id} onClick={() => setSelected(s.id)} className={`w-full text-left p-4 rounded-xl border transition-all ${isActive ? "border-amber-400 bg-amber-500/10" : "border-white/[0.08] bg-white/5 hover:border-white/10"}`}>
                                <p className={`font-bold text-sm ${isActive ? "text-amber-400" : "text-white"}`}>{s.title}</p>
                                <p className="text-xs text-white/50 mt-0.5">{time} · {s.coach_name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full">
                                        <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (enrolled / s.capacity) * 100)}%` }} />
                                    </div>
                                    <span className="text-xs text-white/50">{enrolled}/{s.capacity}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Attendance list */}
                {session && (
                    <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="font-black text-white">{session.title}</h2>
                                <p className="text-sm text-white/50">
                                    {new Date(session.start_time).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {new Date(session.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {session.coach_name}
                                </p>
                            </div>
                            <span className="text-sm font-bold text-white/50">{confirmed}/{session.capacity} lugares</span>
                        </div>
                        {session.attendees.length === 0 ? (
                            <div className="p-8 text-center text-white/40 text-sm">Sin reservas para esta sesión.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {session.attendees.map(a => {
                                    const cfg = STATUS_CFG[a.status];
                                    return (
                                        <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-white text-sm">{a.full_name}</p>
                                                <p className="text-xs text-white/40">{a.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>
                                                    {cfg.icon}{cfg.label}
                                                </span>
                                                {a.status === "confirmed" && (
                                                    <div className="flex gap-1">
                                                        <fetcher.Form method="post" className="inline">
                                                            <input type="hidden" name="intent" value="mark_completed" />
                                                            <input type="hidden" name="booking_id" value={a.id} />
                                                            <button type="submit" className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors">
                                                                <Check className="w-3.5 h-3.5 text-green-700" />
                                                            </button>
                                                        </fetcher.Form>
                                                        <fetcher.Form method="post" className="inline">
                                                            <input type="hidden" name="intent" value="mark_cancelled" />
                                                            <input type="hidden" name="booking_id" value={a.id} />
                                                            <button type="submit" className="p-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
                                                                <X className="w-3.5 h-3.5 text-red-700" />
                                                            </button>
                                                        </fetcher.Form>
                                                    </div>
                                                )}
                                                {a.status === "waitlist" && (
                                                    <fetcher.Form method="post" className="inline">
                                                        <input type="hidden" name="intent" value="confirm_waitlist" />
                                                        <input type="hidden" name="booking_id" value={a.id} />
                                                        <button type="submit" className="text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                                            Confirmar lugar
                                                        </button>
                                                    </fetcher.Form>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
