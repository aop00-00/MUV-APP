// app/routes/onboarding/setup/classes.tsx
// Step 5: First Classes — Create up to 3 class types with coach, time, and days
// This step is OPTIONAL — user can skip and add classes later from admin panel

import { useState, useEffect } from "react";
import { useFetcher, Link, useNavigate, useRouteLoaderData } from "react-router";
import { ArrowRight, ArrowLeft, Plus, X, Clock } from "lucide-react";
import type { Route } from "./+types/classes";

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { updateOnboardingStep } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    // Skip — just advance the step
    if (intent === "skip") {
        await updateOnboardingStep(gymId, 5);
        return { success: true };
    }

    // Save classes
    const classesJson = formData.get("classes") as string;
    const classes: ClassFormData[] = JSON.parse(classesJson || "[]");

    for (const cls of classes) {
        if (!cls.name?.trim()) continue;

        // 1. Create or find coach
        let coachId: string | null = null;
        if (cls.coachName?.trim()) {
            const { data: existingCoach } = await supabaseAdmin
                .from("coaches")
                .select("id")
                .eq("gym_id", gymId)
                .eq("name", cls.coachName.trim())
                .single();

            if (existingCoach) {
                coachId = existingCoach.id;
            } else {
                const { data: newCoach } = await supabaseAdmin
                    .from("coaches")
                    .insert({ gym_id: gymId, name: cls.coachName.trim(), status: "active" })
                    .select("id")
                    .single();
                coachId = newCoach?.id || null;
            }
        }

        // 2. Create class_type
        const { data: classType } = await supabaseAdmin
            .from("class_types")
            .insert({
                gym_id: gymId,
                name: cls.name.trim(),
            })
            .select("id")
            .single();

        if (!classType) continue;

        // 3. Create schedules for each selected day
        const dayMap: Record<string, number> = {
            Lun: 1, Mar: 2, Mié: 3, Jue: 4, Vie: 5, Sáb: 6, Dom: 0,
        };

        for (const day of cls.days) {
            const dayNumber = dayMap[day];
            if (dayNumber === undefined) continue;

            await supabaseAdmin.from("schedules").insert({
                gym_id: gymId,
                class_type_id: classType.id,
                coach_id: coachId,
                day_of_week: dayNumber,
                start_time: cls.time || "07:00",
                end_time: addHour(cls.time || "07:00"),
                is_active: true,
            });
        }
    }

    await updateOnboardingStep(gymId, 5);
    return { success: true };
}

function addHour(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const newH = (h + 1) % 24;
    return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassFormData {
    name: string;
    coachName: string;
    time: string;
    days: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PLACEHOLDER_MAP: Record<string, string> = {
    pilates: "Ej: Reformer Intermedio",
    cycling: "Ej: Power Ride",
    yoga: "Ej: Flow Matutino",
    hiit: "Ej: WOD Express",
    barre: "Ej: Barre Sculpt",
    martial: "Ej: Box Cardio",
    dance: "Ej: Hip Hop Basics",
};

const EMPTY_CLASS: ClassFormData = { name: "", coachName: "", time: "07:00", days: [] };

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepClasses() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const parentData = useRouteLoaderData("routes/onboarding/setup/layout") as any;

    const studioType = parentData?.progress?.studio_type || "";
    const placeholder = PLACEHOLDER_MAP[studioType] || "Ej: Mi Clase";

    const [classes, setClasses] = useState<ClassFormData[]>([{ ...EMPTY_CLASS }]);
    const isSubmitting = fetcher.state !== "idle";

    // Navigate on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/plans");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function updateClass(index: number, field: keyof ClassFormData, value: any) {
        setClasses(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }

    function toggleDay(index: number, day: string) {
        setClasses(prev => {
            const updated = [...prev];
            const cls = updated[index];
            const days = cls.days.includes(day)
                ? cls.days.filter(d => d !== day)
                : [...cls.days, day];
            updated[index] = { ...cls, days };
            return updated;
        });
    }

    function addClass() {
        if (classes.length < 3) {
            setClasses(prev => [...prev, { ...EMPTY_CLASS }]);
        }
    }

    function removeClass(index: number) {
        setClasses(prev => prev.filter((_, i) => i !== index));
    }

    function handleSubmit() {
        const fd = new FormData();
        fd.set("intent", "save");
        fd.set("classes", JSON.stringify(classes.filter(c => c.name.trim())));
        fetcher.submit(fd, { method: "post" });
    }

    function handleSkip() {
        const fd = new FormData();
        fd.set("intent", "skip");
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Crea tu primera clase
                </h1>
                <p className="text-white/50">
                    Puedes agregar más después. Esto te da un punto de partida.
                </p>
            </div>

            {/* Class Cards */}
            <div className="space-y-4">
                {classes.map((cls, idx) => (
                    <div
                        key={idx}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
                                Clase {idx + 1}
                            </span>
                            {classes.length > 1 && (
                                <button
                                    onClick={() => removeClass(idx)}
                                    className="text-white/30 hover:text-red-400 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Name + Coach */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5">Nombre de la clase</label>
                                <input
                                    type="text"
                                    value={cls.name}
                                    onChange={(e) => updateClass(idx, "name", e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5">Coach</label>
                                <input
                                    type="text"
                                    value={cls.coachName}
                                    onChange={(e) => updateClass(idx, "coachName", e.target.value)}
                                    placeholder="Ej: Ana García"
                                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Time */}
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Hora
                            </label>
                            <input
                                type="time"
                                value={cls.time}
                                onChange={(e) => updateClass(idx, "time", e.target.value)}
                                className="w-32 px-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm focus:border-violet-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Days */}
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Días</label>
                            <div className="flex flex-wrap gap-2">
                                {DAYS.map((day) => (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(idx, day)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            cls.days.includes(day)
                                                ? "bg-violet-500/30 text-violet-300 border border-violet-500/40"
                                                : "bg-white/[0.06] text-white/40 border border-white/[0.08] hover:border-white/20"
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add class button */}
            {classes.length < 3 && (
                <button
                    onClick={addClass}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-white/[0.12] text-white/40 text-sm font-medium flex items-center justify-center gap-2 hover:border-white/25 hover:text-white/60 transition-all"
                >
                    <Plus className="w-4 h-4" /> Agregar otra clase
                </button>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/room"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSkip}
                        disabled={isSubmitting}
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                        Omitir por ahora
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
                    >
                        {isSubmitting ? "Guardando..." : "Siguiente"}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
