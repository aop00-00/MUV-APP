// app/routes/dashboard/schedule.tsx
// Monthly calendar view for class schedule.
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/schedule";
import { useFetcher, useRevalidator, useSearchParams } from "react-router";
import { useState, useMemo, useEffect } from "react";
import {
    Bell,
    Users,
    ChevronLeft,
    ChevronRight,
    X,
    MapPin,
    Clock,
    Dumbbell,
    LayoutGrid,
    Calendar as CalendarIcon,
    Sparkles,
    Ticket,
} from "lucide-react";
import { BookingConfirmationPopup } from "~/components/BookingConfirmationPopup";
import { ReadOnlySeatMap, type SeatResource } from "~/components/SeatMap";
import { useDashboardTheme } from "~/hooks/useDashboardTheme";

// ─── Types ────────────────────────────────────────────────────────
interface ClassWithSocial {
    id: string;
    title: string;
    description: string | null;
    coach_id: string;
    capacity: number;
    start_time: string;
    end_time: string;
    location: string | null;
    created_at: string;
    bookedCount: number;
    buddies: { name: string; avatar: string }[];
    type: string; // Changed from enum to string (dynamic type name)
}

interface GymClassType {
    id: string;
    name: string;
    color: string;
}

interface ScheduleEvent {
    id: string;
    name: string;
    date: string;       // YYYY-MM-DD
    time: string;       // HH:MM
    start_time: string; // ISO
    price: number;
    location: string;
    description: string;
    max_capacity: number;
    current_enrolled: number;
}

// ─── Color Helper ─────────────────────────────────────────────────
/** Generates Tailwind-compatible style objects from hex colors */
function getClassStyles(hex: string) {
    // Default fallback if hex is invalid
    const color = hex || "#7c3aed";
    return {
        bg: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.1)`,
        text: color,
        dot: color,
        border: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2)`,
        bgHover: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2)`,
    };
}

const DEFAULT_COLOR = "#7c3aed";

// ─── Calendar Helpers ─────────────────────────────────────────────
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

/** Monday-based: 0=Mon, 6=Sun */
function getStartDayOfWeek(year: number, month: number) {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
}

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// ─── Loader / Action ──────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAuth(request);
    const { getClassesForGym } = await import("~/services/booking.server");
    const { getGymClassTypes } = await import("~/services/room.server");
    const { getActiveEvents } = await import("~/services/event.server");

    const { requireAuth } = await import("~/services/auth.server");
    const profile = await requireAuth(request);

    const [rawClasses, classTypes, gymResult, rawEvents, membershipResult] = await Promise.all([
        getClassesForGym(gymId),
        getGymClassTypes(gymId),
        supabaseAdmin.from("gyms").select("brand_color, primary_color, studio_type, booking_mode").eq("id", gymId).single(),
        getActiveEvents(gymId),
        supabaseAdmin
            .from("memberships")
            .select("plan_type, end_date, credits_included")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
    ]);

    const classes: ClassWithSocial[] = rawClasses.map((slot) => ({
        id: slot.id,
        title: slot.title,
        description: slot.description,
        coach_id: slot.coach_id,
        capacity: slot.capacity,
        start_time: slot.start_time,
        end_time: slot.end_time,
        location: slot.location,
        created_at: (slot as any).created_at ?? new Date().toISOString(),
        bookedCount: slot.current_enrolled ?? 0,
        buddies: [],
        type: inferClassType(slot.title, classTypes),
    }));

    const events: ScheduleEvent[] = rawEvents.map(e => {
        const d = new Date(e.start_time);
        return {
            id: e.id,
            name: e.name,
            date: d.toISOString().split("T")[0],
            time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
            start_time: e.start_time,
            price: e.price,
            location: e.location,
            description: e.description,
            max_capacity: e.max_capacity,
            current_enrolled: e.current_enrolled,
        };
    });

    const activeMembership = membershipResult.data ?? null;

    return {
        classes,
        classTypes,
        events,
        gym: {
            brandColor: gymResult.data?.brand_color || gymResult.data?.primary_color || "#7c3aed",
            studioType: gymResult.data?.studio_type || null,
            bookingMode: gymResult.data?.booking_mode || "capacity_only",
        },
        membership: activeMembership ? {
            planType: (activeMembership.plan_type ?? "creditos") as "creditos" | "membresia" | "ilimitado",
            endDate: activeMembership.end_date,
            creditsIncluded: activeMembership.credits_included,
        } : null,
    };
}

/** Best-effort mapping of class title → matching Dynamic Type name */
function inferClassType(title: string, classTypes: GymClassType[]): string {
    const t = title.toLowerCase();
    const match = classTypes.find(ct => t.includes(ct.name.toLowerCase()));
    if (match) return match.name;
    // Default to first type or plain title
    return classTypes.length > 0 ? classTypes[0].name : title;
}

export async function action({ request }: Route.ActionArgs) {
    const { handleBookingAction } = await import("~/services/booking.server");
    return handleBookingAction(request);
}

// ─── Component ────────────────────────────────────────────────────
export default function Schedule({ loaderData }: Route.ComponentProps) {
    const { classes, classTypes, events = [], gym, membership } = loaderData as any;
    const gymContext = gym || { brandColor: "#7c3aed", studioType: null, bookingMode: "capacity_only" };
    const fetcher = useFetcher();
    const revalidator = useRevalidator();
    const today = new Date();
    const t = useDashboardTheme();
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
    const [searchParams] = useSearchParams();

    // Auto-open event from ?event=<id> query param (from packages success redirect)
    useEffect(() => {
        const eventId = searchParams.get("event");
        if (eventId && events.length > 0) {
            const target = events.find((e: ScheduleEvent) => e.id === eventId);
            if (target) setSelectedEvent(target);
        }
    }, [searchParams, events]);

    // Navigation & Filter state
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedClass, setSelectedClass] = useState<ClassWithSocial | null>(null);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [filterClasses, setFilterClasses] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<"week" | "month">("month");

    // Confirmation Popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState<{
        title: string;
        startTime: string;
        creditsRemaining: number | null;
        planType: "creditos" | "membresia" | "ilimitado";
    } | null>(null);

    // Monitor booking success
    useEffect(() => {
        if (fetcher.data && (fetcher.data as any).success && (fetcher.data as any).booking_id) {
            // Find the class that was recently booked
            const bookedClassId = (fetcher.data as any).class_id || selectedClass?.id;
            const bookedClass = classes.find((c: ClassWithSocial) => c.id === bookedClassId) || selectedClass;

            if (bookedClass) {
                const pt = (fetcher.data as any).plan_type ?? membership?.planType ?? "creditos";
                setConfirmedBooking({
                    title: bookedClass.title,
                    startTime: bookedClass.start_time,
                    creditsRemaining: pt === "creditos" ? ((fetcher.data as any).credits_remaining ?? 0) : null,
                    planType: pt,
                });
                setShowConfirmation(true);
                setSelectedClass(null); // Close detail modal
            }

            // Revalidate to fetch updated class enrollment
            revalidator.revalidate();
        }
    }, [fetcher.data, selectedClass, classes, revalidator]);

    const [viewWeekDate, setViewWeekDate] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(d.getFullYear(), d.getMonth(), diff);
    });

    const isCurrentWeek = () => {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), diff);
        return isSameDay(viewWeekDate, thisWeekStart);
    };

    function goPrevWeek() { setViewWeekDate(new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() - 7)); }
    function goNextWeek() { setViewWeekDate(new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + 7)); }
    function goTodayWeek() {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        setViewWeekDate(new Date(today.getFullYear(), today.getMonth(), diff));
    }

    // Navigate months
    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    }
    function goToday() {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
    }

    // Group classes by date key "YYYY-MM-DD"
    const classesByDate = useMemo(() => {
        const map = new Map<string, ClassWithSocial[]>();

        // Apply filter
        const displayedClasses = filterClasses.length > 0
            ? classes.filter((c: ClassWithSocial) => filterClasses.includes(c.type))
            : classes;

        for (const cls of displayedClasses) {
            const d = new Date(cls.start_time);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(cls);
        }
        // Sort each day's classes by start time
        for (const [, arr] of map) arr.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        return map;
    }, [classes, filterClasses]);

    // Group events by date key "YYYY-MM-DD"
    const eventsByDate = useMemo(() => {
        const map = new Map<string, ScheduleEvent[]>();
        for (const ev of events) {
            if (!map.has(ev.date)) map.set(ev.date, []);
            map.get(ev.date)!.push(ev);
        }
        return map;
    }, [events]);

    // Calendar grid data
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const startDow = getStartDayOfWeek(viewYear, viewMonth);
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    // Build cells: { date, isCurrentMonth }
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
        const dayNumber = i - startDow + 1;
        const date = new Date(viewYear, viewMonth, dayNumber);
        cells.push({ date, isCurrentMonth: dayNumber >= 1 && dayNumber <= daysInMonth });
    }

    function dateKey(d: Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    // Classes for the selected mobile day
    const selectedDayClasses = selectedDay ? classesByDate.get(dateKey(selectedDay)) ?? [] : [];

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className={`text-2xl font-bold ${t.title}`}>Agenda de Clases</h1>
                    <p className={`${t.muted} text-sm mt-0.5`}>
                        Selecciona una clase para ver detalles y reservar.
                    </p>
                </div>

                {/* View Controls & Date Nav */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* View Toggle */}
                    <div className={`flex ${t.track} p-1 rounded-lg`}>
                        <button
                            onClick={() => setViewMode("week")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "week" ? `${t.surface} ${t.title} shadow-sm` : `${t.muted}`}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode("month")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "month" ? `${t.surface} ${t.title} shadow-sm` : `${t.muted}`}`}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Mes
                        </button>
                    </div>

                    {/* Nav */}
                    {viewMode === "month" ? (
                        <div className="flex items-center gap-2">
                            {!isCurrentMonthView && (
                                <button
                                    onClick={goToday}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${t.border} ${t.muted} transition-colors`}
                                >
                                    Hoy
                                </button>
                            )}
                            <button onClick={prevMonth} className={`p-2 rounded-lg border ${t.border} ${t.muted} transition-colors`}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className={`text-sm font-semibold ${t.body} min-w-[140px] text-center`}>
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </span>
                            <button onClick={nextMonth} className={`p-2 rounded-lg border ${t.border} ${t.muted} transition-colors`}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {!isCurrentWeek() && (
                                <button
                                    onClick={goTodayWeek}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${t.border} ${t.muted} transition-colors`}
                                >
                                    Hoy
                                </button>
                            )}
                            <button onClick={goPrevWeek} className={`p-2 rounded-lg border ${t.border} ${t.muted} transition-colors`}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className={`text-sm font-semibold ${t.body} min-w-[140px] text-center`}>
                                {viewWeekDate.toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })} - {new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + 6).toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })}
                            </span>
                            <button onClick={goNextWeek} className={`p-2 rounded-lg border ${t.border} ${t.muted} transition-colors`}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-2 mb-2">
                <button
                    onClick={() => setFilterClasses([])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${filterClasses.length === 0
                        ? `${t.surface} ${t.border} ${t.title}`
                        : `${t.pill} ${t.border}`
                        }`}
                >
                    Todas
                </button>
                {classTypes.map((type: GymClassType) => {
                    const isSelected = filterClasses.includes(type.name);
                    const styles = getClassStyles(type.color);
                    return (
                        <button
                            key={type.id}
                            onClick={() => {
                                if (isSelected) {
                                    setFilterClasses(filterClasses.filter((t) => t !== type.name));
                                } else {
                                    setFilterClasses([...filterClasses, type.name]);
                                }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border`}
                            style={isSelected ? { backgroundColor: styles.bg, color: styles.text, borderColor: styles.border } : {}}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full`} style={{ backgroundColor: styles.dot }} />
                            {type.name}
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Calendar Grid (Month) ── */}
            {viewMode === "month" && (
                <div className="hidden md:block bg-white/5 border border-white/10 rounded-2xl shadow-sm overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-white/10">
                        {DAY_NAMES.map((d) => (
                            <div key={d} className="py-3 text-center text-xs font-semibold text-white/60 uppercase tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7">
                        {cells.map(({ date, isCurrentMonth }, idx) => {
                            const key = dateKey(date);
                            const dayClasses = classesByDate.get(key) ?? [];
                            const dayEvents = eventsByDate.get(key) ?? [];
                            const isToday = isSameDay(date, today);
                            const isPast = date < today && !isToday;

                            return (
                                <div
                                    key={idx}
                                    className={`min-h-[120px] border-b border-r border-white/5 p-1.5 transition-colors ${!isCurrentMonth ? "bg-white/5/60" : isPast ? "bg-white/5/30" : "bg-white/5"
                                        }`}
                                >
                                    {/* Day number */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full ${isToday
                                                ? "bg-blue-600 text-white"
                                                : !isCurrentMonth
                                                    ? "text-white/40"
                                                    : isPast
                                                        ? "text-white/50"
                                                        : "text-white/80"
                                                }`}
                                        >
                                            {date.getDate()}
                                        </span>
                                        {(dayClasses.length > 0 || dayEvents.length > 0) && (
                                            <span className="text-[10px] text-white/50 font-medium mr-1">
                                                {dayClasses.length > 0 && `${dayClasses.length} ${dayClasses.length === 1 ? "clase" : "clases"}`}
                                                {dayClasses.length > 0 && dayEvents.length > 0 && " · "}
                                                {dayEvents.length > 0 && `${dayEvents.length} ev.`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Class chips + Event chips */}
                                    <div className="space-y-0.5">
                                        {dayClasses.slice(0, 2).map((cls) => {
                                            const typeObj = classTypes.find((t: GymClassType) => t.name === cls.type);
                                            const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
                                            const isFull = cls.bookedCount >= cls.capacity;
                                            const time = new Date(cls.start_time).toLocaleTimeString("es-MX", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                            return (
                                                <button
                                                    key={cls.id}
                                                    onClick={() => setSelectedClass(cls)}
                                                    className={`w-full text-left px-1.5 py-1 rounded-md text-[11px] font-medium truncate border transition-all cursor-pointer ${isFull ? "opacity-60 line-through" : ""}`}
                                                    style={{ backgroundColor: styles.bg, color: styles.text, borderColor: styles.border }}
                                                    title={`${cls.title} — ${time}`}
                                                >
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1`} style={{ backgroundColor: styles.dot }} />
                                                    {time} {cls.title}
                                                    {isFull && (
                                                        <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 rounded no-underline">
                                                            LLENO
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}

                                        {/* Event chips — always visible */}
                                        {dayEvents.map((ev) => {
                                            const isFull = ev.current_enrolled >= ev.max_capacity;
                                            return (
                                                <button
                                                    key={ev.id}
                                                    onClick={() => setSelectedEvent(ev)}
                                                    className="w-full text-left px-1.5 py-1 rounded-md text-[11px] font-bold truncate border transition-all cursor-pointer bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/25"
                                                    title={`★ ${ev.name} — ${ev.time}`}
                                                >
                                                    <Sparkles className="inline w-2.5 h-2.5 mr-0.5 mb-0.5" />
                                                    {ev.time} {ev.name}
                                                    {isFull && (
                                                        <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded">LLENO</span>
                                                    )}
                                                </button>
                                            );
                                        })}

                                        {dayClasses.length > 2 && (
                                            <button
                                                onClick={() => setSelectedDay(date)}
                                                className="w-full text-left px-1.5 py-0.5 text-[10px] text-blue-400 font-medium hover:underline cursor-pointer"
                                            >
                                                +{dayClasses.length - 2} clase{dayClasses.length - 2 > 1 ? "s" : ""} más
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Desktop Calendar Grid (Week) ── */}
            {viewMode === "week" && (
                <div className="hidden md:block bg-white/5 border border-white/10 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Header row */}
                            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/10 bg-white/5">
                                <div className="p-2 text-xs text-white/50 font-medium text-center">Hora</div>
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + i);
                                    const isToday = isSameDay(d, today);
                                    return (
                                        <div key={i} className="p-2 text-center border-r border-white/10 flex flex-col items-center">
                                            <span className="text-[10px] text-white/60 uppercase font-semibold">{DAY_NAMES[i]}</span>
                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5 ${isToday ? "bg-blue-600 text-white" : "text-white"}`}>{d.getDate()}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Time rows - hardcode hours from 5 to 20 */}
                            {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => (
                                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/5 min-h-[48px]">
                                    <div className="p-2 text-[10px] text-white/50 font-medium text-right border-r border-white/10 flex items-start justify-end pt-1">
                                        {hour}:00
                                    </div>
                                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                                        const date = new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + dayIdx);
                                        const key = dateKey(date);
                                        const dayClasses = classesByDate.get(key) ?? [];
                                        const hourClasses = dayClasses.filter(c => new Date(c.start_time).getHours() === hour);
                                        const dayEvents = eventsByDate.get(key) ?? [];
                                        const hourEvents = dayEvents.filter(ev => {
                                            const h = parseInt(ev.time.split(":")[0], 10);
                                            return h === hour;
                                        });

                                        return (
                                            <div key={dayIdx} className="p-1 border-r border-white/5 relative">
                                                {hourClasses.map(cls => {
                                                    const typeObj = classTypes.find((t: GymClassType) => t.name === cls.type);
                                                    const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
                                                    const isFull = cls.bookedCount >= cls.capacity;
                                                    const duration = (new Date(cls.end_time).getTime() - new Date(cls.start_time).getTime()) / 60000;
                                                    return (
                                                        <button
                                                            key={cls.id}
                                                            onClick={() => setSelectedClass(cls)}
                                                            className={`w-full text-left p-1.5 mb-1 rounded-md text-[10px] font-medium transition-all shadow-sm`}
                                                            style={{
                                                                minHeight: `${Math.max(duration * 0.8, 30)}px`,
                                                                backgroundColor: styles.bg,
                                                                color: styles.text,
                                                                borderColor: styles.border
                                                            }}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="font-bold truncate">{cls.title}</div>
                                                                {isFull && <div className="text-[8px] bg-red-100 text-red-600 px-1 rounded truncate">LLENO</div>}
                                                            </div>
                                                            <div className="opacity-80 mt-0.5 flex justify-between items-center">
                                                                <span>{new Date(cls.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                                                                <span className="font-semibold">{cls.bookedCount}/{cls.capacity}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                {hourEvents.map(ev => {
                                                    const isFull = ev.current_enrolled >= ev.max_capacity;
                                                    return (
                                                        <button
                                                            key={ev.id}
                                                            onClick={() => setSelectedEvent(ev)}
                                                            className="w-full text-left p-1.5 mb-1 rounded-md text-[10px] font-bold transition-all shadow-sm bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30"
                                                            style={{ minHeight: "36px" }}
                                                        >
                                                            <div className="flex items-center gap-0.5 justify-between">
                                                                <div className="flex items-center gap-0.5 truncate">
                                                                    <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
                                                                    <span className="truncate">{ev.name}</span>
                                                                </div>
                                                                {isFull && <div className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded flex-shrink-0">LLENO</div>}
                                                            </div>
                                                            <div className="opacity-70 mt-0.5 flex justify-between">
                                                                <span>{ev.time}</span>
                                                                <span>{ev.current_enrolled}/{ev.max_capacity}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Calendar ── */}
            <div className="md:hidden space-y-3">

                {/* ── Mobile: WEEK view ── */}
                {viewMode === "week" && (
                    <div className={`${t.card} rounded-xl shadow-sm overflow-hidden`}>
                        {/* Week day headers */}
                        <div className="grid grid-cols-7 border-b border-white/10">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const d = new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + i);
                                const isToday = isSameDay(d, today);
                                const isSelected = selectedDay && isSameDay(d, selectedDay);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedDay(d)}
                                        className={`flex flex-col items-center py-2 gap-0.5 transition-colors ${isSelected ? "bg-blue-600" : isToday ? "bg-blue-500/20" : ""}`}
                                    >
                                        <span className={`text-[10px] font-semibold uppercase ${isSelected ? "text-white" : t.faint}`}>{DAY_NAMES[i]}</span>
                                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${isSelected ? "text-white" : isToday ? "text-blue-400" : t.title}`}>
                                            {d.getDate()}
                                        </span>
                                        {/* Dot indicators for classes and events */}
                                        {(() => {
                                            const key = dateKey(d);
                                            const classCount = classesByDate.get(key)?.length ?? 0;
                                            const eventCount = eventsByDate.get(key)?.length ?? 0;
                                            return (
                                                <div className="flex gap-0.5 justify-center">
                                                    {classCount > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-lime-400"}`} />}
                                                    {eventCount > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-violet-400"}`} />}
                                                    {classCount === 0 && eventCount === 0 && <span className="w-1.5 h-1.5" />}
                                                </div>
                                            );
                                        })()}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Classes + Events for selected day in week view */}
                        <div className="p-3 space-y-2">
                            {selectedDay ? (
                                <>
                                    <h3 className={`text-xs font-semibold ${t.muted} uppercase tracking-wider`}>
                                        {selectedDay.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                                    </h3>
                                    {/* Events first */}
                                    {(eventsByDate.get(dateKey(selectedDay)) ?? []).map((ev) => (
                                        <MobileEventCard key={ev.id} event={ev} onSelect={() => setSelectedEvent(ev)} t={t} />
                                    ))}
                                    {selectedDayClasses.length === 0 && (eventsByDate.get(dateKey(selectedDay)) ?? []).length === 0 ? (
                                        <p className={`text-sm ${t.muted} py-4 text-center`}>No hay clases ni eventos este día.</p>
                                    ) : (
                                        selectedDayClasses.map((cls) => (
                                            <MobileClassCard key={cls.id} cls={cls} onSelect={() => setSelectedClass(cls)} classTypes={classTypes} t={t} />
                                        ))
                                    )}
                                </>
                            ) : (
                                <p className={`text-center text-sm ${t.muted} py-4`}>Toca un día para ver clases.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Mobile: MONTH view ── */}
                {viewMode === "month" && (
                    <>
                        {/* Compact mini-calendar */}
                        <div className={`${t.card} rounded-xl shadow-sm p-3`}>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {DAY_NAMES.map((d) => (
                                    <div key={d} className={`text-center text-[10px] font-semibold ${t.label} uppercase`}>
                                        {d.charAt(0)}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {cells.map(({ date, isCurrentMonth }, idx) => {
                                    const key = dateKey(date);
                                    const dayClasses = classesByDate.get(key) ?? [];
                                    const isToday = isSameDay(date, today);
                                    const isSelected = selectedDay && isSameDay(date, selectedDay);

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedDay(date)}
                                            className={`relative flex flex-col items-center justify-center p-1.5 rounded-lg text-xs transition-all ${isSelected
                                                ? "bg-blue-600 text-white"
                                                : isToday
                                                    ? "bg-blue-100 text-blue-700 font-bold"
                                                    : !isCurrentMonth
                                                        ? t.faint
                                                        : `${t.dayText} hover:bg-black/5`
                                                }`}
                                        >
                                            {date.getDate()}
                                            {dayClasses.length > 0 && (
                                                <div className="flex gap-0.5 mt-0.5">
                                                    {dayClasses.slice(0, 3).map((cls) => {
                                                        const typeObj = classTypes.find((tp: GymClassType) => tp.name === cls.type);
                                                        const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
                                                        return (
                                                            <span
                                                                key={cls.id}
                                                                className="w-1 h-1 rounded-full"
                                                                style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : styles.dot }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected day list */}
                        {selectedDay && (
                            <div className="space-y-2">
                                <h3 className={`text-sm font-semibold ${t.body}`}>
                                    {selectedDay.toLocaleDateString("es-MX", {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                    })}
                                </h3>
                                {/* Events first */}
                                {(eventsByDate.get(dateKey(selectedDay)) ?? []).map((ev) => (
                                    <MobileEventCard key={ev.id} event={ev} onSelect={() => setSelectedEvent(ev)} t={t} />
                                ))}
                                {selectedDayClasses.length === 0 && (eventsByDate.get(dateKey(selectedDay)) ?? []).length === 0 ? (
                                    <p className={`text-sm ${t.muted} py-6 text-center`}>No hay clases ni eventos este día.</p>
                                ) : (
                                    selectedDayClasses.map((cls) => (
                                        <MobileClassCard key={cls.id} cls={cls} onSelect={() => setSelectedClass(cls)} classTypes={classTypes} t={t} />
                                    ))
                                )}
                            </div>
                        )}

                        {!selectedDay && (
                            <p className={`text-center text-sm ${t.muted} py-4`}>Toca un día para ver clases.</p>
                        )}
                    </>
                )}
            </div>

            {/* ── Class Detail Modal ── */}
            {selectedClass && (
                <ClassDetailModal
                    cls={selectedClass}
                    onClose={() => setSelectedClass(null)}
                    fetcher={fetcher}
                    gym={gymContext}
                    classTypes={classTypes}
                />
            )}

            {/* ── Day Detail Modal (for "+N más" on desktop) ── */}
            {selectedDay && !selectedClass && (
                <DayDetailModal
                    day={selectedDay}
                    classes={classesByDate.get(dateKey(selectedDay)) ?? []}
                    onClose={() => setSelectedDay(null)}
                    onSelectClass={(cls) => setSelectedClass(cls)}
                    isMobile={false}
                    classTypes={classTypes}
                />
            )}

            {/* ── Booking Confirmation Popup ── */}
            {confirmedBooking && (
                <BookingConfirmationPopup
                    isOpen={showConfirmation}
                    onClose={() => setShowConfirmation(false)}
                    classTitle={confirmedBooking.title}
                    startTime={confirmedBooking.startTime}
                    creditsRemaining={confirmedBooking.creditsRemaining}
                    planType={confirmedBooking.planType}
                />
            )}

            {/* ── Event Detail Modal ── */}
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    brandColor={gymContext.brandColor}
                />
            )}
        </div>
    );
}

// ─── Mobile Class Card ────────────────────────────────────────────
function MobileClassCard({ cls, onSelect, classTypes, t }: { cls: ClassWithSocial; onSelect: () => void; classTypes: GymClassType[]; t: import("~/hooks/useDashboardTheme").ThemeTokens }) {
    const typeObj = classTypes?.find((tp: GymClassType) => tp.name === cls.type);
    const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
    const isFull = cls.bookedCount >= cls.capacity;
    const spotsLeft = cls.capacity - cls.bookedCount;
    const time = new Date(cls.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const endTime = new Date(cls.end_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left ${t.card} rounded-xl p-4 shadow-sm transition-all active:scale-[0.98] ${isFull ? "border-red-500/50 opacity-70" : "hover:shadow-md"}`}
            style={!isFull ? { borderColor: styles.border } : {}}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: styles.dot }} />
                        <p className={`font-semibold ${t.title} text-sm truncate`}>{cls.title}</p>
                        {isFull && (
                            <span className="text-[10px] bg-red-100/10 text-red-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                LLENO
                            </span>
                        )}
                    </div>
                    <div className={`flex items-center gap-3 mt-1.5 text-xs ${t.muted}`}>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {time} – {endTime}
                        </span>
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {cls.location}
                        </span>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-medium ${isFull ? "text-red-500" : spotsLeft <= 5 ? "text-amber-500" : t.muted}`}>
                        {cls.bookedCount}/{cls.capacity}
                    </span>
                </div>
            </div>

            {cls.buddies.length > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                    <div className="flex -space-x-1">
                        {cls.buddies.slice(0, 3).map((b, i) => (
                            <div
                                key={i}
                                className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[10px]"
                            >
                                {b.avatar}
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-blue-600 font-medium">
                        {cls.buddies.length <= 2
                            ? cls.buddies.map((b) => b.name).join(", ")
                            : `${cls.buddies[0].name} y ${cls.buddies.length - 1} más`}
                    </p>
                </div>
            )}
        </button>
    );
}

// ─── Class Detail Modal ───────────────────────────────────────────
function ClassDetailModal({
    cls,
    onClose,
    fetcher,
    gym,
    classTypes,
}: {
    cls: ClassWithSocial;
    onClose: () => void;
    fetcher: ReturnType<typeof useFetcher>;
    gym: { brandColor: string; studioType: string | null; bookingMode: string };
    classTypes: GymClassType[];
}) {
    const typeObj = classTypes.find((t: GymClassType) => t.name === cls.type);
    const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
    const isFull = cls.bookedCount >= cls.capacity;
    const spotsLeft = cls.capacity - cls.bookedCount;
    const startDate = new Date(cls.start_time);
    const endDate = new Date(cls.end_time);

    // Seat map state — only if booking mode requires resource selection
    const needsSeatMap = gym.bookingMode === "assigned_resource";
    const [resources, setResources] = useState<SeatResource[]>([]);
    const [bookedIds, setBookedIds] = useState<string[]>([]);
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
    const [loadingSeats, setLoadingSeats] = useState(false);

    useEffect(() => {
        if (!needsSeatMap) return;
        setLoadingSeats(true);
        fetch(`/api/resources?classId=${cls.id}`)
            .then(r => r.json())
            .then(data => {
                setResources(data.resources || []);
                setBookedIds(data.bookedIds || []);
            })
            .catch(console.error)
            .finally(() => setLoadingSeats(false));
    }, [cls.id, needsSeatMap]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pb-20 md:pb-0"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Panel — flex column so footer stays visible and body scrolls */}
            <div
                className="relative w-full md:max-w-md bg-gray-950 md:rounded-2xl rounded-t-2xl shadow-2xl border border-white/10 animate-slide-up flex flex-col"
                style={{ maxHeight: "min(88dvh, 88vh)" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header band + sticky header */}
                <div className="shrink-0">
                    <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: styles.dot }} />
                    <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: styles.bg }}>
                            <Dumbbell className="w-5 h-5" style={{ color: styles.text }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white leading-tight">{cls.title}</h2>
                            <span className="inline-flex items-center gap-1 text-xs font-medium mt-0.5" style={{ color: styles.text }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: styles.dot }} />
                                {cls.type}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/50 transition-colors shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <InfoBlock
                            icon={<Clock className="w-4 h-4 text-white/50" />}
                            label="Horario"
                            value={`${startDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
                        />
                        <InfoBlock
                            icon={<MapPin className="w-4 h-4 text-white/50" />}
                            label="Ubicación"
                            value={cls.location ?? "Sin ubicación"}
                        />
                        <InfoBlock
                            icon={<Users className="w-4 h-4 text-white/50" />}
                            label="Capacidad"
                            value={
                                <span className={isFull ? "text-red-500 font-semibold" : ""}>
                                    {cls.bookedCount}/{cls.capacity} cupos
                                    {!isFull && spotsLeft <= 5 && (
                                        <span className="text-amber-500 text-[10px] ml-1">(¡{spotsLeft} quedan!)</span>
                                    )}
                                </span>
                            }
                        />
                        <InfoBlock
                            icon={<Calendar className="w-4 h-4 text-white/50" />}
                            label="Fecha"
                            value={startDate.toLocaleDateString("es-MX", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                            })}
                        />
                    </div>

                    {/* Description */}
                    {cls.description && (
                        <p className="text-sm text-white/60 leading-relaxed">{cls.description}</p>
                    )}

                    {/* Buddies */}
                    {cls.buddies.length > 0 && (
                        <div className="flex items-center gap-2 py-3 px-3 bg-blue-50/60 rounded-xl">
                            <div className="flex -space-x-1.5">
                                {cls.buddies.slice(0, 4).map((b, i) => (
                                    <div
                                        key={i}
                                        className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-sm"
                                        title={b.name}
                                    >
                                        {b.avatar}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-blue-600 font-medium">
                                <Users className="w-3 h-3 inline mr-0.5" />
                                {cls.buddies.length <= 3
                                    ? cls.buddies.map((b) => b.name).join(", ")
                                    : `${cls.buddies[0].name} y ${cls.buddies.length - 1} más`}{" "}
                                {cls.buddies.length === 1 ? "va" : "van"} a ir
                            </p>
                        </div>
                    )}

                    {/* Seat map — shown for equipment-limited studios */}
                    {needsSeatMap && (
                        <div>
                            {loadingSeats ? (
                                <p className="text-xs text-white/50 text-center py-4">Cargando mapa de lugares...</p>
                            ) : resources.length > 0 ? (
                                <ReadOnlySeatMap
                                    resources={resources}
                                    bookedIds={bookedIds}
                                    selectedId={selectedResourceId}
                                    onSelect={setSelectedResourceId}
                                    brandColor={gym.brandColor}
                                    studioType={gym.studioType}
                                />
                            ) : (
                                <p className="text-xs text-white/50 text-center py-2 italic">Sin mapa de lugares para esta sala.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Sticky footer — action button always visible */}
                <div className="shrink-0 px-4 pb-4 pt-3 border-t border-white/[0.06] bg-gray-950">
                    <fetcher.Form method="post">
                        <input type="hidden" name="classId" value={cls.id} />
                        {needsSeatMap && selectedResourceId && (
                            <input type="hidden" name="resource_id" value={selectedResourceId} />
                        )}
                        {isFull ? (
                            <>
                                <input type="hidden" name="intent" value="waitlist" />
                                <button
                                    type="submit"
                                    disabled={fetcher.state !== "idle"}
                                    className="w-full px-5 py-3.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Bell className="w-4 h-4" />
                                    {fetcher.state !== "idle" ? "Registrando…" : "Avisarme cuando haya cupo"}
                                </button>
                            </>
                        ) : (
                            <>
                                <input type="hidden" name="intent" value="book" />
                                <button
                                    type="submit"
                                    disabled={fetcher.state !== "idle" || (needsSeatMap && resources.length > 0 && !selectedResourceId)}
                                    className="w-full px-5 py-3.5 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
                                    style={{ backgroundColor: gym.brandColor }}
                                >
                                    {fetcher.state !== "idle"
                                        ? "Reservando…"
                                        : needsSeatMap && resources.length > 0 && !selectedResourceId
                                            ? "Elige tu lugar primero"
                                            : "Reservar clase (1 crédito)"}
                                </button>
                            </>
                        )}
                    </fetcher.Form>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slideUp 0.3s ease-out; }
            `}</style>
        </div>
    );
}

function Calendar({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    );
}

// ─── Info Block ───────────────────────────────────────────────────
function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-1.5 bg-white/5 rounded-lg p-2">
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] text-white/50 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-[11px] text-white/80 font-medium mt-0.5 leading-tight">{value}</p>
            </div>
        </div>
    );
}

// ─── Day Detail Modal (desktop "+N más") ──────────────────────────
function DayDetailModal({
    day,
    classes,
    onClose,
    onSelectClass,
    isMobile,
    classTypes,
}: {
    day: Date;
    classes: ClassWithSocial[];
    onClose: () => void;
    onSelectClass: (cls: ClassWithSocial) => void;
    isMobile: boolean;
    classTypes: GymClassType[];
}) {
    if (isMobile || classes.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 hidden md:flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
                className="relative bg-white/5 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white">
                            {day.toLocaleDateString("es-MX", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white/50">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {classes.map((cls) => {
                            const typeObj = classTypes.find((t: GymClassType) => t.name === cls.type);
                            const styles = getClassStyles(typeObj?.color || DEFAULT_COLOR);
                            const isFull = cls.bookedCount >= cls.capacity;
                            const time = new Date(cls.start_time).toLocaleTimeString("es-MX", {
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                            return (
                                <button
                                    key={cls.id}
                                    onClick={() => onSelectClass(cls)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm`}
                                    style={{ backgroundColor: styles.bg, borderColor: styles.border }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: styles.dot }} />
                                            <span className={`text-sm font-semibold`} style={{ color: styles.text }}>{cls.title}</span>
                                        </div>
                                        {isFull && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                                LLENO
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                                        <span>{time}</span>
                                        <span>📍 {cls.location}</span>
                                        <span>{cls.bookedCount}/{cls.capacity}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.25s ease-out;
                }
            `}</style>
        </div>
    );
}

// ─── Mobile Event Card ────────────────────────────────────────────
function MobileEventCard({ event: ev, onSelect, t }: { event: ScheduleEvent; onSelect: () => void; t: import("~/hooks/useDashboardTheme").ThemeTokens }) {
    const isFull = ev.current_enrolled >= ev.max_capacity;
    const spots = ev.max_capacity - ev.current_enrolled;
    return (
        <button
            onClick={onSelect}
            className="w-full text-left rounded-xl p-4 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 transition-all active:scale-[0.98]"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                        <p className="font-bold text-violet-200 text-sm truncate">{ev.name}</p>
                        {isFull && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">LLENO</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-violet-300/70">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ev.time} hrs</span>
                        {ev.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.location}</span>}
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-white">{ev.price === 0 ? "Gratis" : `$${ev.price.toLocaleString("es-MX")}`}</p>
                    {!isFull && <p className="text-[10px] text-violet-300/60">{spots} lugar{spots !== 1 ? "es" : ""}</p>}
                </div>
            </div>
        </button>
    );
}

// ─── Event Detail Modal ───────────────────────────────────────────
function EventDetailModal({ event: ev, onClose, brandColor }: { event: ScheduleEvent; onClose: () => void; brandColor: string }) {
    const isFull = ev.current_enrolled >= ev.max_capacity;
    const spots = ev.max_capacity - ev.current_enrolled;
    const pct = Math.min(100, Math.round((ev.current_enrolled / ev.max_capacity) * 100));
    const dateLabel = new Date(ev.start_time).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pb-20 md:pb-0" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full md:max-w-md bg-gray-950 md:rounded-2xl rounded-t-2xl shadow-2xl border border-white/10 animate-slide-up overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.05))" }}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-violet-400" />
                                <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Evento Exclusivo</span>
                            </div>
                            <h2 className="text-xl font-black text-white leading-tight">{ev.name}</h2>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/40 flex-shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {ev.description && (
                        <p className="text-sm text-white/70 leading-relaxed">{ev.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-white/60">
                            <CalendarIcon className="w-4 h-4 text-violet-400" />
                            <span className="capitalize">{dateLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60">
                            <Clock className="w-4 h-4 text-violet-400" />
                            <span>{ev.time} hrs</span>
                        </div>
                        {ev.location && (
                            <div className="flex items-center gap-2 text-white/60 col-span-2">
                                <MapPin className="w-4 h-4 text-violet-400" />
                                <span>{ev.location}</span>
                            </div>
                        )}
                    </div>

                    {/* Occupancy */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-white/50">
                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {ev.current_enrolled}/{ev.max_capacity} inscritos</span>
                            {isFull ? (
                                <span className="text-red-400 font-semibold">¡Lleno!</span>
                            ) : (
                                <span className="text-violet-300">{spots} lugar{spots !== 1 ? "es" : ""} disponible{spots !== 1 ? "s" : ""}</span>
                            )}
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-violet-500"}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div>
                            <p className="text-2xl font-black text-white">
                                {ev.price === 0 ? "Gratis" : `$${ev.price.toLocaleString("es-MX")}`}
                                {ev.price > 0 && <span className="text-sm font-normal text-white/40 ml-1">MXN</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="px-5 pb-5">
                    <a
                        href="/dashboard/packages"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                        style={{ backgroundColor: "#7c3aed" }}
                        onClick={onClose}
                    >
                        <Ticket className="w-4 h-4" />
                        {isFull ? "Ver otros eventos" : "Inscribirme a este evento"}
                    </a>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slideUp 0.25s ease-out; }
            `}</style>
        </div>
    );
}
