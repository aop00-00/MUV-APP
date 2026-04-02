// app/routes/onboarding/setup/ready.tsx
// Step 7: Ready — Final confirmation screen (only for assigned_resource mode)
// Shows summary of all configured items and redirects to /admin on completion

import { useEffect } from "react";
import { useFetcher, Link, useNavigate } from "react-router";
import { CheckCircle2, ArrowRight, ArrowLeft, Building2, Palette, Grid3X3, Calendar, CreditCard, Sparkles } from "lucide-react";
import type { Route } from "./+types/ready";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);

    // Fetch gym info and related counts for summary
    const [gymResult, classCountResult, planCountResult, resourceCountResult] = await Promise.all([
        supabaseAdmin
            .from("gyms")
            .select("name, studio_type, booking_mode, brand_color, default_capacity, layout_config, country, city")
            .eq("id", gymId)
            .single(),
        supabaseAdmin
            .from("class_types")
            .select("id", { count: "exact", head: true })
            .eq("gym_id", gymId),
        supabaseAdmin
            .from("memberships")
            .select("id", { count: "exact", head: true })
            .eq("gym_id", gymId),
        supabaseAdmin
            .from("resources")
            .select("id", { count: "exact", head: true })
            .eq("gym_id", gymId),
    ]);

    const gym = gymResult.data;
    const studioTypeLabels: Record<string, string> = {
        pilates: "Pilates",
        cycling: "Cycling",
        yoga: "Yoga",
        barre: "Barre",
        hiit: "HIIT / Funcional",
        martial: "Artes Marciales",
        dance: "Dance",
    };

    return {
        gymName: gym?.name || "Mi Estudio",
        studioType: gym?.studio_type || "pilates",
        studioTypeLabel: studioTypeLabels[gym?.studio_type || ""] || "Estudio",
        brandColor: gym?.brand_color || "#7c3aed",
        country: gym?.country || "",
        city: gym?.city || "",
        layoutConfig: gym?.layout_config || {},
        classCount: classCountResult.count || 0,
        planCount: planCountResult.count || 0,
        resourceCount: resourceCountResult.count || 0,
    };
}

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { completeOnboarding } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);

    await completeOnboarding(gymId);
    return { success: true };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepReady({ loaderData }: Route.ComponentProps) {
    const {
        gymName,
        studioTypeLabel,
        brandColor,
        country,
        city,
        layoutConfig,
        classCount,
        planCount,
        resourceCount,
    } = loaderData;

    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const isSubmitting = fetcher.state !== "idle";

    // Navigate to admin on completion
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/admin");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function handleComplete() {
        const fd = new FormData();
        fd.set("intent", "complete");
        fetcher.submit(fd, { method: "post" });
    }

    // Render summary items
    const summaryItems = [
        {
            icon: Building2,
            label: "Estudio",
            value: gymName,
            done: !!gymName,
        },
        {
            icon: Sparkles,
            label: "Tipo",
            value: studioTypeLabel,
            done: true,
        },
        {
            icon: Palette,
            label: "Marca",
            value: "Configurada",
            done: true,
            color: brandColor,
        },
        {
            icon: Grid3X3,
            label: "Equipos",
            value: resourceCount > 0 ? `${resourceCount} configurado(s)` : "Ninguno",
            done: resourceCount > 0,
        },
        {
            icon: Calendar,
            label: "Clases",
            value: classCount > 0 ? `${classCount} creada(s)` : "Ninguna",
            done: classCount > 0,
        },
        {
            icon: CreditCard,
            label: "Planes",
            value: planCount > 0 ? `${planCount} creado(s)` : "Ninguno",
            done: planCount > 0,
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Studio Logo + Title */}
            <div className="text-center">
                {/* Logo initial */}
                <div
                    className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white font-black text-3xl shadow-lg"
                    style={{ backgroundColor: brandColor }}
                >
                    {gymName.charAt(0).toUpperCase()}
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    {gymName} está listo
                </h1>
                <p className="text-white/50">
                    Tu dashboard está personalizado para {studioTypeLabel}
                </p>
            </div>

            {/* Summary checklist */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-3">
                {summaryItems.map((item) => (
                    <div
                        key={item.label}
                        className="flex items-center gap-4 py-2"
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.done ? "bg-emerald-500/20" : "bg-white/[0.06]"
                        }`}>
                            {item.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <item.icon className="w-4 h-4 text-white/30" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-xs text-white/40 font-medium">{item.label}</span>
                            <p className="text-sm font-medium text-white truncate">
                                {item.value}
                            </p>
                        </div>
                        {item.color && (
                            <div
                                className="w-5 h-5 rounded-md shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Layout preview (if resources exist) */}
            {resourceCount > 0 && (layoutConfig as any)?.rows && (layoutConfig as any)?.cols && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-3">
                        Layout de tu sala
                    </p>
                    <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${(layoutConfig as any).cols}, 1fr)` }}
                    >
                        {(layoutConfig as any).resources?.map((r: any, i: number) => (
                            <div
                                key={i}
                                className="aspect-square bg-emerald-500/20 border border-emerald-500/30 rounded flex items-center justify-center"
                            >
                                <span className="text-[8px] text-emerald-300 font-bold">{r.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Success badge */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-sm font-bold text-emerald-400">
                    Tu estudio está listo para recibir reservas
                </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/plans"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/25"
                >
                    {isSubmitting ? "Finalizando..." : "Ir a mi dashboard"}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
