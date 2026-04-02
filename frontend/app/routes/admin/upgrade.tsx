// app/routes/admin/upgrade.tsx
// Paywall / upgrade screen shown when trial expires or user clicks "Elegir plan".
// Uses requireAuth directly (NOT requireGymAuth) to avoid redirect loop.

import React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/upgrade";
import { Zap, Sparkles, Rocket, Check, ArrowLeft } from "lucide-react";
import ParticleBackground from "~/components/landing/ParticleBackground";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireAuth } = await import("~/services/auth.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const profile = await requireAuth(request);

    if (!profile.gym_id) {
        throw new Response(null, { status: 302, headers: { Location: "/onboarding" } });
    }

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("plan_id, plan_status, trial_ends_at, name")
        .eq("id", profile.gym_id)
        .single();

    const isExpired =
        gym?.plan_status === "suspended" ||
        (gym?.plan_status === "trial" &&
            gym?.trial_ends_at &&
            new Date(gym.trial_ends_at) < new Date());

    return {
        gymName: gym?.name || "Tu Estudio",
        currentPlan: gym?.plan_id || "starter",
        isExpired,
    };
}

// ─── Plan data ────────────────────────────────────────────────────

interface UpgradePlan {
    id: string;
    name: string;
    icon: React.ReactNode;
    price: number;
    desc: string;
    features: string[];
    featured: boolean;
}

const PLANS: UpgradePlan[] = [
    {
        id: "starter",
        name: "Starter",
        icon: <Zap className="w-5 h-5" />,
        price: 999,
        desc: "Para estudios pequenos o entrenadores independientes.",
        features: [
            "1 sede fisica",
            "Hasta 80 alumnos activos",
            "Reservas y calendario de clases",
            "Check-in con codigo QR",
            "Punto de Venta (POS) basico",
            "Gestion de planes y membresias",
            "Reportes basicos de operacion",
            "Notificaciones por email",
        ],
        featured: false,
    },
    {
        id: "pro",
        name: "Pro",
        icon: <Sparkles className="w-5 h-5" />,
        price: 2099,
        desc: "Para estudios en crecimiento que buscan automatizar y retener socios.",
        features: [
            "Todo lo de Starter",
            "Hasta 3 sedes · 300 alumnos",
            "CRM de leads y socios inactivos",
            "FitCoins: Fidelizacion y lealtad",
            "Campanas de email marketing",
            "Cupones y promociones",
            "Nomina de coaches",
            "Notificaciones push y WhatsApp",
            "Soporte prioritario (24h)",
        ],
        featured: true,
    },
    {
        id: "elite",
        name: "Elite",
        icon: <Rocket className="w-5 h-5" />,
        price: 4099,
        desc: "Para cadenas y franquicias que necesitan control total.",
        features: [
            "Todo lo de Pro",
            "Sedes y alumnos ilimitados",
            "Facturacion automatica (CFDI/SII)",
            "Reporteria financiera avanzada",
            "Control de acceso por roles",
            "Integraciones con hardware",
            "Soporte dedicado + Onboarding VIP",
            "Gerente de cuenta corporativo",
        ],
        featured: false,
    },
];

// ─── Component ────────────────────────────────────────────────────

export default function UpgradePage({ loaderData }: Route.ComponentProps) {
    const { gymName, currentPlan, isExpired } = loaderData;

    return (
        <>
            <ParticleBackground />
            <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12 max-w-2xl">
                    {isExpired ? (
                        <>
                            <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                                Tu periodo de prueba ha terminado
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                                Elige un plan para continuar usando {gymName}
                            </h1>
                            <p className="text-white/50 text-lg">
                                Selecciona el plan que mejor se adapte a tu estudio. Puedes cambiar en cualquier momento.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                                Mejora tu plan
                            </h1>
                            <p className="text-white/50 text-lg">
                                Desbloquea mas funciones para hacer crecer {gymName}.
                            </p>
                        </>
                    )}
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
                    {PLANS.map((plan) => {
                        const isCurrent = plan.id === currentPlan && !isExpired;
                        return (
                            <div
                                key={plan.id}
                                className={`relative flex flex-col rounded-2xl p-7 transition-all ${plan.featured
                                        ? "border-2 border-white/40 bg-white/10 shadow-[0_0_60px_rgba(255,255,255,0.06)]"
                                        : "border border-white/10 bg-white/[0.03]"
                                    }`}
                            >
                                {plan.featured && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                        <span className="bg-white text-black text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                                            Mas popular
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2.5 mb-3">
                                    <span className="text-white/60">{plan.icon}</span>
                                    <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                                </div>

                                <p className="text-white/40 text-sm mb-4">{plan.desc}</p>

                                <div className="mb-6">
                                    <span className="text-4xl font-black text-white">
                                        ${plan.price.toLocaleString("es-MX")}
                                    </span>
                                    <span className="text-white/35 text-sm ml-1">MXN/mes</span>
                                </div>

                                <div className="w-full h-px bg-white/[0.08] mb-6" />

                                <ul className="flex-1 space-y-3 mb-8">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <Check className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />
                                            <span className="text-white/55">{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                {isCurrent ? (
                                    <div className="w-full text-center py-3 rounded-xl font-semibold text-sm border border-white/20 bg-white/5 text-white/50">
                                        Plan actual
                                    </div>
                                ) : (
                                    <button
                                        className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${plan.featured
                                                ? "bg-white text-black hover:bg-white/90"
                                                : "bg-white/5 border border-white/15 text-white hover:bg-white/10"
                                            }`}
                                    >
                                        {isExpired ? `Activar ${plan.name}` : `Cambiar a ${plan.name}`}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Back link (only if not expired) */}
                {!isExpired && (
                    <Link
                        to="/admin"
                        className="mt-8 flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al panel
                    </Link>
                )}

                <p className="text-center text-white/25 text-sm mt-8">
                    Todos los precios en MXN. Impuestos no incluidos. Puedes cancelar en cualquier momento.
                </p>
            </div>
        </>
    );
}
