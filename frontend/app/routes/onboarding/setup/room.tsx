// app/routes/onboarding/setup/room.tsx
// Step 4: Room Setup — ADAPTIVE based on booking_mode
// - assigned_resource (Pilates/Cycling): Grid layout editor for equipment
// - capacity_only (Yoga/Barre/Dance): Capacity slider
// - capacity_or_none (HIIT/Martial): Toggle limit + optional slider

import { useState, useEffect, useCallback } from "react";
import { useFetcher, Link, useNavigate, useRouteLoaderData } from "react-router";
import { ArrowRight, ArrowLeft, Grid3X3, Users, Infinity } from "lucide-react";
import type { Route } from "./+types/room";
import type { BookingMode, StudioType } from "~/types/database";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { getOnboardingProgress } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);
    const progress = await getOnboardingProgress(gymId);

    return {
        gymId,
        bookingMode: progress.booking_mode,
        studioType: progress.studio_type,
    };
}

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { saveRoomLayout, saveCapacitySettings, updateOnboardingStep } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "save_layout") {
        const layoutJson = formData.get("layout") as string;
        const layout = JSON.parse(layoutJson);
        await saveRoomLayout(gymId, null, layout);
        return { success: true };
    }

    if (intent === "save_capacity") {
        const capacity = parseInt(formData.get("capacity") as string, 10) || 15;
        const hasLimit = formData.get("has_limit") === "true";
        await saveCapacitySettings(gymId, { default_capacity: capacity, has_capacity_limit: hasLimit });
        return { success: true };
    }

    // "skip" — just advance the step
    await updateOnboardingStep(gymId, 4);
    return { success: true };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StepRoom({ loaderData }: Route.ComponentProps) {
    const { bookingMode, studioType } = loaderData;

    if (bookingMode === "assigned_resource") {
        return <LayoutEditorView studioType={studioType} />;
    }

    if (bookingMode === "capacity_or_none") {
        return <CapacityToggleView />;
    }

    return <CapacitySliderView />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW A: Layout Editor (Pilates / Cycling)
// ═══════════════════════════════════════════════════════════════════════════════

function LayoutEditorView({ studioType }: { studioType: StudioType | null }) {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();

    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(4);
    const [machines, setMachines] = useState<Record<string, boolean>>({});

    const isCycling = studioType === "cycling";
    const resourceName = isCycling ? "Bici" : "Reformer";
    const topLabel = isCycling ? "INSTRUCTOR" : "ESPEJO";
    const isSubmitting = fetcher.state !== "idle";

    // Count active machines
    const activeCount = Object.values(machines).filter(Boolean).length;

    // Reset grid when rows/cols change
    useEffect(() => {
        setMachines({});
    }, [rows, cols]);

    // Navigate on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/classes");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function toggleCell(r: number, c: number) {
        const key = `${r}-${c}`;
        setMachines(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function fillAll() {
        const all: Record<string, boolean> = {};
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                all[`${r}-${c}`] = true;
            }
        }
        setMachines(all);
    }

    function clearAll() {
        setMachines({});
    }

    function getResourceName(r: number, c: number): string {
        // Count active cells before this one (top-to-bottom, left-to-right)
        let count = 0;
        for (let ri = 0; ri < rows; ri++) {
            for (let ci = 0; ci < cols; ci++) {
                if (ri === r && ci === c) return `${resourceName} ${count + 1}`;
                if (machines[`${ri}-${ci}`]) count++;
            }
        }
        return `${resourceName} ${count + 1}`;
    }

    function handleSubmit() {
        // Build resources array
        const resources: any[] = [];
        let idx = 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (machines[`${r}-${c}`]) {
                    resources.push({
                        id: `temp-${r}-${c}`,
                        name: `${resourceName} ${idx}`,
                        type: isCycling ? "bike" : "reformer",
                        row: r,
                        col: c,
                    });
                    idx++;
                }
            }
        }

        const layout = { rows, cols, resources };
        const fd = new FormData();
        fd.set("intent", "save_layout");
        fd.set("layout", JSON.stringify(layout));
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Diseña tu sala
                </h1>
                <p className="text-white/50">
                    Coloca tus {resourceName.toLowerCase()}s. Tus alumnos verán este mapa al reservar.
                </p>
            </div>

            {/* Grid controls */}
            <div className="flex items-center gap-4 justify-center">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-white/50 font-medium">Filas</label>
                    <input
                        type="number"
                        min={1}
                        max={6}
                        value={rows}
                        onChange={(e) => setRows(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 px-3 py-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-center text-sm focus:border-violet-500/50 focus:outline-none"
                    />
                </div>
                <span className="text-white/20">×</span>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-white/50 font-medium">Columnas</label>
                    <input
                        type="number"
                        min={1}
                        max={8}
                        value={cols}
                        onChange={(e) => setCols(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 px-3 py-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-center text-sm focus:border-violet-500/50 focus:outline-none"
                    />
                </div>
                <div className="flex gap-2 ml-4">
                    <button
                        onClick={fillAll}
                        className="px-3 py-2 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/30 transition-colors"
                    >
                        Llenar todo
                    </button>
                    <button
                        onClick={clearAll}
                        className="px-3 py-2 text-xs font-medium bg-white/[0.06] text-white/50 border border-white/[0.08] rounded-lg hover:bg-white/10 transition-colors"
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                {/* Top label */}
                <div className="text-center mb-4">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                        {topLabel}
                    </span>
                    <div className="h-px bg-white/[0.08] mt-2" />
                </div>

                {/* Grid */}
                <div
                    className="grid gap-2 mb-4"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                    {Array.from({ length: rows }).map((_, r) =>
                        Array.from({ length: cols }).map((_, c) => {
                            const key = `${r}-${c}`;
                            const isActive = !!machines[key];
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleCell(r, c)}
                                    className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-200 text-xs ${
                                        isActive
                                            ? "bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30"
                                            : "bg-white/[0.03] border-2 border-dashed border-white/[0.12] text-white/25 hover:border-white/30 hover:bg-white/[0.06]"
                                    }`}
                                >
                                    {isActive ? (
                                        <span className="font-bold text-[10px] leading-tight text-center px-1">
                                            {getResourceName(r, c)}
                                        </span>
                                    ) : (
                                        <span className="text-lg">+</span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Bottom label */}
                <div className="text-center mt-4">
                    <div className="h-px bg-white/[0.08] mb-2" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                        ENTRADA
                    </span>
                </div>
            </div>

            {/* Counter */}
            <p className="text-center text-sm text-white/40">
                <span className="text-white font-bold">{activeCount}</span> {resourceName.toLowerCase()}(s) configurado(s) de {rows * cols} espacios
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/identity"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <button
                    onClick={handleSubmit}
                    disabled={activeCount === 0 || isSubmitting}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
                >
                    {isSubmitting ? "Guardando..." : "Siguiente"}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW B: Capacity Slider (Yoga / Barre / Dance)
// ═══════════════════════════════════════════════════════════════════════════════

function CapacitySliderView() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const [capacity, setCapacity] = useState(20);
    const isSubmitting = fetcher.state !== "idle";

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/classes");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function handleSubmit() {
        const fd = new FormData();
        fd.set("intent", "save_capacity");
        fd.set("capacity", String(capacity));
        fd.set("has_limit", "true");
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Capacidad por clase
                </h1>
                <p className="text-white/50">
                    ¿Cuántos alumnos caben por clase?
                </p>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
                {/* Big number */}
                <div className="text-7xl font-black text-white mb-6">{capacity}</div>
                <p className="text-sm text-white/40 mb-6">alumnos por clase</p>

                {/* Slider */}
                <div className="relative px-4">
                    <input
                        type="range"
                        min={5}
                        max={50}
                        value={capacity}
                        onChange={(e) => setCapacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/30"
                    />
                    <div className="flex justify-between text-xs text-white/25 mt-2">
                        <span>5</span>
                        <span>50</span>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-3">
                    Así lo verán tus alumnos
                </p>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-white">Flow Matutino</p>
                        <p className="text-xs text-white/40">Lun 07:00 — Coach Ana</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{capacity} de {capacity} lugares</p>
                        <button className="mt-1 px-4 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg">
                            Reservar
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/identity"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

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
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW C: Capacity Toggle (HIIT / Martial Arts)
// ═══════════════════════════════════════════════════════════════════════════════

function CapacityToggleView() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const [hasLimit, setHasLimit] = useState<boolean | null>(null);
    const [capacity, setCapacity] = useState(20);
    const isSubmitting = fetcher.state !== "idle";

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/classes");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function handleSubmit() {
        if (hasLimit === null) return;
        const fd = new FormData();
        fd.set("intent", "save_capacity");
        fd.set("capacity", String(hasLimit ? capacity : 0));
        fd.set("has_limit", String(hasLimit));
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Configuración de clases
                </h1>
                <p className="text-white/50">
                    ¿Tus clases tienen límite de cupo?
                </p>
            </div>

            {/* Two option cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: With limit */}
                <button
                    onClick={() => setHasLimit(true)}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                        hasLimit === true
                            ? "border-violet-500 bg-violet-500/15"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
                    }`}
                >
                    <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center mb-3">
                        <Users className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Con límite de capacidad</h3>
                    <p className="text-xs text-white/40">Controla cuántos alumnos pueden reservar</p>
                </button>

                {/* Option 2: No limit */}
                <button
                    onClick={() => setHasLimit(false)}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                        hasLimit === false
                            ? "border-violet-500 bg-violet-500/15"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"
                    }`}
                >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
                        <Infinity className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Sin límite</h3>
                    <p className="text-xs text-white/40">Las reservas quedan abiertas sin restricción de cupo</p>
                </button>
            </div>

            {/* Conditional capacity slider */}
            {hasLimit === true && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-white">Capacidad máxima</label>
                        <span className="text-2xl font-black text-white">{capacity}</span>
                    </div>
                    <input
                        type="range"
                        min={5}
                        max={50}
                        value={capacity}
                        onChange={(e) => setCapacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                    />
                    <div className="flex justify-between text-xs text-white/25 mt-2">
                        <span>5</span>
                        <span>50</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/identity"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <button
                    onClick={handleSubmit}
                    disabled={hasLimit === null || isSubmitting}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
                >
                    {isSubmitting ? "Guardando..." : "Siguiente"}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
