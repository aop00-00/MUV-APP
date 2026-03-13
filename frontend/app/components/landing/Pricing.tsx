// app/components/landing/Pricing.tsx
// 4-column pricing — Mensual / Anual toggle, Enterprise contact column.

import { useState } from "react";
import { Link } from "react-router";
import { Check, Building2, Sparkles, Zap, Rocket } from "lucide-react";
import { ScrollReveal } from "~/components/ui/scroll-reveal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
    id: string;
    name: string;
    icon: React.ReactNode;
    monthlyPrice: number | null; // null = contact
    annualPrice: number | null;
    badge: string | null;
    desc: string;
    features: string[];
    cta: string;
    href: string;
    featured: boolean;
    enterprise?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
    {
        id: "starter",
        name: "Starter",
        icon: <Zap className="w-5 h-5" />,
        monthlyPrice: 999,
        annualPrice: 799,
        badge: null,
        desc: "Para estudios pequeños o entrenadores independientes que operan su primera sede.",
        features: [
            "1 sede física",
            "Hasta 80 alumnos activos",
            "Calendario de clases y reservas por créditos",
            "Código QR dinámico de control de acceso",
            "Punto de Venta (POS) básico",
            "Pagos con Mercado Pago",
            "Soporte por chat estándar",
        ],
        cta: "Empezar Starter",
        href: "/onboarding?plan=starter",
        featured: false,
    },
    {
        id: "pro",
        name: "Pro",
        icon: <Sparkles className="w-5 h-5" />,
        monthlyPrice: 2099,
        annualPrice: 1679,
        badge: "Más popular",
        desc: "Para estudios boutique en crecimiento que buscan automatizar la burocracia y retener socios.",
        features: [
            "Hasta 3 sedes · Alumnos ilimitados",
            "Todo lo de Starter",
            "Facturación CFDI / AFIP / SII automática",
            "FitCoins y gamificación de asistencia",
            "Reportes financieros por sede y método de pago",
            "CRM de leads y socios inactivos",
            "Soporte prioritario",
        ],
        cta: "Empezar Pro",
        href: "/onboarding?plan=pro",
        featured: true,
    },
    {
        id: "elite",
        name: "Elite",
        icon: <Rocket className="w-5 h-5" />,
        monthlyPrice: 3199,
        annualPrice: 2559,
        badge: null,
        desc: "Para dueños que quieren que la tecnología sea una extensión de su propia marca corporativa.",
        features: [
            "Sedes ilimitadas · Alumnos ilimitados",
            "Todo lo de Pro",
            "White label — logo y colores institucionales propios",
            "Onboarding personalizado para todo el staff",
            "SLA de disponibilidad 99.9% garantizado",
            "API pública",
            "Gerente de cuenta dedicado",
        ],
        cta: "Empezar Elite",
        href: "/onboarding?plan=elite",
        featured: false,
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
    return "$" + n.toLocaleString("es-MX");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Pricing() {
    const [annual, setAnnual] = useState(false);

    return (
        <section id="pricing" className="py-24 px-4 text-white overflow-hidden">
            <div className="max-w-7xl mx-auto">

                {/* ── Header ── */}
                <ScrollReveal className="text-center mb-14">
                    <p className="text-white/50 font-semibold text-xs tracking-widest uppercase mb-3">
                        Precios
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                        Planes que crecen
                        <br />
                        <span className="text-white/50">con tu estudio</span>
                    </h2>
                    <p className="text-white/50 text-lg max-w-xl mx-auto">
                        7 días de prueba gratuita.
                    </p>
                </ScrollReveal>

                {/* ── Billing toggle ── */}
                <ScrollReveal delay={0.1} className="flex items-center justify-center gap-4 mt-6 mb-16">
                    <span
                        className={`text-sm font-medium transition-colors duration-200 ${!annual ? "text-white" : "text-white/35"
                            }`}
                    >
                        Mensual
                    </span>

                    <button
                        id="billing-toggle"
                        aria-label="Cambiar a facturación anual"
                        onClick={() => setAnnual((v) => !v)}
                        className="relative w-14 h-7 rounded-full border border-white/20 bg-white/10 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <span
                            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${annual ? "left-8" : "left-1"
                                }`}
                        />
                    </button>

                    <div className="flex items-center gap-2">
                        <span
                            className={`text-sm font-medium transition-colors duration-200 ${annual ? "text-white" : "text-white/35"
                                }`}
                        >
                            Anual
                        </span>
                        <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-all duration-300 ${annual
                                ? "bg-white text-black border-transparent"
                                : "bg-white/5 border-white/10 text-white/40"
                                }`}
                        >
                            Ahorra 20%
                        </span>
                    </div>
                </ScrollReveal>
            </div>

            {/* ── Cards grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start max-w-6xl mx-auto">
                {PLANS.map((plan, i) => (
                    <ScrollReveal key={plan.id} delay={0.15 + i * 0.1}>
                        <PricingCard plan={plan} annual={annual} index={i} />
                    </ScrollReveal>
                ))}
            </div>

            {/* ── Footer note ── */}
            <p className="text-center text-white/25 text-sm mt-12">
                Todos los precios en MXN. Impuestos no incluidos.
            </p>
        </section >
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function PricingCard({
    plan,
    annual,
    index,
}: {
    plan: Plan;
    annual: boolean;
    index: number;
}) {
    const price = annual ? plan.annualPrice : plan.monthlyPrice;

    return (
        <div
            className={`relative flex flex-col rounded-2xl backdrop-blur-sm p-7 transition-all duration-300 group
        ${plan.featured
                    ? "border-2 border-white/40 bg-white/10 shadow-[0_0_60px_rgba(255,255,255,0.06)]"
                    : plan.enterprise
                        ? "border border-dashed border-white/20 bg-white/[0.025] hover:border-white/30 hover:bg-white/[0.04]"
                        : "border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
            style={{
                animationDelay: `${index * 80}ms`,
            }}
        >
            {/* Popular badge */}
            {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-white text-black text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                        {plan.badge}
                    </span>
                </div>
            )}

            {/* Icon + name */}
            <div className="flex items-center gap-2.5 mb-4">
                <span
                    className={`${plan.featured
                        ? "text-white"
                        : plan.enterprise
                            ? "text-white/50"
                            : "text-white/60"
                        }`}
                >
                    {plan.icon}
                </span>
                <h3 className="text-white font-bold text-lg">{plan.name}</h3>
            </div>

            {/* Description */}
            <p className="text-white/40 text-sm leading-relaxed mb-6">{plan.desc}</p>

            {/* Price block */}
            <div className="mb-6 min-h-[4.5rem]">
                {plan.enterprise ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-4xl font-black text-white tracking-tight">
                            A medida
                        </span>
                        <span className="text-white/35 text-xs">
                            Cotización personalizada
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-1.5">
                            <span
                                className="text-5xl font-black text-white tabular-nums transition-all duration-300"
                                key={annual ? "annual" : "monthly"}
                            >
                                {price !== null ? fmt(price) : ""}
                            </span>
                            <span className="text-white/35 text-sm pb-2">MXN/mes</span>
                        </div>
                        <p
                            className={`text-white/30 text-xs mt-1 transition-opacity duration-300 ${annual ? "opacity-100" : "opacity-0"
                                }`}
                        >
                            {plan.annualPrice !== null
                                ? `${fmt(plan.annualPrice * 12)} cobrado anualmente`
                                : ""}
                        </p>
                    </>
                )}
            </div>

            {/* Divider */}
            <div
                className={`w-full h-px mb-6 ${plan.featured ? "bg-white/20" : "bg-white/[0.08]"
                    }`}
            />

            {/* Features */}
            <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                        <Check
                            className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? "text-white" : "text-white/50"
                                }`}
                        />
                        <span className="text-white/55 leading-snug">{f}</span>
                    </li>
                ))}
            </ul>

            {/* CTA */}
            {plan.enterprise ? (
                <a
                    href={plan.href}
                    className="w-full text-center py-3 rounded-xl font-semibold text-sm border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 active:scale-[0.98]"
                >
                    {plan.cta}
                </a>
            ) : (
                <Link
                    to={plan.href}
                    className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${plan.featured
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-white/5 border border-white/15 text-white hover:bg-white/10"
                        }`}
                >
                    {plan.cta}
                </Link>
            )}
        </div>
    );
}
