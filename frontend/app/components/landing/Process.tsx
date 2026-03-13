// app/components/landing/Process.tsx
// Scroll-driven timeline: the card closest to the top-third of the viewport expands.
// Adapted from ruixenui TimeLine_01. Removed next/link, 'use client', shadcn imports.

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Package, Settings, Users, Rocket } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { ScrollReveal } from "~/components/ui/scroll-reveal";

// ── Entry type ─────────────────────────────────────────────────
type Entry = {
    icon: React.ComponentType<{ className?: string }>;
    step: string;
    title: string;
    subtitle: string;
    description: string;
    items: string[];
    button?: { to: string; text: string };
};

// ── Grind Project onboarding steps ─────────────────────────────
const ENTRIES: Entry[] = [
    {
        icon: Package,
        step: "01",
        title: "Elige tu plan",
        subtitle: "Starter, Pro o Elite · 7 días gratis",
        description:
            "Sin tarjeta de crédito ni contratos forzosos. Elige el plan que se adapte al tamaño actual de tu estudio y escala cuando lo necesites. Puedes cambiar de plan en cualquier momento desde tu panel.",
        items: [
            "Starter — hasta 1 sede y 80 alumnas activas, ideal para estudios que arrancan",
            "Pro — hasta 3 sedes, alumnas ilimitadas, facturación fiscal y CRM de leads",
            "Elite — sedes ilimitadas, API pública, marca blanca y gerente de cuenta dedicado",
            "Todos los planes incluyen 7 días de prueba gratuita completa",
            "Sin penalizaciones si decides cancelar en cualquier momento",
        ],
        button: { to: "/onboarding", text: "Ver planes y precios" },
    },
    {
        icon: Settings,
        step: "02",
        title: "Configura tu estudio",
        subtitle: "Listo en menos de 10 minutos",
        description:
            "El asistente de configuración te guía paso a paso. Ingresa el nombre del estudio, carga tu paleta de colores y logotipo, define los tipos de clase que ofreces, establece horarios, capacidades y precios. No necesitas apoyo técnico.",
        items: [
            "Carga tu logotipo y define la paleta de color de tu marca",
            "Crea tipos de clase: Pilates Mat, Reformer, Barre, Yoga Ashtanga, CrossFit, etc.",
            "Define horarios recurrentes o sesiones únicas con control de cupos por clase",
            "Configura métodos de pago: Mercado Pago, Kushki, Conekta o SPEI",
            "Activa la facturación fiscal automática (CFDI 4.0 / AFIP / SII según tu país)",
            "Conecta el lector de acceso QR o torniquete si cuentas con control físico",
        ],
    },
    {
        icon: Users,
        step: "03",
        title: "Invita a tu equipo",
        subtitle: "Roles diferenciados por función",
        description:
            "Cada miembro del equipo ve solo lo que necesita. El sistema de roles garantiza que la información sensible (finanzas, datos personales) esté disponible solo para quien corresponda. Añade tantos usuarios como necesites sin costo adicional.",
        items: [
            "Admin — acceso total: métricas, finanzas, configuración, CRM y reportes",
            "Recepcionista — reservas, cobros en caja y gestión de alumnas",
            "Coach / Instructor — vista de su agenda y lista de asistentes por clase",
            "Barista / Tienda — punto de venta para consumibles o complementos",
            "Alumna — app self-service para reservas, historial y FitCoins",
            "Invitaciones por email con link de activación seguro (token de un solo uso)",
        ],
    },
    {
        icon: Rocket,
        step: "04",
        title: "Abre las puertas",
        subtitle: "En operación en menos de un día",
        description:
            "Comparte el link de reservas con tus alumnas por WhatsApp, Instagram o correo. A partir de ese momento el sistema trabaja por ti: cobra membresías recurrentes, timbra facturas, envía recordatorios automáticos y registra cada acceso al estudio.",
        items: [
            "Link de reservas personalizado con tu dominio o subdominio (ej. mibarre.projectstudio.app)",
            "Cobros recurrentes automáticos en la fecha de renovación de cada membresía",
            "Recordatorios de clase por WhatsApp / email 24h y 1h antes",
            "QR de acceso generado automáticamente al confirmar reserva y pago",
            "Dashboard en tiempo real: asistencia, ingresos y leads del día",
            "Soporte en español vía chat — tiempo de respuesta promedio < 2 horas",
        ],
        button: { to: "/onboarding", text: "Empezar ahora" },
    },
];

// ── Component ──────────────────────────────────────────────────
export default function Process() {
    const [activeIndex, setActiveIndex] = useState(0);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

    // rAF loop: pick whichever sentinel is closest to 1/3 of viewport height
    useEffect(() => {
        let frame = 0;
        let last = -1;

        const tick = () => {
            frame = requestAnimationFrame(tick);
            const centerY = window.innerHeight / 3;
            let bestIdx = 0;
            let bestDist = Infinity;
            sentinelRefs.current.forEach((node, i) => {
                if (!node) return;
                const rect = node.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const dist = Math.abs(mid - centerY);
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            });
            if (bestIdx !== last) { last = bestIdx; setActiveIndex(bestIdx); }
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);

    return (
        <section id="process" className="py-24 px-6 text-white">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <ScrollReveal>
                    <p className="text-white/60 text-sm uppercase tracking-widest mb-3">Así de fácil</p>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                        Operativo en<br />
                        <span className="text-white/70">menos de un día</span>
                    </h2>
                    <p className="text-white/65 text-lg max-w-2xl">
                        Cuatro pasos para transformar tu estudio en un negocio que se gestiona solo.
                    </p>
                </ScrollReveal>

                {/* Timeline entries */}
                <div className="mt-16 space-y-20 md:mt-24 md:space-y-28">
                    {ENTRIES.map((entry, index) => {
                        const isActive = index === activeIndex;

                        return (
                            <ScrollReveal
                                key={index}
                                delay={0.1}
                                className="relative flex flex-col gap-6 md:flex-row md:gap-14"
                            >
                                <div ref={(el) => { itemRefs.current[index] = el; }} className="contents">
                                    {/* Invisible sentinel for proximity detection */}
                                    <div
                                        ref={(el) => { sentinelRefs.current[index] = el; }}
                                        aria-hidden
                                        className="absolute -top-20 left-0 h-8 w-8 opacity-0 pointer-events-none"
                                    />

                                    {/* Sticky left meta column - optimized for mobile with sticky top-24 instead of md:sticky top-10 */}
                                    <div className="sticky top-24 flex h-min w-full md:w-56 shrink-0 items-center md:items-start gap-4 md:gap-3 z-10 bg-[#0a0a0a]/80 backdrop-blur-md md:bg-transparent md:backdrop-blur-none py-2 md:py-0 border-b border-white/10 md:border-none -mx-6 px-6 md:mx-0 md:px-0">
                                        <div
                                            className="p-2.5 rounded-xl transition-all duration-300 flex-shrink-0"
                                            style={{
                                                background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                                                border: isActive ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                                            }}
                                        >
                                            <span style={{ color: isActive ? "white" : "rgba(255,255,255,0.3)", transition: "color 0.3s" }}>
                                                <entry.icon className="h-5 w-5 md:h-6 md:w-6" />
                                            </span>
                                        </div>
                                        <div>
                                            <span
                                                className="text-lg md:text-xl font-bold transition-colors duration-300 block"
                                                style={{ color: isActive ? "white" : "rgba(255,255,255,0.4)" }}
                                            >
                                                {entry.title}
                                            </span>
                                            <span className="text-sm md:text-base text-white/25 mt-0.5 block leading-tight">{entry.subtitle}</span>
                                        </div>
                                    </div>

                                    {/* Content card */}
                                    <article
                                        className="flex flex-col rounded-2xl p-5 flex-1 transition-all duration-400"
                                        style={{
                                            background: isActive ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                                            border: isActive ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.07)",
                                            boxShadow: isActive ? "0 20px 60px rgba(0,0,0,0.5)" : "none",
                                        }}
                                    >
                                        {/* Step number badge */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <span
                                                className="font-mono text-base md:text-lg font-bold transition-colors duration-300"
                                                style={{ color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)" }}
                                            >
                                                PASO {entry.step}
                                            </span>
                                            <div
                                                className="h-px flex-1 transition-all duration-300"
                                                style={{ background: isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)" }}
                                            />
                                        </div>

                                        <h3
                                            className="text-lg md:text-xl font-bold leading-tight tracking-tight transition-colors duration-300"
                                            style={{ color: isActive ? "white" : "rgba(255,255,255,0.5)" }}
                                        >
                                            {entry.title}
                                        </h3>

                                        <p
                                            className="mt-2 text-sm leading-relaxed transition-all duration-300"
                                            style={{
                                                color: "rgba(255,255,255,0.4)",
                                                WebkitLineClamp: isActive ? "unset" : 2,
                                                display: "-webkit-box",
                                                WebkitBoxOrient: "vertical",
                                                overflow: isActive ? "visible" : "hidden",
                                            }}
                                        >
                                            {entry.description}
                                        </p>

                                        {/* Expandable items */}
                                        <div
                                            className="grid transition-all duration-500 ease-out"
                                            style={{
                                                gridTemplateRows: isActive ? "1fr" : "0fr",
                                                opacity: isActive ? 1 : 0,
                                            }}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="space-y-4 pt-5">
                                                    <div
                                                        className="rounded-xl p-4"
                                                        style={{
                                                            background: "rgba(255,255,255,0.03)",
                                                            border: "1px solid rgba(255,255,255,0.08)",
                                                        }}
                                                    >
                                                        <ul className="space-y-2.5">
                                                            {entry.items.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                                                                    <div className="mt-2 h-1 w-1 rounded-full bg-white/30 flex-shrink-0" />
                                                                    <span className="leading-relaxed">{item}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {entry.button && (
                                                        <div className="flex justify-end">
                                                            <Button asChild variant="outline" size="sm" className="group">
                                                                <Link to={entry.button.to}>
                                                                    {entry.button.text}
                                                                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                </div>
                            </ScrollReveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
