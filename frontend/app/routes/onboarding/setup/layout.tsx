// app/routes/onboarding/setup/layout.tsx
// Shared layout for all post-checkout onboarding steps.
// Renders: progress bar, dot indicators, ParticleBackground, and step content via <Outlet />.

import { Outlet, useLocation } from "react-router";
import ParticleBackground from "~/components/landing/ParticleBackground";
import type { Route } from "./+types/layout";
import type { BookingMode } from "~/types/database";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { getOnboardingProgress } = await import("~/services/onboarding.server");
    const { gymId, profile } = await requireGymAdmin(request);
    const progress = await getOnboardingProgress(gymId);

    // If onboarding already completed, redirect to admin
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("onboarding_completed, name, country_code, city, studio_type, plan_id")
        .eq("id", gymId)
        .single();

    if (progress.current_step >= 7) {
        if (gym?.onboarding_completed) {
            throw new Response(null, { status: 302, headers: { Location: "/admin" } });
        }
    }

    return { gymId, progress, profile, gymInfo: gym };
}

// ─── Step Configuration ──────────────────────────────────────────────────────

interface StepConfig {
    key: string;
    label: string;
    path: string;
}

const ALL_STEPS: StepConfig[] = [
    { key: "welcome", label: "Bienvenida", path: "/onboarding/setup" },
    { key: "studio-type", label: "Tipo", path: "/onboarding/setup/studio-type" },
    { key: "identity", label: "Identidad", path: "/onboarding/setup/identity" },
    { key: "room", label: "Configuración", path: "/onboarding/setup/room" },
    { key: "classes", label: "Clases", path: "/onboarding/setup/classes" },
    { key: "plans", label: "Planes", path: "/onboarding/setup/plans" },
    { key: "ready", label: "Listo", path: "/onboarding/setup/ready" },
];

function getVisibleSteps(bookingMode: BookingMode | null): StepConfig[] {
    // For capacity_only and capacity_or_none, skip the "ready" step (6 steps total)
    // For assigned_resource (pilates/cycling), show all 7 steps
    if (bookingMode === "assigned_resource") {
        return ALL_STEPS;
    }
    return ALL_STEPS.filter(s => s.key !== "ready");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingSetupLayout({ loaderData }: Route.ComponentProps) {
    const { progress } = loaderData;
    const location = useLocation();

    const steps = getVisibleSteps(progress.booking_mode);
    const currentStepIndex = steps.findIndex(s => s.path === location.pathname);
    const progressPercent = steps.length > 1
        ? ((currentStepIndex >= 0 ? currentStepIndex : 0) / (steps.length - 1)) * 100
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            <ParticleBackground />

            {/* ── Progress Bar (fixed top) ── */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white tracking-tight">Project Studio</span>
                        </div>
                        <span className="text-xs font-mono text-white/40">
                            Paso {(currentStepIndex >= 0 ? currentStepIndex : 0) + 1} de {steps.length}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Dot indicators (desktop only) */}
                    <div className="hidden md:flex items-center justify-between mt-3">
                        {steps.map((step, idx) => (
                            <div key={step.key} className="flex items-center gap-1.5">
                                <div
                                    className={`transition-all duration-300 rounded-full ${
                                        idx < (currentStepIndex >= 0 ? currentStepIndex : 0)
                                            ? "w-2 h-2 bg-emerald-400"
                                            : idx === (currentStepIndex >= 0 ? currentStepIndex : 0)
                                            ? "w-6 h-2 bg-violet-500"
                                            : "w-2 h-2 bg-white/20"
                                    }`}
                                />
                                <span
                                    className={`text-[10px] font-medium transition-colors ${
                                        idx === (currentStepIndex >= 0 ? currentStepIndex : 0)
                                            ? "text-white"
                                            : idx < (currentStepIndex >= 0 ? currentStepIndex : 0)
                                            ? "text-emerald-400/70"
                                            : "text-white/25"
                                    }`}
                                >
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="relative z-10 pt-28 md:pt-32 pb-12 px-4 md:px-6">
                <div className="max-w-3xl mx-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
