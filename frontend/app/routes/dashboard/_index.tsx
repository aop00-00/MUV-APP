import type { Route } from "./+types/_index";
import { Link, useFetcher } from "react-router";
import { useState } from "react";
import {
    Calendar, CreditCard, TrendingUp, ArrowRight, Flame, Coffee,
    Dumbbell, Timer, Smile, Frown, Meh, Zap, Activity, Plus, History, Trash2, Check, X, Scale, Ruler
} from "lucide-react";
// Auth and Supabase services moved to dynamic imports inside loader/action

// ─── Mock Data ───────────────────────────────────────────────────
const MOCK_NEXT_CLASS = {
    id: "cls-001",
    name: "CrossFit Fundamentals",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    instructor: "Coach Mike",
    location: "Sala Principal",
};

const MOCK_STREAK = 7;
const MOCK_CLASSES_MONTH = 12;
const MOCK_GYM_OCCUPANCY: "low" | "medium" | "high" = "medium";

const MOCK_RADAR_STATS = {
    Cardio: 78,
    Fuerza: 45,
    Flexibilidad: 62,
    Mente: 80,
    Resistencia: 70,
};

const PREDEFINED_EXERCISES = [
    "Peso Muerto", "Sentadilla Libre", "Press Banca", "Dominadas (Pull-ups)", "Press Militar",
    "Remo con Barra", "Sentadilla Frontal", "Clean & Jerk", "Snatch (Arrancada)", "Fondos en Paralelas (Dips)",
    "Hip Thrust", "Zancadas (Lunges)", "Press Inclinado", "Remo en Anillas", "Push Press",
    "Kettlebell Swing", "Box Jump", "Wall Balls", "Muscle Up", "Peso Muerto Rumano"
];

const INITIAL_MOCK_PRS = [
    {
        exercise: "Peso Muerto", value: 120, unit: "kg", max: 180, previous: 115,
        history: [{ date: "15 Feb", val: 115 }, { date: "10 Ene", val: 110 }, { date: "01 Dic", val: 100 }]
    },
    {
        exercise: "Sentadilla Libre", value: 100, unit: "kg", max: 160, previous: 95,
        history: [{ date: "12 Feb", val: 95 }, { date: "05 Ene", val: 90 }]
    },
    {
        exercise: "Press Banca", value: 75, unit: "kg", max: 120, previous: 72.5,
        history: [{ date: "18 Feb", val: 72.5 }, { date: "20 Ene", val: 70 }, { date: "15 Nov", val: 65 }]
    },
];

const INITIAL_BODY_STATS = [
    { date: "15 Feb", weight: 75.5, height: 1.78 },
    { date: "15 Ene", weight: 76.2, height: 1.78 },
    { date: "15 Dic", weight: 77.0, height: 1.78 },
];

const MOCK_QUICK_BUY = { name: "Proteína Whey", price: 65, id: "bev-001" };

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);

    // Fetch User Stats (Snapshot)
    const { data: userStats } = await supabaseAdmin
        .from("user_stats")
        .select("*")
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .single();

    // Fetch Gym Stats for live occupancy
    const { data: gymStats } = await supabaseAdmin
        .from("gym_stats")
        .select("current_occupancy, max_capacity")
        .eq("gym_id", gymId)
        .single();

    // Determine user state relative to next class
    const now = Date.now();
    const classStart = userStats?.next_booking_at ? new Date(userStats.next_booking_at).getTime() : 0;
    const diff = classStart ? classStart - now : -1;
    const hourMs = 60 * 60 * 1000;

    let userState: "before_class" | "during_class" | "after_class" = "after_class";
    if (classStart > 0) {
        if (diff > 0 && diff <= 4 * hourMs) {
            userState = "before_class";
        } else if (diff <= 0 && diff > -1 * hourMs) {
            userState = "during_class";
        }
    }

    // Map occupancy to string
    const occPct = (gymStats?.current_occupancy || 0) / (gymStats?.max_capacity || 100);
    const gymOccupancy: "low" | "medium" | "high" = occPct > 0.8 ? "high" : occPct > 0.4 ? "medium" : "low";

    return {
        profile,
        userState,
        nextClass: {
            id: "next",
            name: userStats?.next_class_name || "Sin reserva",
            startTime: userStats?.next_booking_at || new Date().toISOString(),
            instructor: "TBD", // Instructor joined fields not in user_stats yet
            location: "Gimnasio",
        },
        streak: 0, // Streak logic TBD, using 0 for now
        classesMonth: userStats?.classes_this_month || 0,
        gymOccupancy,
        radarStats: MOCK_RADAR_STATS, // Keep mock for now
        initialPrs: INITIAL_MOCK_PRS, // Keep mock for now
        initialBodyStats: INITIAL_BODY_STATS, // Keep mock for now
        quickBuy: MOCK_QUICK_BUY,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    if (intent === "quick_buy") return { success: true, message: "¡Pedido realizado!" };
    if (intent === "feedback") return { success: true, message: "¡Gracias por tu feedback!" };
    return {};
}

// ─── Radar Chart SVG Component ───────────────────────────────────
function RadarChart({ stats }: { stats: Record<string, number> }) {
    const labels = Object.keys(stats);
    const values = Object.values(stats);

    // Hardcoded average based on labels
    const humanAverage: Record<string, number> = {
        Cardio: 60,
        Fuerza: 55,
        Flexibilidad: 50,
        Mente: 65,
        Resistencia: 60,
    };
    const avgValues = labels.map(label => humanAverage[label] || 50);

    const n = labels.length;
    const cx = 120, cy = 120, maxR = 90;

    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2;

    const getPoint = (i: number, r: number) => ({
        x: cx + r * Math.cos(startAngle + i * angleStep),
        y: cy + r * Math.sin(startAngle + i * angleStep),
    });

    // Grid rings
    const rings = [0.25, 0.5, 0.75, 1.0];
    const gridPaths = rings.map((frac) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, maxR * frac));
        return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
    });

    // Data polygon (User)
    const dataPts = values.map((v, i) => getPoint(i, (v / 100) * maxR));
    const dataPath = dataPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

    // Average polygon (Human)
    const avgPts = avgValues.map((v, i) => getPoint(i, (v / 100) * maxR));
    const avgPath = avgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

    return (
        <div className="flex flex-col items-center w-full">
            <svg viewBox="0 0 240 240" className="w-full max-w-[260px] mx-auto">
                {/* Grid */}
                {gridPaths.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {/* Axes */}
                {Array.from({ length: n }, (_, i) => {
                    const p = getPoint(i, maxR);
                    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
                })}

                {/* Average Data */}
                <path d={avgPath} fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                {avgPts.map((p, i) => (
                    <circle key={`avg-${i}`} cx={p.x} cy={p.y} r="3" fill="#10b981" />
                ))}

                {/* User Data */}
                <path d={dataPath} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" />
                {dataPts.map((p, i) => (
                    <circle key={`usr-${i}`} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
                ))}

                {/* Labels */}
                {labels.map((label, i) => {
                    const p = getPoint(i, maxR + 20);
                    return (
                        <text
                            key={i}
                            x={p.x}
                            y={p.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[10px] fill-gray-500 font-medium"
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
            <div className="flex gap-4 items-center justify-center -mt-2 text-[11px] font-medium text-gray-500">
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-blue-500 bg-blue-500/50"></span> Tú
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-emerald-500 border-dashed bg-emerald-500/20"></span> Promedio humano
                </div>
            </div>
        </div>
    );
}

// ─── Smart Hero Component ────────────────────────────────────────
function SmartHero({
    userState,
    profile,
    nextClass,
    streak,
}: {
    userState: string;
    profile: { full_name: string };
    nextClass: typeof MOCK_NEXT_CLASS;
    streak: number;
}) {
    const fetcher = useFetcher();
    const firstName = profile.full_name.split(" ")[0];

    if (userState === "before_class") {
        const startMs = new Date(nextClass.startTime).getTime();
        const hoursLeft = Math.max(0, Math.floor((startMs - Date.now()) / (1000 * 60 * 60)));
        const minsLeft = Math.max(0, Math.floor(((startMs - Date.now()) % (1000 * 60 * 60)) / (1000 * 60)));

        return (
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10">
                    <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Tu próxima clase</p>
                    <h2 className="text-3xl font-black mt-2">{nextClass.name}</h2>
                    <p className="text-blue-100 mt-1">con {nextClass.instructor} • {nextClass.location}</p>

                    <div className="flex items-center gap-6 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
                            <p className="text-3xl font-black">{hoursLeft}h {minsLeft}m</p>
                            <p className="text-blue-200 text-xs mt-1">para tu clase</p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                to="/dashboard/schedule"
                                className="bg-white text-blue-600 px-5 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all hover:scale-105 active:scale-95"
                            >
                                Ver detalles
                            </Link>
                            <fetcher.Form method="post">
                                <input type="hidden" name="intent" value="quick_buy" />
                                <button
                                    type="submit"
                                    className="bg-amber-400 text-amber-900 px-5 py-3 rounded-xl font-bold text-sm hover:bg-amber-300 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Coffee className="w-4 h-4" />
                                    Pre-ordenar batido
                                </button>
                            </fetcher.Form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (userState === "during_class") {
        return (
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-emerald-200 text-sm font-medium uppercase tracking-wider">
                        <Activity className="w-4 h-4 animate-pulse" />
                        EN SESIÓN
                    </div>
                    <h2 className="text-3xl font-black mt-2">{nextClass.name}</h2>
                    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-5">
                        <p className="text-sm text-emerald-200 font-medium mb-3">WOD – Workout del Día</p>
                        <ul className="space-y-2 text-white font-medium">
                            <li className="flex items-center gap-2"><Dumbbell className="w-4 h-4 text-emerald-300" /> 21-15-9: Thrusters (43kg)</li>
                            <li className="flex items-center gap-2"><Dumbbell className="w-4 h-4 text-emerald-300" /> Pull-ups</li>
                            <li className="flex items-center gap-2"><Timer className="w-4 h-4 text-emerald-300" /> Cap: 12 min</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // after_class
    return (
        <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3" />
            <div className="relative z-10">
                <h2 className="text-3xl font-black">¡Gran trabajo, {firstName}! 🎉</h2>
                <p className="text-orange-100 mt-2 text-lg">
                    Tienes una racha de <span className="font-black text-white">{streak} días</span> consecutivos. ¡No la pierdas!
                </p>
                <div className="mt-6">
                    <p className="text-sm text-orange-200 font-medium mb-3">¿Cómo te sentiste?</p>
                    <div className="flex gap-3">
                        {[
                            { icon: Smile, label: "Increíble", value: "great" },
                            { icon: Meh, label: "Normal", value: "ok" },
                            { icon: Frown, label: "Difícil", value: "hard" },
                        ].map((f) => (
                            <fetcher.Form method="post" key={f.value}>
                                <input type="hidden" name="intent" value="feedback" />
                                <input type="hidden" name="feeling" value={f.value} />
                                <button
                                    type="submit"
                                    className="bg-white/15 backdrop-blur-sm hover:bg-white/25 px-5 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-1"
                                >
                                    <f.icon className="w-6 h-6" />
                                    {f.label}
                                </button>
                            </fetcher.Form>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function DashboardIndex({ loaderData }: Route.ComponentProps) {
    const { profile, userState, nextClass, streak, classesMonth, gymOccupancy, radarStats, initialPrs, initialBodyStats, quickBuy } = loaderData;
    const fetcher = useFetcher();
    const [prs, setPrs] = useState(initialPrs);
    const [selectedExercise, setSelectedExercise] = useState("");
    const [addingDataTo, setAddingDataTo] = useState<string | null>(null);
    const [newDataValue, setNewDataValue] = useState<string>("");

    const [bodyStats, setBodyStats] = useState(initialBodyStats);
    const [newWeight, setNewWeight] = useState("");
    const [newHeight, setNewHeight] = useState("");
    const [isAddingBodyStat, setIsAddingBodyStat] = useState(false);

    const handleAddExercise = () => {
        if (!selectedExercise) return;
        if (prs.find(pr => pr.exercise === selectedExercise)) return; // Already exists

        setPrs([...prs, {
            exercise: selectedExercise,
            value: 0,
            unit: "kg",
            max: 150, // default max for visual bar
            previous: 0,
            history: []
        }]);
        setSelectedExercise("");
    };

    const handleRemoveExercise = (exerciseToRemove: string) => {
        setPrs(prs.filter(pr => pr.exercise !== exerciseToRemove));
    };

    const handleAddData = (exercise: string) => {
        const val = parseFloat(newDataValue);
        if (isNaN(val) || val <= 0) return;

        setPrs(prs.map(pr => {
            if (pr.exercise !== exercise) return pr;

            const newHistory = [{ val, date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }, ...pr.history].slice(0, 5); // Keep last 5

            let newValue = pr.value;
            let newPrevious = pr.previous;
            let newMax = pr.max;

            // If new value is strictly greater, it's a new PR!
            if (val > pr.value) {
                newPrevious = pr.value;
                newValue = val;
                if (val > pr.max) newMax = val + 20; // extend bar visually
            }

            return {
                ...pr,
                value: newValue,
                previous: newPrevious,
                max: newMax,
                history: newHistory
            };
        }));
        setAddingDataTo(null);
        setNewDataValue("");
    };

    const handleAddBodyStat = () => {
        const weight = parseFloat(newWeight);
        const height = parseFloat(newHeight);

        if (isNaN(weight) && isNaN(height)) return;

        const currentLatest = bodyStats[0];
        const newStat = {
            date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            weight: !isNaN(weight) ? weight : currentLatest.weight,
            height: !isNaN(height) ? height : currentLatest.height,
        };

        setBodyStats([newStat, ...bodyStats]);
        setIsAddingBodyStat(false);
        setNewWeight("");
        setNewHeight("");
    };

    const occupancyConfig = {
        low: { label: "Bajo", color: "bg-green-400", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
        medium: { label: "Medio", color: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
        high: { label: "Alto", color: "bg-red-400", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    };
    const occ = occupancyConfig[gymOccupancy];

    // Find the weakest stat for suggestion
    const weakest = Object.entries(radarStats).sort((a, b) => a[1] - b[1])[0];
    const classSuggestions: Record<string, string> = {
        Cardio: "Spinning",
        Fuerza: "CrossFit Fundamentals",
        Flexibilidad: "Yoga Flow",
        Mente: "Yoga Flow",
        Resistencia: "HIIT Morning",
    };

    return (
        <div className="space-y-6">
            {/* Smart Hero */}
            <SmartHero userState={userState} profile={profile} nextClass={nextClass} streak={streak} />

            {/* Gym Occupancy + Quick Buy Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Occupancy Widget */}
                <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${occ.bg} ${occ.border}`}>
                    <div className={`w-3 h-3 rounded-full ${occ.color} animate-pulse`} />
                    <div>
                        <p className={`text-sm font-semibold ${occ.text}`}>Tráfico actual: {occ.label}</p>
                        <p className="text-xs text-gray-500">Conectado a tornos de acceso</p>
                    </div>
                </div>

                {/* Quick Buy */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <Coffee className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">¿Lo de siempre?</p>
                            <p className="font-semibold text-gray-900">{quickBuy.name} — ${quickBuy.price}.00</p>
                        </div>
                    </div>
                    <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="quick_buy" />
                        <button
                            type="submit"
                            disabled={fetcher.state !== "idle"}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {fetcher.state !== "idle" ? "Pedido…" : "Pedir ahora ⚡"}
                        </button>
                    </fetcher.Form>
                </div>
            </div>

            {/* Stats Row: Streak + Credits + Classes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-orange-50 rounded-xl">
                        <Flame className="w-7 h-7 text-orange-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-gray-900">{streak}</p>
                        <p className="text-sm text-gray-500">Días de racha 🔥</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl">
                        <CreditCard className="w-7 h-7 text-purple-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-gray-900">{profile.credits}</p>
                        <p className="text-sm text-gray-500">Créditos disponibles</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <Calendar className="w-7 h-7 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-gray-900">{classesMonth}</p>
                        <p className="text-sm text-gray-500">Clases este mes</p>
                    </div>
                </div>
            </div>

            {/* Radar Chart + PRs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar / Attributes */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Tus atributos</h2>
                    <p className="text-sm text-gray-500 mb-4">Basado en tus clases recientes</p>
                    <RadarChart stats={radarStats} />
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <p className="text-sm text-blue-700">
                            <Zap className="w-4 h-4 inline mr-1" />
                            Tu nivel de <strong>{weakest[0]}</strong> está bajo ({weakest[1]}%). Prueba{" "}
                            <strong>{classSuggestions[weakest[0]] ?? "una clase nueva"}</strong> mañana.
                        </p>
                    </div>
                </div>

                {/* Personal Records */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Records personales</h2>
                            <p className="text-sm text-gray-500">Tus mejores marcas registradas</p>
                        </div>
                        {/* Add Exercise UI */}
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedExercise}
                                onChange={(e) => setSelectedExercise(e.target.value)}
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                            >
                                <option value="">Seleccionar ejercicio...</option>
                                {PREDEFINED_EXERCISES.map((ex) => (
                                    <option key={ex} value={ex} disabled={prs.some(pr => pr.exercise === ex)}>{ex}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddExercise}
                                disabled={!selectedExercise}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
                                title="Agregar ejercicio"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="font-semibold py-3 px-2">Ejercicio</th>
                                    <th className="font-semibold py-3 px-2 text-right">Marca Actual</th>
                                    <th className="font-semibold py-3 px-2 text-right">PR Anterior</th>
                                    <th className="font-semibold py-3 px-4">Historial Reciente</th>
                                    <th className="font-semibold py-3 px-2 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {prs.map((pr) => {
                                    const gain = pr.value - pr.previous;
                                    return (
                                        <tr key={pr.exercise} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-2">
                                                <p className="font-semibold text-gray-900">{pr.exercise}</p>
                                                <div className="w-24 mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-blue-500 h-full rounded-full"
                                                        style={{ width: `${Math.round((pr.value / pr.max) * 100)}%` }}
                                                    />
                                                </div>
                                            </td>
                                            {addingDataTo === pr.exercise ? (
                                                <td colSpan={4} className="py-4 px-2">
                                                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100 w-fit">
                                                        <input
                                                            type="number"
                                                            value={newDataValue}
                                                            onChange={(e) => setNewDataValue(e.target.value)}
                                                            className="w-20 bg-white border border-gray-200 text-sm rounded cursor-text focus:ring-blue-500 focus:border-blue-500 p-1.5 text-right font-medium"
                                                            placeholder={`ej. ${pr.value}`}
                                                            autoFocus
                                                        />
                                                        <span className="text-gray-500 text-xs font-semibold mr-2">{pr.unit}</span>
                                                        <button
                                                            onClick={() => handleAddData(pr.exercise)}
                                                            title="Guardar"
                                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingDataTo(null); setNewDataValue(""); }}
                                                            title="Cancelar"
                                                            className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="py-4 px-2 text-right">
                                                        <span className="text-xl font-black text-gray-900">{pr.value}</span>
                                                        <span className="text-xs text-gray-500 ml-1">{pr.unit}</span>
                                                    </td>
                                                    <td className="py-4 px-2 text-right">
                                                        {pr.previous > 0 ? (
                                                            <div>
                                                                <span className="text-gray-600 font-medium">{pr.previous}{pr.unit}</span>
                                                                {gain > 0 && <span className="text-xs text-green-600 ml-2 block">+{gain}{pr.unit} ↑</span>}
                                                            </div>
                                                        ) : <span className="text-gray-400">-</span>}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex gap-2 items-center text-xs">
                                                            <History className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                                            {pr.history.length > 0 ? pr.history.map((h, i) => (
                                                                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md border border-gray-200">
                                                                    {h.val}{pr.unit} <span className="text-gray-400 ml-1 block text-[10px] uppercase text-center">{h.date}</span>
                                                                </span>
                                                            )) : <span className="text-gray-400 italic">Sin registros</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => { setAddingDataTo(pr.exercise); setNewDataValue(""); }}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 rounded-md hover:bg-blue-50"
                                                                title="Agregar marca"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveExercise(pr.exercise)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
                                                                title="Eliminar ejercicio"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {prs.length === 0 && (
                            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-100 rounded-xl mt-4">
                                No tienes ejercicios registrados.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Medidas Físicas and Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Body Stats */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Medidas corporales</h2>
                            <p className="text-sm text-gray-500">Historial de tu progreso físico</p>
                        </div>
                        <button
                            onClick={() => setIsAddingBodyStat(!isAddingBodyStat)}
                            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isAddingBodyStat ? "bg-gray-200 text-gray-700" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                            title={isAddingBodyStat ? "Cancelar" : "Nuevo registro"}
                        >
                            {isAddingBodyStat ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="flex-1">
                        {isAddingBodyStat && (
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">Registrar nuevas medidas</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Peso (kg)</label>
                                        <div className="relative">
                                            <Scale className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
                                            <input
                                                type="number"
                                                value={newWeight}
                                                onChange={(e) => setNewWeight(e.target.value)}
                                                placeholder={bodyStats[0].weight.toString()}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Estatura (m)</label>
                                        <div className="relative">
                                            <Ruler className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
                                            <input
                                                type="number"
                                                value={newHeight}
                                                step="0.01"
                                                onChange={(e) => setNewHeight(e.target.value)}
                                                placeholder={bodyStats[0].height.toString()}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => { setIsAddingBodyStat(false); setNewWeight(""); setNewHeight(""); }}
                                        className="px-3 py-1.5 text-sm bg-white text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddBodyStat}
                                        disabled={!newWeight && !newHeight}
                                        className="px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                                <Scale className="w-6 h-6 text-blue-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">{bodyStats[0].weight} <span className="text-sm font-medium text-gray-500">kg</span></span>
                                <span className="text-xs text-gray-400 mt-1">Último peso</span>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                                <Ruler className="w-6 h-6 text-blue-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">{bodyStats[0].height} <span className="text-sm font-medium text-gray-500">m</span></span>
                                <span className="text-xs text-gray-400 mt-1">Estatura</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900">Historial</h3>
                            <div className="divide-y divide-gray-100 border border-gray-100 bg-gray-50/50 rounded-lg">
                                {bodyStats.map((stat, i) => {
                                    const prevStat = bodyStats[i + 1];
                                    let weightDiff = 0;
                                    if (prevStat) weightDiff = Number((stat.weight - prevStat.weight).toFixed(1));

                                    return (
                                        <div key={i} className="flex items-center justify-between p-3 text-sm">
                                            <span className="text-gray-500 font-medium w-20">{stat.date}</span>
                                            <div className="flex-1 text-center">
                                                <span className="font-semibold text-gray-900">{stat.weight} kg</span>
                                                {weightDiff !== 0 && (
                                                    <span className={`text-xs ml-2 ${weightDiff > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                                        {weightDiff > 0 ? '+' : ''}{weightDiff} kg
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-gray-500 text-right w-16">{stat.height}m</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Actividad reciente</h2>
                        <Link to="/dashboard/schedule" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            Ver agenda →
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {[
                            { name: "CrossFit Advanced", date: "Feb 15", amount: "-1 crédito", icon: Dumbbell },
                            { name: "Yoga Flow", date: "Feb 14", amount: "-1 crédito", icon: Activity },
                            { name: "Paquete 10 clases", date: "Feb 12", amount: "+10 créditos", icon: CreditCard },
                        ].map((item, i) => (
                            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{item.name}</p>
                                        <p className="text-sm text-gray-400">{item.date}</p>
                                    </div>
                                </div>
                                <span className={`text-sm font-semibold ${item.amount.startsWith("+") ? "text-green-600" : "text-gray-500"}`}>
                                    {item.amount}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
