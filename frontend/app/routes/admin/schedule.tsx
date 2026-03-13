// app/routes/admin/schedule.tsx
// Admin – Weekly Calendar Grid + Live Class Attendance (MOCK DATA).
import type { Route } from "./+types/schedule";
import { useFetcher } from "react-router";
import { useState, useMemo } from "react";
import { Plus, X, Check, UserMinus, UserPlus, Clock, Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────
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

const MOCK_CALENDAR: CalendarClass[] = [];

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    return { calendar: MOCK_CALENDAR };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    return { success: true, intent };
}

import { useTenant } from "~/context/TenantContext";

// ─── Main Component ──────────────────────────────────────────────
export default function AdminSchedule({ loaderData }: Route.ComponentProps) {
    const { calendar: initialCalendar } = loaderData;
    const { config } = useTenant();
    const coaches = config.coaches;
    const fetcher = useFetcher();
    const [events, setEvents] = useState<CalendarClass[]>(initialCalendar);
    const [selectedClass, setSelectedClass] = useState<CalendarClass | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [viewMode, setViewMode] = useState<"week" | "month">("week");

    // Local form state for creation
    const [form, setForm] = useState({
        title: "",
        coach_id: "",
        capacity: 20,
        day: 0,
        start_time: "08:00",
        location: "Sala Principal"
    });

    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

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
        if (categoryFilter !== "all") {
            list = list.filter(c => c.type === categoryFilter);
        }
        return list;
    }, [events, categoryFilter]);

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const coach = coaches.find(c => c.id === form.coach_id);
        const hour = parseInt(form.start_time.split(":")[0]);

        const newClass: CalendarClass = {
            id: `cl-${Date.now()}`,
            title: form.title,
            day: Number(form.day),
            hour: hour,
            duration: 1,
            coach: coach?.name || "Staff",
            capacity: Number(form.capacity),
            enrolled: 0,
            location: form.location,
            color: "bg-purple-600",
            isLive: false,
            type: "class",
            attendees: []
        };

        setEvents(prev => [...prev, newClass]);
        setShowCreateForm(false);
        setForm({
            title: "",
            coach_id: "",
            capacity: 20,
            day: 0,
            start_time: "08:00",
            location: "Sala Principal"
        });
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-900">
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
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Ubicación</label>
                            <input
                                value={form.location}
                                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                placeholder="Sala Principal"
                            />
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
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Header row */}
                            <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-white/[0.08] bg-white/5">
                                <div className="p-2 text-xs text-white/40 font-medium text-center">Hora</div>
                                {DAYS.map((day) => (
                                    <div key={day} className="p-2 text-xs text-white/60 font-semibold text-center uppercase tracking-wider">{day}</div>
                                ))}
                            </div>

                            {/* Time rows */}
                            {filteredHours.map((hour) => (
                                <div key={hour} className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-gray-50 min-h-[48px]">
                                    <div className="p-2 text-xs text-white/40 text-center border-r border-white/5 flex items-start justify-center pt-1">
                                        {hour}:00
                                    </div>
                                    {DAYS.map((_, dayIdx) => {
                                        const cls = filteredCalendar.find((c) => c.day === dayIdx && c.hour === hour);
                                        return (
                                            <div key={dayIdx} className="p-0.5 border-r border-gray-50 relative">
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
                                                        {cls.isLive && (
                                                            <span className="absolute top-1 right-1 w-2 h-2 bg-green-300 rounded-full animate-pulse shadow-sm" />
                                                        )}
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
                            const localDay = date.getDay() === 0 ? 6 : date.getDay() - 1; // 0=Lun...

                            // Get regular template classes that map to this day of the week
                            const dayClasses = isCurrentMonth ? filteredCalendar.filter(c => c.day === localDay && filteredHours.includes(c.hour)) : [];
                            // Sort by hour
                            dayClasses.sort((a, b) => a.hour - b.hour);

                            const isToday = isCurrentMonth && date.getDate() === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

                            return (
                                <div key={idx} className={`min-h-[120px] border-b border-r border-gray-50 p-1.5 transition-colors ${!isCurrentMonth ? "bg-white/5/60" : "bg-white/5"}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${isToday ? "bg-purple-600 text-white" : !isCurrentMonth ? "text-white/30" : "text-white/70"}`}>
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
