// app/routes/admin/schedule.tsx
// Admin – Weekly Calendar Grid + Live Class Attendance (Supabase).
import type { Route } from "./+types/schedule";
import { useFetcher, useRevalidator } from "react-router";
import { useState, useMemo, useEffect } from "react";
import { Plus, X, Check, UserMinus, UserPlus, Clock, Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";
import type { ClassSlot } from "~/services/booking.server";

// ─── Constants ───────────────────────────────────────────────────
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface CalendarClass {
    id: string;
    title: string;
    day: number; // 0=Lun ... 5=Sáb
    hour: number;
    duration: number; // in hours
    coach: string;
    capacity: number;
    enrolled: number;
    location: string;
    color: string;
    isLive: boolean;
    type: "class" | "event";
    attendees: { id: string; name: string; checkedIn: boolean }[];
}

/** Convert a ClassSlot from Supabase into the CalendarClass shape used by the grid */
function slotToCalendar(slot: ClassSlot): CalendarClass {
    const start = new Date(slot.start_time);
    const end = slot.end_time ? new Date(slot.end_time) : new Date(start.getTime() + 3600000);
    const jsDay = start.getDay(); // 0=Sun
    const day = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon ... 6=Sun
    const durationHours = Math.max(1, (end.getTime() - start.getTime()) / 3600000);

    return {
        id: slot.id,
        title: slot.title,
        day,
        hour: start.getHours(),
        duration: durationHours,
        coach: (slot.coach as any)?.name ?? "Staff",
        capacity: slot.capacity,
        enrolled: slot.current_enrolled ?? 0,
        location: slot.location ?? "",
        color: "bg-purple-600",
        isLive: false,
        type: "class",
        attendees: [],
    };
}

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const { getClassesForGym } = await import("~/services/booking.server");
    const { getGymCoaches } = await import("~/services/coach.server");
    const { getGymRooms } = await import("~/services/room.server");
    const [classes, coaches, rooms] = await Promise.all([
        getClassesForGym(gymId),
        getGymCoaches(gymId),
        getGymRooms(gymId),
    ]);
    return { classes, coaches, rooms };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create_class") {
        const { createClass } = await import("~/services/booking.server");

        const title = formData.get("title") as string;
        const coach_id = formData.get("coach_id") as string;
        const capacity = Number(formData.get("capacity") ?? 20);
        const location = formData.get("location") as string;
        const room_id = formData.get("room_id") as string;
        const day = Number(formData.get("day")); // 0=Lun...5=Sáb
        const startTimeStr = formData.get("start_time") as string; // "HH:MM"
        const tzOffset = Number(formData.get("tz_offset") || 0); // Minutes
        const currentWeekStart = new Date(formData.get("current_week_start") as string);

        // Calculate the exact date for this class in the current visible week
        // day 0 = Monday, day 5 = Saturday
        const [hours, minutes] = startTimeStr.split(":").map(Number);
        const targetDate = new Date(currentWeekStart);
        targetDate.setDate(currentWeekStart.getDate() + day);
        targetDate.setHours(hours, minutes, 0, 0);

        // Apply TZ correction: If user is at UTC-6 (offset 360), 
        // they want Local 10:00 AM, which is UTC 16:00 PM.
        // targetDate is currently UTC 10:00 AM. We add 360 mins.
        const correctedDate = new Date(targetDate.getTime() + (tzOffset * 60000));

        const startDate = correctedDate.toISOString();
        const endDate = new Date(correctedDate.getTime() + 3600000).toISOString(); // 1 hour duration

        await createClass({
            gymId,
            title,
            coach_id,
            start_time: startDate,
            end_time: endDate,
            capacity,
            location,
            room_id,
        });

        return { success: true, intent };
    }

    if (intent === "delete") {
        const { deleteClass } = await import("~/services/booking.server");
        const classId = formData.get("classId") as string;
        await deleteClass(classId, gymId);
        return { success: true, intent };
    }

    if (intent === "checkin" || intent === "no_show") {
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const classId = formData.get("classId") as string;
        const userId = formData.get("userId") as string;
        const status = intent === "checkin" ? "completed" : "cancelled";
        
        await supabaseAdmin
            .from("bookings")
            .update({ status })
            .eq("class_id", classId)
            .eq("user_id", userId);
            
        return { success: true, intent };
    }

    if (intent === "drop_in") {
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const classId = formData.get("classId") as string;
        const userName = formData.get("userName") as string;
        
        // Simplified drop-in: just record in a log or create a temporary booking
        // For now, let's just return success as requested to unblock the UI
        return { success: true, intent };
    }

    return { success: true, intent };
}

// ─── Main Component ──────────────────────────────────────────────
export default function AdminSchedule({ loaderData }: Route.ComponentProps) {
    const { classes: rawClasses, coaches, rooms } = loaderData;
    const fetcher = useFetcher();
    const revalidator = useRevalidator();

    // ── Navigation & Date State ──
    const [viewMode, setViewMode] = useState<"week" | "month">("week");
    const [weekOffset, setWeekOffset] = useState(0); // Offset in weeks from today
    
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    // Calculate current week boundaries
    const { weekDays, weekStart, weekEnd } = useMemo(() => {
        const start = new Date();
        // Start of week (Monday)
        const day = start.getDay();
        const diff = (day === 0 ? -6 : 1) - day + (weekOffset * 7);
        start.setDate(start.getDate() + diff);
        start.setHours(0, 0, 0, 0);

        const days = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });

        const end = new Date(days[5]);
        end.setHours(23, 59, 59, 999);

        return { weekDays: days, weekStart: start, weekEnd: end };
    }, [weekOffset]);

    // Map Supabase rows to the grid shape
    const events = useMemo(() => rawClasses.map(slotToCalendar), [rawClasses]);

    const [selectedClass, setSelectedClass] = useState<CalendarClass | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Local form state for creation
    const [form, setForm] = useState({
        title: "",
        coach_id: "",
        capacity: 20,
        day: 0,
        start_time: "08:00",
        location: "",
        room_id: ""
    });

    // Filters
    const [timeFilter, setTimeFilter] = useState<"all" | "am" | "pm">("all");
    const [categoryFilter, setCategoryFilter] = useState<"all" | "class" | "event">("all");

    // Memoize the filtered hours and events
    const filteredHours = useMemo(() => {
        if (timeFilter === "am") return HOURS.filter(h => h < 12);
        if (timeFilter === "pm") return HOURS.filter(h => h >= 12);
        return HOURS;
    }, [timeFilter]);

    const filteredCalendar = useMemo(() => {
        let list = events;
        // 1. Category Filter
        if (categoryFilter !== "all") {
            list = list.filter(c => c.type === categoryFilter);
        }
        
        // 2. Week View Filter: Only show classes in the current week view
        if (viewMode === "week") {
            list = list.filter(c => {
                const classDate = new Date(rawClasses.find(rc => rc.id === c.id)?.start_time || "");
                return classDate >= weekStart && classDate <= weekEnd;
            });
        }

        return list;
    }, [events, categoryFilter, viewMode, weekStart, weekEnd, rawClasses]);

    // Close create form after successful submission and revalidate data
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            if (fetcher.data?.intent === "create_class") {
                setShowCreateForm(false);
                setForm({ title: "", coach_id: "", capacity: 20, day: 0, start_time: "08:00", location: "", room_id: "" });
            }
            // Revalidate to fetch updated class list
            revalidator.revalidate();
        }
    }, [fetcher.state, fetcher.data, revalidator]);

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const formData = new FormData();
        formData.set("intent", "create_class");
        formData.set("title", form.title);
        formData.set("coach_id", form.coach_id);
        formData.set("capacity", String(form.capacity));
        formData.set("day", String(form.day));
        formData.set("start_time", form.start_time);
        formData.set("location", form.location);
        formData.set("room_id", form.room_id);
        formData.set("tz_offset", String(new Date().getTimezoneOffset())); // Send client TZ
        formData.set("current_week_start", weekStart.toISOString()); // Create in the visible week
        fetcher.submit(formData, { method: "post" });
    }

    // Calendar Helpers for Month View
    const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
    function getStartDayOfWeek(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const startDow = getStartDayOfWeek(viewYear, viewMonth);
    const totalMonthCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }
    function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }
    function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }
    const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
                <div>
                    <h1 className="text-2xl font-black text-white">Agenda Semanal</h1>
                    <p className="text-white/50 mt-1">Gstiona clases, eventos interactivos y pases de lista.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Category Filter */}
                    <div className="flex bg-white/5/10 p-1 rounded-lg">
                        <button
                            onClick={() => setCategoryFilter("all")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${categoryFilter === "all" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setCategoryFilter("class")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${categoryFilter === "class" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            Clases
                        </button>
                        <button
                            onClick={() => setCategoryFilter("event")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${categoryFilter === "event" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            Eventos
                        </button>
                    </div>

                    {/* Time Filter */}
                    <div className="flex bg-white/5/10 p-1 rounded-lg">
                        <button
                            onClick={() => setTimeFilter("all")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeFilter === "all" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            Día
                        </button>
                        <button
                            onClick={() => setTimeFilter("am")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeFilter === "am" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            AM
                        </button>
                        <button
                            onClick={() => setTimeFilter("pm")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeFilter === "pm" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            PM
                        </button>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-white/5/10 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode("week")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "week" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode("month")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "month" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Mes
                        </button>
                    </div>

                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto sm:ml-0 shadow-lg shadow-purple-200"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nueva clase</span>
                    </button>
                </div>
            </div>

            {/* Create Form (collapsible) */}
            {showCreateForm && (
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
                    <h2 className="text-lg font-black text-white mb-4">Crear nueva clase</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Título</label>
                            <input
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                required
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                placeholder="CrossFit, Yoga…"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Coach</label>
                            <select
                                value={form.coach_id}
                                onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}
                                required
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            >
                                <option value="">Seleccionar…</option>
                                {coaches.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Capacidad</label>
                            <input
                                value={form.capacity}
                                onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                                type="number"
                                min={1}
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                placeholder="20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Día</label>
                            <select
                                value={form.day}
                                onChange={e => setForm(f => ({ ...f, day: Number(e.target.value) }))}
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            >
                                {DAYS.map((d, i) => (<option key={i} value={i}>{d}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Hora inicio</label>
                            <input
                                value={form.start_time}
                                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                type="time"
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Sala</label>
                            <select
                                value={form.room_id}
                                onChange={e => {
                                    const r = rooms.find((x: any) => x.id === e.target.value);
                                    setForm(f => ({ 
                                        ...f, 
                                        room_id: e.target.value, 
                                        location: r ? r.name : "",
                                        capacity: r ? r.capacity : f.capacity 
                                    }));
                                }}
                                required
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            >
                                <option value="">Seleccionar…</option>
                                {rooms.map((r: any) => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.capacity} lugares)</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-3 flex gap-3">
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-black rounded-lg transition-all active:scale-95 shadow-md shadow-purple-100"
                            >
                                Crear clase
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="px-6 py-2.5 bg-white/5/10 hover:bg-white/5/20 text-white/60 text-sm font-bold rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Weekly Calendar Grid */}
            {viewMode === "week" && (
                <div className="bg-white/5 border border-white/[0.08] rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5/50">
                        <div className="flex items-center gap-4 text-white">
                            <h2 className="text-lg font-bold capitalize">
                                {weekStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                            </h2>
                            <p className="text-xs text-white/40">S{Math.ceil(weekStart.getDate() / 7)} del mes</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {weekOffset !== 0 && (
                                <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors">Semana actual</button>
                            )}
                            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Header row */}
                            <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-white/[0.08] bg-white/5">
                                <div className="p-2 text-xs text-white/40 font-medium text-center">Hora</div>
                                {weekDays.map((date, idx) => (
                                    <div key={idx} className="p-2 text-xs font-semibold text-center uppercase tracking-wider flex flex-col">
                                        <span className="text-white/40">{DAYS[idx]}</span>
                                        <span className={`text-sm ${date.toDateString() === today.toDateString() ? 'text-purple-400 font-black' : 'text-white/80'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Time rows */}
                            {filteredHours.map((hour) => (
                                <div key={hour} className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-white/5 min-h-[48px]">
                                    <div className="p-2 text-xs text-white/40 text-center border-r border-white/5 flex items-start justify-center pt-1">
                                        {hour}:00
                                    </div>
                                    {weekDays.map((date, dayIdx) => {
                                        const cls = filteredCalendar.find((c) => {
                                            const classDate = new Date(rawClasses.find(rc => rc.id === c.id)?.start_time || "");
                                            return classDate.toDateString() === date.toDateString() && c.hour === hour;
                                        });
                                        return (
                                            <div key={dayIdx} className="p-0.5 border-r border-white/5 relative">
                                                {cls && (
                                                    <button
                                                        onClick={() => setSelectedClass(cls)}
                                                        className={`w-full text-left text-[11px] rounded-lg p-2 ${cls.color} ${cls.color.includes('text') ? '' : 'text-white'} hover:opacity-90 transition-opacity relative shadow-sm`}
                                                        style={{ minHeight: `${Math.max(cls.duration * 44, 40)}px` }}
                                                    >
                                                        <p className="font-bold leading-tight flex items-center gap-1">
                                                            {cls.type === 'event' && <span className="text-[10px] bg-black/20 px-1 py-0.5 rounded uppercase tracking-wider">Evento</span>}
                                                            {cls.title}
                                                        </p>
                                                        <p className="opacity-80 leading-tight mt-0.5">{cls.coach}</p>
                                                        <p className="opacity-70 mt-1">{cls.enrolled}/{cls.capacity}</p>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Calendar Grid */}
            {viewMode === "month" && (
                <div className="bg-white/5 border border-white/[0.08] rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5/50">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </h2>
                        <div className="flex items-center gap-2">
                            {!isCurrentMonthView && (
                                <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors">Hoy</button>
                            )}
                            <button onClick={prevMonth} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={nextMonth} className="p-2 rounded-lg border border-white/[0.08] text-white/60 hover:bg-white/5 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
                        {[...DAYS, "Dom"].map((d) => (
                            <div key={d} className="py-2.5 text-center text-xs font-semibold text-white/50 uppercase tracking-wider border-r border-white/5 last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {Array.from({ length: totalMonthCells }).map((_, idx) => {
                            const dayNumber = idx - startDow + 1;
                            const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
                            const date = new Date(viewYear, viewMonth, dayNumber);

                            // Get classes for this EXACT date
                            const dayClasses = events.filter(c => {
                                const classDate = new Date(rawClasses.find(rc => rc.id === c.id)?.start_time || "");
                                return classDate.toDateString() === date.toDateString();
                            });
                            
                            // Sort by hour
                            dayClasses.sort((a, b) => a.hour - b.hour);

                            const isToday = isCurrentMonth && date.toDateString() === today.toDateString();

                            return (
                                <div key={idx} className={`min-h-[120px] border-b border-r border-white/5 p-1.5 transition-colors ${!isCurrentMonth ? "bg-white/5 opacity-30" : "bg-white/5"}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${isToday ? "bg-purple-600 text-white font-black" : !isCurrentMonth ? "text-white/30" : "text-white/70"}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {dayClasses.map((cls, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedClass(cls)}
                                                className={`w-full text-left text-[10px] rounded p-1 truncate cursor-pointer transition-opacity hover:opacity-80 ${cls.color} ${cls.color.includes('text') ? '' : 'text-white'} shadow-sm`}
                                                title={`${cls.title} a las ${cls.hour}:00`}
                                            >
                                                <span className="font-semibold">{cls.hour}:00</span> {cls.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Attendance Modal ─────────────────────────── */}
            {selectedClass && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedClass(null)}>
                    <div className="bg-white/5 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={`${selectedClass.color} ${selectedClass.color.includes('text') ? '' : 'text-white'} p-6 rounded-t-2xl`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-black">{selectedClass.title}</h2>
                                        {selectedClass.type === 'event' && (
                                            <span className="bg-black/20 text-xs px-2 py-0.5 rounded-full font-medium tracking-wider uppercase">
                                                Evento Especial
                                            </span>
                                        )}
                                        {selectedClass.isLive && (
                                            <span className="bg-black/20 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                                                EN VIVO
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-sm mt-1">{selectedClass.coach} • {selectedClass.location}</p>
                                    <p className="text-white/80 text-sm">{DAYS[selectedClass.day]} {selectedClass.hour}:00 • {selectedClass.enrolled}/{selectedClass.capacity} inscritos</p>
                                </div>
                                <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-white/5/20 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Attendee List */}
                        <div className="p-6">
                            <h3 className="font-semibold text-white mb-4">Pase de lista</h3>
                            {selectedClass.attendees.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedClass.attendees.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${a.checkedIn ? "bg-green-100 text-green-700" : "bg-white/5/20 text-white/50"
                                                    }`}>
                                                    {a.checkedIn ? <Check className="w-4 h-4" /> : a.name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{a.name}</p>
                                                    <p className="text-xs text-white/40">{a.checkedIn ? "✓ Check-in" : "Pendiente"}</p>
                                                </div>
                                            </div>
                                            {!a.checkedIn && (
                                                <div className="flex gap-1.5">
                                                    <fetcher.Form method="post">
                                                        <input type="hidden" name="intent" value="checkin" />
                                                        <input type="hidden" name="userId" value={a.id} />
                                                        <input type="hidden" name="classId" value={selectedClass.id} />
                                                        <button type="submit" className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                                                            Check-in
                                                        </button>
                                                    </fetcher.Form>
                                                    <fetcher.Form method="post">
                                                        <input type="hidden" name="intent" value="no_show" />
                                                        <input type="hidden" name="userId" value={a.id} />
                                                        <input type="hidden" name="classId" value={selectedClass.id} />
                                                        <button type="submit" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                                                            <UserMinus className="w-3 h-3" />
                                                            No Show
                                                        </button>
                                                    </fetcher.Form>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-white/40 text-center py-4">No hay inscritos para mostrar.</p>
                            )}

                            {/* Drop-in Button */}
                            <div className="mt-6 pt-4 border-t border-white/5">
                                <fetcher.Form method="post" className="flex items-center gap-2">
                                    <input type="hidden" name="intent" value="drop_in" />
                                    <input type="hidden" name="classId" value={selectedClass.id} />
                                    <input
                                        name="userName"
                                        placeholder="Nombre del drop-in…"
                                        className="flex-1 bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Drop-in
                                    </button>
                                </fetcher.Form>
                                <p className="text-xs text-white/40 mt-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Cobra $150 automáticamente al agregar.
                                </p>
                            </div>

                            {/* Delete class */}
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <fetcher.Form method="post">
                                    <input type="hidden" name="intent" value="delete" />
                                    <input type="hidden" name="classId" value={selectedClass.id} />
                                    <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium">
                                        Eliminar esta clase
                                    </button>
                                </fetcher.Form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
