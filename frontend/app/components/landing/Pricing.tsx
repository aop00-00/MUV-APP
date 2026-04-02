// app/components/landing/Pricing.tsx
// 4-column pricing — Mensual / Trimestral / Anual toggle, Enterprise contact column.

import React, { useState } from "react";
import { Link } from "react-router";
import { Check, Sparkles, Zap, Rocket, ChevronRight, Flame } from "lucide-react";
import { ScrollReveal } from "~/components/ui/scroll-reveal";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingCycle = "monthly" | "quarterly" | "annual";

interface FeatureGroup {
    title?: string;
    features: string[];
}

interface Plan {
    id: string;
    name: string;
    icon: React.ReactNode;
    monthlyPrice: number | null; // null = contact
    quarterlyPrice: number | null;
    annualPrice: number | null;
    badge: string | null;
    desc: string;
    featureGroups: FeatureGroup[];
    cta: string;
    href: string;
    featured: boolean;
    enterprise?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
    {
        id: "emprendedor",
        name: "Emprendedor",
        icon: <Flame className="w-5 h-5" />,
        monthlyPrice: 0,
        quarterlyPrice: 0,
        annualPrice: 0,
        badge: "Sin tarjeta requerida",
        desc: "Para instructores independientes y studios que están dando sus primeros pasos en la digitalización.",
        featureGroups: [
            {
                features: [
                    "1 sede física · 10 alumnos activos",
                    "Reservas y calendario de clases",
                    "Check-in con código QR",
                    "POS básico (hasta 5 productos)",
                    "Gestión de planes y membresías",
                    "Pagos con Mercado Pago",
                    "Acceso vía projectstudio.com/tu-studio",
                    "Powered by Project Studio",
                ]
            }
        ],
        cta: "Comenzar ahora",
        href: "/onboarding?plan=emprendedor",
        featured: false,
    },
    {
        id: "starter",
        name: "Starter",
        icon: <Zap className="w-5 h-5" />,
        monthlyPrice: 999,
        quarterlyPrice: 899,
        annualPrice: 799,
        badge: "7 días de prueba gratuita",
        desc: "Para estudios pequeños o entrenadores independientes que operan su primera sede.",
        featureGroups: [
            {
                features: [
                    "1 sede física",
                    "Hasta 80 alumnos activos",
                    "Reservas y calendario de clases",
                    "Check-in con código QR",
                    "Punto de Venta (POS) básico",
                    "Pagos con Mercado Pago / Kueski Pay",
                    "Gestión de planes y membresías",
                    "App/portal para alumnos",
                    "Reportes básicos de operación",
                    "Notificaciones por email",
                ]
            }
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
        quarterlyPrice: 1889,
        annualPrice: 1679,
        badge: "Más popular",
        desc: "Para estudios boutique en crecimiento que buscan automatizar la burocracia y retener socios.",
        featureGroups: [
            {
                features: [
                    "Hasta 3 sedes · Hasta 300 alumnos",
                    "Todo lo incluido en Starter",
                    "CRM de leads y socios inactivos",
                    "Integración con Strava (Métricas)",
                    "Sesiones grabadas on-demand",
                    "FitCoins: Fidelización y lealtad",
                    "Campañas de email marketing",
                    "Automatizaciones de marketing",
                    "Notificaciones push y WhatsApp",
                    "Soporte prioritario (24h)",
                ]
            },
            {
                title: "App / Web (Tu Marca)",
                features: [
                    "30% desc. en Creación de App/Web",
                    "Diseño responsivo premium",
                    "Integración directa de reservas",
                    "Portal de clientes integrado"
                ]
            }
        ],
        cta: "Empezar Pro",
        href: "/onboarding?plan=pro",
        featured: true,
    },
    {
        id: "elite",
        name: "Elite",
        icon: <Rocket className="w-5 h-5" />,
        monthlyPrice: 4099,
        quarterlyPrice: 3689,
        annualPrice: 3279,
        badge: null,
        desc: "Para dueños que quieren que la tecnología sea una extensión de su propia marca corporativa.",
        featureGroups: [
            {
                features: [
                    "Sedes y alumnos ilimitados",
                    "Todo lo incluido en el plan Pro",
                    "Facturación automática (CFDI/SII)",
                    "Reportería financiera avanzada",
                    "Control de acceso por roles (Staff)",
                    "Integraciones con hardware",
                    "Soporte dedicado + Onboarding VIP",
                    "Migración de datos asistida",
                    "Infraestructura de alta disponibilidad",
                    "Gerente de cuenta corporativo",
                ]
            },
            {
                title: "App / Web (Tu Marca)",
                features: [
                    "50% desc. en Creación de App/Web",
                    "Diseño responsivo premium",
                    "Integración directa de reservas",
                    "Portal de clientes integrado",
                    "Prioridad de desarrollo"
                ]
            }
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
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

    const cycles: { id: BillingCycle; label: string; discount?: string }[] = [
        { id: "monthly", label: "Mensual" },
        { id: "quarterly", label: "Trimestral", discount: "Ahorra 10%" },
        { id: "annual", label: "Anual", discount: "Ahorra 20%" },
    ];

    return (
        <section id="pricing" className="py-24 px-4 text-white overflow-hidden">
            <div className="max-w-7xl mx-auto">

                {/* ── Header ── */}
                <ScrollReveal className="text-center mb-14">
                    <p className="text-white/50 font-semibold text-xs tracking-widest uppercase mb-3">
                        Precios
                    </p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white mb-4">
                        Planes que crecen
                        <br />
                        <span className="text-white/50">con tu estudio</span>
                    </h2>
                    <p className="text-white/50 text-lg max-w-xl mx-auto">
                        Comienza tu digitalización hoy.
                    </p>
                </ScrollReveal>

                {/* ── Billing Selector ── */}
                <ScrollReveal delay={0.1} className="flex justify-center mt-6 mb-16 px-4">
                    <div className="relative flex w-full max-w-md p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                        {/* Sliding highlight */}
                        <motion.div
                            className="absolute bg-white rounded-xl shadow-lg h-[calc(100%-12px)] top-[6px]"
                            initial={false}
                            animate={{
                                x: billingCycle === "monthly" ? 0 : billingCycle === "quarterly" ? "100%" : "200%",
                            }}
                            style={{ width: "calc(100% / 3 - 8px)" }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />

                        {cycles.map((cycle) => (
                            <button
                                key={cycle.id}
                                onClick={() => setBillingCycle(cycle.id)}
                                className={`relative z-10 flex-1 px-2 py-2.5 text-sm font-bold transition-colors duration-300 rounded-xl flex flex-col items-center justify-center ${billingCycle === cycle.id ? "text-black" : "text-white/40 hover:text-white/70"
                                    }`}
                            >
                                <span>{cycle.label}</span>
                                {cycle.discount && (
                                    <span className={`text-[9px] uppercase tracking-wider mt-0.5 font-black whitespace-nowrap transition-opacity duration-300 ${billingCycle === cycle.id ? "opacity-70" : "text-white/30"
                                        }`}>
                                        {cycle.discount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </ScrollReveal>
            </div>

            {/* ── Cards grid ── */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 items-stretch max-w-7xl mx-auto px-4 lg:px-8 pt-8 pb-8 md:pb-0 md:grid md:grid-cols-2 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {PLANS.map((plan, i) => (
                    <ScrollReveal
                        key={plan.id}
                        delay={0.15 + i * 0.1}
                        className="w-[85vw] shrink-0 snap-center first:ml-4 last:mr-4 md:first:ml-0 md:last:mr-0 md:w-auto h-full"
                    >
                        <PricingCard plan={plan} billingCycle={billingCycle} index={i} />
                    </ScrollReveal>
                ))}
            </div>

            {/* Mobile Swipe Hint */}
            <div className="md:hidden flex flex-col items-center gap-2 text-white/70 mt-4 h-12">
                <motion.div
                    animate={{ x: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="flex items-center gap-1"
                >
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Desliza para ver más</span>
                    <ChevronRight className="size-4" />
                </motion.div>
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
    billingCycle,
    index,
}: {
    plan: Plan;
    billingCycle: BillingCycle;
    index: number;
}) {
    const price = billingCycle === "annual"
        ? plan.annualPrice
        : billingCycle === "quarterly"
            ? plan.quarterlyPrice
            : plan.monthlyPrice;

    const cycleText = billingCycle === "annual"
        ? "cobrado anualmente"
        : billingCycle === "quarterly"
            ? "cobrado trimestralmente"
            : "";

    const fullPeriodPrice = billingCycle === "annual"
        ? (plan.annualPrice ?? 0) * 12
        : billingCycle === "quarterly"
            ? (plan.quarterlyPrice ?? 0) * 3
            : null;

    return (
        <div
            className={`relative flex flex-col h-full rounded-2xl backdrop-blur-sm p-7 transition-all duration-300 group
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
                ) : price === 0 ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-5xl font-black text-white tracking-tight">
                            $0
                        </span>
                        <span className="text-white/35 text-xs">para siempre · MXN</span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-end gap-1.5 overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={billingCycle}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="text-5xl font-black text-white tabular-nums block"
                                >
                                    {price !== null ? fmt(price) : ""}
                                </motion.span>
                            </AnimatePresence>
                            <span className="text-white/35 text-sm pb-2">MXN/mes</span>
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={billingCycle}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-white/30 text-xs mt-1"
                            >
                                {fullPeriodPrice ? `${fmt(fullPeriodPrice)} ${cycleText}` : "\u00A0"}
                            </motion.p>
                        </AnimatePresence>
                    </>
                )}
            </div>

            {/* Divider */}
            <div
                className={`w-full h-px mb-6 ${plan.featured ? "bg-white/20" : "bg-white/[0.08]"
                    }`}
            />

            {/* Features */}
            <div className="flex-1 space-y-6 mb-8">
                {plan.featureGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-3">
                        {group.title && (
                            <h4 className="text-white text-sm font-semibold mb-2">{group.title}</h4>
                        )}
                        <ul className="space-y-3">
                            {group.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm">
                                    <Check
                                        className={`w-4 h-4 mt-0.5 shrink-0 ${plan.featured ? "text-white" : "text-white/50"
                                            }`}
                                    />
                                    <span className="text-white/55 leading-snug">{f}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

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
                    to={`${plan.href}&cycle=${billingCycle}`}
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
