// app/routes/dashboard/schedule.tsx
// Monthly calendar view for class schedule (MOCK DATA).
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/schedule";
import type { ClassSchedule } from "~/types/database";
import { useFetcher } from "react-router";
import { useState, useMemo } from "react";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface ClassWithSocial extends ClassSchedule {
    bookedCount: number;
    buddies: { name: string; avatar: string }[];
    type: ClassType;
}

type ClassType = "hyrox" | "fullMuv" | "upperBody" | "lowerBody" | "openGym";

const classLabels: Record<ClassType, string> = {
    hyrox: "Hyrox",
    fullMuv: "Full Muv",
    upperBody: "Upper Body",
    lowerBody: "Lower Body",
    openGym: "Open Gym",
};

// ─── Color Map ────────────────────────────────────────────────────
const CLASS_COLORS: Record<ClassType, { bg: string; text: string; dot: string; border: string; bgHover: string }> = {
    hyrox: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-200", bgHover: "hover:bg-red-100" },
    fullMuv: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200", bgHover: "hover:bg-blue-100" },
    upperBody: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-200", bgHover: "hover:bg-orange-100" },
    lowerBody: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200", bgHover: "hover:bg-emerald-100" },
    openGym: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-600", border: "border-gray-300", bgHover: "hover:bg-gray-200" },
};

// ─── Buddy Pool ───────────────────────────────────────────────────
const BUDDY_POOL = [
    { name: "Juan", avatar: "🧑" },
    { name: "Ana", avatar: "👩" },
    { name: "Luis", avatar: "👨" },
    { name: "Sara", avatar: "👩‍🦱" },
    { name: "Pedro", avatar: "🧔" },
    { name: "Marta", avatar: "👱‍♀️" },
];

// ─── Mock Class Generator ─────────────────────────────────────────
function generateMockClasses(): ClassWithSocial[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const templates: { title: string; type: ClassType; location: string; durationMin: number; capacity: number }[] = [
        { title: "Hyrox", type: "hyrox", location: "Sala Principal", durationMin: 90, capacity: 20 },
        { title: "Full Muv", type: "fullMuv", location: "Sala Secundaria", durationMin: 60, capacity: 25 },
        { title: "Upper Body", type: "upperBody", location: "Zona Pesas", durationMin: 60, capacity: 20 },
        { title: "Lower Body", type: "lowerBody", location: "Zona Pesas", durationMin: 60, capacity: 20 },
        { title: "Open Gym", type: "openGym", location: "General", durationMin: 120, capacity: 50 },
    ];

    // Generate classes for all days of the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const schedule: { day: number; hour: number; minute: number; templateIdx: number }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
        // Skip Sundays (0)
        if (new Date(year, month, day).getDay() === 0) continue;

        const isMwf = new Date(year, month, day).getDay() % 2 !== 0; // Mon, Wed, Fri

        // AM schedule
        schedule.push({ day, hour: 5, minute: 30, templateIdx: isMwf ? 0 : 1 });
        schedule.push({ day, hour: 7, minute: 0, templateIdx: isMwf ? 2 : 3 });
        schedule.push({ day, hour: 8, minute: 30, templateIdx: isMwf ? 1 : 0 });

        // Open Gym AM (8:00 - 10:00)
        schedule.push({ day, hour: 8, minute: 0, templateIdx: 4 });

        // PM schedule
        schedule.push({ day, hour: 18, minute: 0, templateIdx: isMwf ? 3 : 2 });
        schedule.push({ day, hour: 19, minute: 0, templateIdx: isMwf ? 0 : 1 });

        // Open Gym PM (18:00 - 20:30)
        schedule.push({ day, hour: 18, minute: 0, templateIdx: 4 });
    }

    return schedule.map(({ day, hour, minute, templateIdx }, i) => {
        const t = templates[templateIdx];
        const start = new Date(year, month, day, hour, minute, 0);
        const end = new Date(start.getTime() + t.durationMin * 60_000);
        const booked = Math.min(t.capacity, Math.floor(Math.random() * (t.capacity + 4)));
        const buddyCount = Math.floor(Math.random() * 4);
        const buddies = BUDDY_POOL.slice(0, buddyCount);

        return {
            id: `cls-${String(i).padStart(3, "0")}`,
            title: t.title,
            description: `Clase de ${t.title.toLowerCase()} para todos los niveles.`,
            coach_id: "coach-001",
            capacity: t.capacity,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            location: t.location,
            created_at: "2025-01-01T00:00:00Z",
            bookedCount: booked,
            buddies,
            type: t.type,
        };
    });
}

const MOCK_CLASSES = generateMockClasses();

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
    const { profile, gymId } = await requireGymAuth(request);
    return { classes: MOCK_CLASSES };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const classId = formData.get("classId") as string;
    const intent = formData.get("intent") as string;
    if (intent === "waitlist") {
        return { success: true, message: "Te avisaremos cuando haya cupo en la clase." };
    }
    return { success: true, message: `Clase reservada: ${classId}` };
}

// ─── Component ────────────────────────────────────────────────────
export default function Schedule({ loaderData }: Route.ComponentProps) {
    const { classes } = loaderData;
    const fetcher = useFetcher();
    const today = new Date();

    // Navigation & Filter state
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedClass, setSelectedClass] = useState<ClassWithSocial | null>(null);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [filterClasses, setFilterClasses] = useState<ClassType[]>([]);
    const [viewMode, setViewMode] = useState<"week" | "month">("month");

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
            ? classes.filter((c) => filterClasses.includes(c.type))
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
                    <h1 className="text-2xl font-bold text-gray-900">Agenda de Clases</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        Selecciona una clase para ver detalles y reservar.
                    </p>
                </div>

                {/* View Controls & Date Nav */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode("week")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode("month")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
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
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Hoy
                                </button>
                            )}
                            <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </span>
                            <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {!isCurrentWeek() && (
                                <button
                                    onClick={goTodayWeek}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Hoy
                                </button>
                            )}
                            <button onClick={goPrevWeek} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
                                {viewWeekDate.toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })} - {new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + 6).toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })}
                            </span>
                            <button onClick={goNextWeek} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
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
                        ? "bg-gray-900 border-gray-900 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    Todas
                </button>
                {(Object.entries(CLASS_COLORS) as [ClassType, typeof CLASS_COLORS[ClassType]][]).map(([type, colors]) => {
                    const isSelected = filterClasses.includes(type);
                    return (
                        <button
                            key={type}
                            onClick={() => {
                                if (isSelected) {
                                    setFilterClasses(filterClasses.filter((t) => t !== type));
                                } else {
                                    setFilterClasses([...filterClasses, type]);
                                }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${isSelected
                                ? `${colors.bg} ${colors.text} ${colors.border}`
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            {classLabels[type]}
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Calendar Grid (Month) ── */}
            {viewMode === "month" && (
                <div className="hidden md:block bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-gray-100">
                        {DAY_NAMES.map((d) => (
                            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7">
                        {cells.map(({ date, isCurrentMonth }, idx) => {
                            const key = dateKey(date);
                            const dayClasses = classesByDate.get(key) ?? [];
                            const isToday = isSameDay(date, today);
                            const isPast = date < today && !isToday;

                            return (
                                <div
                                    key={idx}
                                    className={`min-h-[120px] border-b border-r border-gray-50 p-1.5 transition-colors ${!isCurrentMonth ? "bg-gray-50/60" : isPast ? "bg-gray-50/30" : "bg-white"
                                        }`}
                                >
                                    {/* Day number */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full ${isToday
                                                ? "bg-blue-600 text-white"
                                                : !isCurrentMonth
                                                    ? "text-gray-300"
                                                    : isPast
                                                        ? "text-gray-400"
                                                        : "text-gray-700"
                                                }`}
                                        >
                                            {date.getDate()}
                                        </span>
                                        {dayClasses.length > 0 && (
                                            <span className="text-[10px] text-gray-400 font-medium mr-1">
                                                {dayClasses.length} {dayClasses.length === 1 ? "clase" : "clases"}
                                            </span>
                                        )}
                                    </div>

                                    {/* Class chips */}
                                    <div className="space-y-0.5">
                                        {dayClasses.slice(0, 3).map((cls) => {
                                            const colors = CLASS_COLORS[cls.type];
                                            const isFull = cls.bookedCount >= cls.capacity;
                                            const time = new Date(cls.start_time).toLocaleTimeString("es-MX", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                            return (
                                                <button
                                                    key={cls.id}
                                                    onClick={() => setSelectedClass(cls)}
                                                    className={`w-full text-left px-1.5 py-1 rounded-md text-[11px] font-medium truncate border transition-all cursor-pointer ${colors.bg} ${colors.text} ${colors.border} ${colors.bgHover} ${isFull ? "opacity-60 line-through" : ""
                                                        }`}
                                                    title={`${cls.title} — ${time}`}
                                                >
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-1`} />
                                                    {time} {cls.title}
                                                    {isFull && (
                                                        <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 rounded no-underline">
                                                            LLENO
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {dayClasses.length > 3 && (
                                            <button
                                                onClick={() => {
                                                    setSelectedDay(date);
                                                }}
                                                className="w-full text-left px-1.5 py-0.5 text-[10px] text-blue-600 font-medium hover:underline cursor-pointer"
                                            >
                                                +{dayClasses.length - 3} más
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
                <div className="hidden md:block bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Header row */}
                            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
                                <div className="p-2 text-xs text-gray-400 font-medium text-center">Hora</div>
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + i);
                                    const isToday = isSameDay(d, today);
                                    return (
                                        <div key={i} className="p-2 text-center border-r border-gray-100 flex flex-col items-center">
                                            <span className="text-[10px] text-gray-500 uppercase font-semibold">{DAY_NAMES[i]}</span>
                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5 ${isToday ? "bg-blue-600 text-white" : "text-gray-900"}`}>{d.getDate()}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Time rows - hardcode hours from 5 to 20 */}
                            {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => (
                                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-50 min-h-[48px]">
                                    <div className="p-2 text-[10px] text-gray-400 font-medium text-right border-r border-gray-100 flex items-start justify-end pt-1">
                                        {hour}:00
                                    </div>
                                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                                        const date = new Date(viewWeekDate.getFullYear(), viewWeekDate.getMonth(), viewWeekDate.getDate() + dayIdx);
                                        const key = dateKey(date);
                                        const dayClasses = classesByDate.get(key) ?? [];
                                        const hourClasses = dayClasses.filter(c => new Date(c.start_time).getHours() === hour);

                                        return (
                                            <div key={dayIdx} className="p-1 border-r border-gray-50 relative">
                                                {hourClasses.map(cls => {
                                                    const colors = CLASS_COLORS[cls.type];
                                                    const isFull = cls.bookedCount >= cls.capacity;
                                                    const duration = (new Date(cls.end_time).getTime() - new Date(cls.start_time).getTime()) / 60000;
                                                    return (
                                                        <button
                                                            key={cls.id}
                                                            onClick={() => setSelectedClass(cls)}
                                                            className={`w-full text-left p-1.5 mb-1 rounded-md text-[10px] font-medium transition-all ${colors.bg} ${colors.text} ${colors.border} ${colors.bgHover} shadow-sm`}
                                                            style={{ minHeight: `${Math.max(duration * 0.8, 30)}px` }}
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
                {/* Compact mini-calendar */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAY_NAMES.map((d) => (
                            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase">
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
                                                ? "text-gray-300"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                >
                                    {date.getDate()}
                                    {dayClasses.length > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {dayClasses.slice(0, 3).map((cls) => (
                                                <span
                                                    key={cls.id}
                                                    className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : CLASS_COLORS[cls.type].dot
                                                        }`}
                                                />
                                            ))}
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
                        <h3 className="text-sm font-semibold text-gray-700">
                            {selectedDay.toLocaleDateString("es-MX", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </h3>
                        {selectedDayClasses.length === 0 ? (
                            <p className="text-sm text-gray-400 py-6 text-center">No hay clases este día.</p>
                        ) : (
                            selectedDayClasses.map((cls) => (
                                <MobileClassCard key={cls.id} cls={cls} onSelect={() => setSelectedClass(cls)} />
                            ))
                        )}
                    </div>
                )}

                {!selectedDay && (
                    <p className="text-center text-sm text-gray-400 py-4">Toca un día para ver clases.</p>
                )}
            </div>

            {/* ── Class Detail Modal ── */}
            {selectedClass && (
                <ClassDetailModal
                    cls={selectedClass}
                    onClose={() => setSelectedClass(null)}
                    fetcher={fetcher}
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
                />
            )}
        </div>
    );
}

// ─── Mobile Class Card ────────────────────────────────────────────
function MobileClassCard({ cls, onSelect }: { cls: ClassWithSocial; onSelect: () => void }) {
    const colors = CLASS_COLORS[cls.type];
    const isFull = cls.bookedCount >= cls.capacity;
    const spotsLeft = cls.capacity - cls.bookedCount;
    const time = new Date(cls.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const endTime = new Date(cls.end_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm transition-all active:scale-[0.98] ${isFull ? "border-red-200 opacity-70" : `${colors.border} hover:shadow-md`
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} />
                        <p className="font-semibold text-gray-900 text-sm truncate">{cls.title}</p>
                        {isFull && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                LLENO
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {time} – {endTime}
                        </span>
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {cls.location}
                        </span>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-medium ${isFull ? "text-red-500" : spotsLeft <= 5 ? "text-amber-500" : "text-gray-500"}`}>
                        {cls.bookedCount}/{cls.capacity}
                    </span>
                </div>
            </div>

            {cls.buddies.length > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
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
}: {
    cls: ClassWithSocial;
    onClose: () => void;
    fetcher: ReturnType<typeof useFetcher>;
}) {
    const colors = CLASS_COLORS[cls.type];
    const isFull = cls.bookedCount >= cls.capacity;
    const spotsLeft = cls.capacity - cls.bookedCount;
    const startDate = new Date(cls.start_time);
    const endDate = new Date(cls.end_time);

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative w-full md:max-w-md bg-white md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header band */}
                <div className={`h-2 ${colors.dot}`} />

                <div className="p-6">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Title & Badge */}
                    <div className="flex items-start gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                            <Dumbbell className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{cls.title}</h2>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${colors.text} mt-0.5`}>
                                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                {classLabels[cls.type]}
                            </span>
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <InfoBlock
                            icon={<Clock className="w-4 h-4 text-gray-400" />}
                            label="Horario"
                            value={`${startDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
                        />
                        <InfoBlock
                            icon={<MapPin className="w-4 h-4 text-gray-400" />}
                            label="Ubicación"
                            value={cls.location ?? "Sin ubicación"}
                        />
                        <InfoBlock
                            icon={<Users className="w-4 h-4 text-gray-400" />}
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
                            icon={<Calendar className="w-4 h-4 text-gray-400" />}
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
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{cls.description}</p>
                    )}

                    {/* Buddies */}
                    {cls.buddies.length > 0 && (
                        <div className="flex items-center gap-2 mb-5 py-3 px-3 bg-blue-50/60 rounded-xl">
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

                    {/* Action */}
                    <fetcher.Form method="post">
                        <input type="hidden" name="classId" value={cls.id} />
                        {isFull ? (
                            <>
                                <input type="hidden" name="intent" value="waitlist" />
                                <button
                                    type="submit"
                                    disabled={fetcher.state !== "idle"}
                                    className="w-full px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                                    disabled={fetcher.state !== "idle"}
                                    className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    {fetcher.state !== "idle" ? "Reservando…" : "Reservar clase (1 crédito)"}
                                </button>
                            </>
                        )}
                    </fetcher.Form>
                </div>
            </div>

            {/* Slide-up animation */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.3s ease-out;
                }
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
        <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
            <div className="mt-0.5">{icon}</div>
            <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-xs text-gray-700 font-medium mt-0.5">{value}</p>
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
}: {
    day: Date;
    classes: ClassWithSocial[];
    onClose: () => void;
    onSelectClass: (cls: ClassWithSocial) => void;
    isMobile: boolean;
}) {
    if (isMobile || classes.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 hidden md:flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">
                            {day.toLocaleDateString("es-MX", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {classes.map((cls) => {
                            const colors = CLASS_COLORS[cls.type];
                            const isFull = cls.bookedCount >= cls.capacity;
                            const time = new Date(cls.start_time).toLocaleTimeString("es-MX", {
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                            return (
                                <button
                                    key={cls.id}
                                    onClick={() => onSelectClass(cls)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm ${colors.bg} ${colors.border} ${colors.bgHover}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                            <span className={`text-sm font-semibold ${colors.text}`}>{cls.title}</span>
                                        </div>
                                        {isFull && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                                LLENO
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
