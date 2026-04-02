// app/routes/onboarding/setup/studio-type.tsx
// Step 2: Studio Type selection — determines booking_mode and personalizes the rest of the flow

import { useState, useEffect } from "react";
import { useFetcher, Link, useNavigate, useRouteLoaderData } from "react-router";
import { ArrowRight, ArrowLeft, Info } from "lucide-react";
import type { Route } from "./+types/studio-type";
import type { StudioType, BookingMode } from "~/types/database";

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { saveStudioType } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);

    const formData = await request.formData();
    const studioType = formData.get("studio_type") as StudioType;

    if (!studioType) {
        return { success: false, error: "Selecciona un tipo de estudio" };
    }

    const bookingMode = await saveStudioType(gymId, studioType);
    return { success: true, bookingMode };
}

// ─── Studio Type Definitions ─────────────────────────────────────────────────

interface StudioTypeOption {
    id: StudioType;
    label: string;
    subLabel: string;
    emoji: string;
    bookingMode: BookingMode;
    bookingDesc: string;
}

const STUDIO_TYPES: StudioTypeOption[] = [
    {
        id: "pilates",
        label: "Pilates",
        subLabel: "Reformer / Equipment",
        emoji: "🧘‍♀️",
        bookingMode: "assigned_resource",
        bookingDesc: "Tus alumnos eligen su reformer al reservar. Diseñarás un mapa visual de tu sala.",
    },
    {
        id: "cycling",
        label: "Cycling",
        subLabel: "Spinning / Indoor bike",
        emoji: "🚴",
        bookingMode: "assigned_resource",
        bookingDesc: "Tus alumnos eligen su bici al reservar. Diseñarás un mapa visual de tu sala.",
    },
    {
        id: "yoga",
        label: "Yoga",
        subLabel: "Mat / Aéreo / Hot",
        emoji: "🕉️",
        bookingMode: "capacity_only",
        bookingDesc: "Reserva por capacidad. Tus alumnos ven cuántos lugares quedan disponibles.",
    },
    {
        id: "barre",
        label: "Barre",
        subLabel: "Barra / Mat",
        emoji: "🩰",
        bookingMode: "capacity_only",
        bookingDesc: "Reserva por capacidad. Sin asignación de equipo específico.",
    },
    {
        id: "hiit",
        label: "HIIT / Funcional",
        subLabel: "CrossFit / Bootcamp",
        emoji: "⚡",
        bookingMode: "capacity_or_none",
        bookingDesc: "Tú decides si hay límite de cupo o si las clases son abiertas sin restricción.",
    },
    {
        id: "martial",
        label: "Artes Marciales",
        subLabel: "Box / MMA / Karate",
        emoji: "🥋",
        bookingMode: "capacity_or_none",
        bookingDesc: "Tú decides si hay límite de cupo o no.",
    },
    {
        id: "dance",
        label: "Dance",
        subLabel: "Contemporáneo / Urbano",
        emoji: "💃",
        bookingMode: "capacity_only",
        bookingDesc: "Reserva por capacidad. Ideal para clases grupales.",
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepStudioType() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const parentData = useRouteLoaderData("routes/onboarding/setup/layout") as any;
    const [selected, setSelected] = useState<StudioType | null>(parentData?.gymInfo?.studio_type || null);

    const selectedType = STUDIO_TYPES.find(t => t.id === selected);
    const isSubmitting = fetcher.state !== "idle";

    // Navigate to next step on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/identity");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function handleSubmit() {
        if (!selected) return;
        const fd = new FormData();
        fd.set("studio_type", selected);
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    ¿Qué tipo de estudio tienes?
                </h1>
                <p className="text-white/50 max-w-lg mx-auto">
                    Esto personaliza tu dashboard, reservas y la experiencia de tus alumnos
                </p>
            </div>

            {/* Grid of studio types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STUDIO_TYPES.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setSelected(type.id)}
                        className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left group ${
                            selected === type.id
                                ? "border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/10"
                                : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">{type.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-white mb-0.5">{type.label}</h3>
                                <p className="text-xs text-white/40">{type.subLabel}</p>
                            </div>
                            {selected === type.id && (
                                <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Booking mode badge (shown when a type is selected) */}
            {selectedType && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-violet-300 mb-1">
                            Modo de reserva: {
                                selectedType.bookingMode === "assigned_resource" ? "Equipo asignado" :
                                selectedType.bookingMode === "capacity_only" ? "Por capacidad" :
                                "Capacidad opcional"
                            }
                        </p>
                        <p className="text-xs text-white/50">{selectedType.bookingDesc}</p>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <button
                    onClick={handleSubmit}
                    disabled={!selected || isSubmitting}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
                >
                    {isSubmitting ? "Guardando..." : "Siguiente"}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
