// app/routes/onboarding/setup/plans.tsx
// Step 6: Membership Plans — Create up to 4 plans for members
// This step is OPTIONAL — user can skip and add plans later from admin panel

import { useState, useEffect } from "react";
import { useFetcher, Link, useNavigate, useRouteLoaderData } from "react-router";
import { ArrowRight, ArrowLeft, Plus, X, DollarSign } from "lucide-react";
import type { Route } from "./+types/plans";
import type { BookingMode } from "~/types/database";

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { updateOnboardingStep, completeOnboarding } = await import("~/services/onboarding.server");
    const { gymId } = await requireGymAdmin(request);

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "skip" || intent === "save") {
        // Save plans if provided
        if (intent === "save") {
            const plansJson = formData.get("plans") as string;
            const plans: PlanFormData[] = JSON.parse(plansJson || "[]");

            // Billing type mapping
            const billingTypeMap: Record<string, string> = {
                monthly: "recurring_monthly",
                pack: "class_pack",
                single: "drop_in",
            };

            for (const plan of plans) {
                if (!plan.name?.trim()) continue;

                await supabaseAdmin.from("memberships").insert({
                    gym_id: gymId,
                    name: plan.name.trim(),
                    price: plan.price || 0,
                    billing_type: billingTypeMap[plan.type] || "recurring_monthly",
                    credits_included: plan.type === "pack" ? (plan.classCount || 8) : null,
                    is_active: true,
                });
            }
        }

        // Check booking_mode to determine next step
        const { data: gym } = await supabaseAdmin
            .from("gyms")
            .select("booking_mode")
            .eq("id", gymId)
            .single();

        // For assigned_resource: go to "ready" step (7 total steps)
        // For others: complete onboarding here (6 total steps)
        if (gym?.booking_mode === "assigned_resource") {
            await updateOnboardingStep(gymId, 6);
            return { success: true, nextStep: "ready" };
        } else {
            await completeOnboarding(gymId);
            return { success: true, nextStep: "admin" };
        }
    }

    return { success: false };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanFormData {
    name: string;
    price: number;
    type: "monthly" | "pack" | "single";
    classCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_TYPES = [
    { id: "monthly" as const, label: "Mensual", desc: "Cobro recurrente cada mes" },
    { id: "pack" as const, label: "Paquete de clases", desc: "X clases por compra" },
    { id: "single" as const, label: "Clase individual", desc: "Pago por clase" },
];

const EMPTY_PLAN: PlanFormData = { name: "", price: 0, type: "monthly", classCount: 8 };

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepPlans() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const parentData = useRouteLoaderData("routes/onboarding/setup/layout") as any;
    const bookingMode = parentData?.progress?.booking_mode as BookingMode;

    const [plans, setPlans] = useState<PlanFormData[]>([{ ...EMPTY_PLAN }]);
    const isSubmitting = fetcher.state !== "idle";

    // Navigate on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            if (fetcher.data.nextStep === "ready") {
                navigate("/onboarding/setup/ready");
            } else {
                navigate("/admin");
            }
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function updatePlan(index: number, field: keyof PlanFormData, value: any) {
        setPlans(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }

    function addPlan() {
        if (plans.length < 4) {
            setPlans(prev => [...prev, { ...EMPTY_PLAN }]);
        }
    }

    function removePlan(index: number) {
        setPlans(prev => prev.filter((_, i) => i !== index));
    }

    function handleSubmit() {
        const fd = new FormData();
        fd.set("intent", "save");
        fd.set("plans", JSON.stringify(plans.filter(p => p.name.trim())));
        fetcher.submit(fd, { method: "post" });
    }

    function handleSkip() {
        const fd = new FormData();
        fd.set("intent", "skip");
        fetcher.submit(fd, { method: "post" });
    }

    // Determine if this is the last step (for non-assigned_resource modes)
    const isLastStep = bookingMode !== "assigned_resource";
    const nextButtonText = isLastStep ? "Ir a mi dashboard" : "Siguiente";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Planes para tus alumnos
                </h1>
                <p className="text-white/50">
                    Define las membresías o paquetes que ofreces. Puedes ajustarlos después.
                </p>
            </div>

            {/* Plan Cards */}
            <div className="space-y-4">
                {plans.map((plan, idx) => (
                    <div
                        key={idx}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white/30 uppercase tracking-wider">
                                Plan {idx + 1}
                            </span>
                            {plans.length > 1 && (
                                <button
                                    onClick={() => removePlan(idx)}
                                    className="text-white/30 hover:text-red-400 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Name + Price */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5">Nombre del plan</label>
                                <input
                                    type="text"
                                    value={plan.name}
                                    onChange={(e) => updatePlan(idx, "name", e.target.value)}
                                    placeholder="Ej: Mensual ilimitado"
                                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5">Precio (MXN)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type="number"
                                        min={0}
                                        value={plan.price || ""}
                                        onChange={(e) => updatePlan(idx, "price", parseInt(e.target.value) || 0)}
                                        placeholder="1200"
                                        className="w-full pl-8 pr-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Plan Type Pills */}
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Tipo</label>
                            <div className="flex flex-wrap gap-2">
                                {PLAN_TYPES.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => updatePlan(idx, "type", type.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            plan.type === type.id
                                                ? "bg-violet-500/30 text-violet-300 border border-violet-500/40"
                                                : "bg-white/[0.06] text-white/40 border border-white/[0.08] hover:border-white/20"
                                        }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Class count (only for pack type) */}
                        {plan.type === "pack" && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <label className="block text-xs text-white/50 mb-1.5">Número de clases</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={plan.classCount}
                                    onChange={(e) => updatePlan(idx, "classCount", parseInt(e.target.value) || 1)}
                                    className="w-24 px-3 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-sm focus:border-violet-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add plan button */}
            {plans.length < 4 && (
                <button
                    onClick={addPlan}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-white/[0.12] text-white/40 text-sm font-medium flex items-center justify-center gap-2 hover:border-white/25 hover:text-white/60 transition-all"
                >
                    <Plus className="w-4 h-4" /> Agregar plan
                </button>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/classes"
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
                        {isSubmitting ? "Guardando..." : nextButtonText}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
