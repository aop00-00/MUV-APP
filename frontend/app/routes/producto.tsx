import React, { useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { 
    Calendar, QrCode, ShoppingBag, Users, ClipboardList, Receipt, 
    CalendarCheck, Award, TrendingUp, CreditCard, ArrowRight,
    CheckCircle2, ShieldCheck, PlayCircle
} from "lucide-react";

import type { Route } from "./+types/producto";
import { HeroHeader } from "~/components/landing/Hero";
import { Button } from "~/components/ui/button";
import { ScrollReveal } from "~/components/ui/scroll-reveal";
import { AnimatedGroup } from "~/components/ui/animated-group";
import { cn } from "~/lib/utils";
import ParticleBackground from "~/components/landing/ParticleBackground";

// ─── Meta ────────────────────────────────────────────────────────
export function meta({}: Route.MetaArgs) {
    return [
        { title: "La Plataforma — Project Studio" },
        {
            name: "description",
            content: "Descubre cómo Project Studio centraliza reservas, acceso QR, POS, facturación CFDI y gamificación en una sola plataforma para tu studio boutique."
        },
        { property: "og:image", content: "og-producto.png" }, // Simulated
    ];
}

// ─── Common Transitions ──────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

// ─── Sections ────────────────────────────────────────────────────

function PageHero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-6">
            <div className="max-w-7xl mx-auto text-center relative z-10">
                <AnimatedGroup variants={{ container: { visible: { transition: { staggerChildren: 0.1 } } }, item: fadeUp }}>
                    <p className="text-white/40 uppercase tracking-widest text-sm font-semibold mb-4">La plataforma</p>
                    <h1 className="text-5xl md:text-7xl font-semibold text-white tracking-tight leading-tight max-w-4xl mx-auto font-display">
                        Todo lo que tu studio necesita, en un solo lugar
                    </h1>
                    <p className="mt-6 text-lg md:text-xl text-white/50 max-w-2xl mx-auto">
                        Desde la reserva del socio hasta la factura CFDI del dueño. Dos experiencias distintas, un sistema unificado.
                    </p>
                    <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                        <Button asChild size="lg" className="rounded-xl px-8 h-14 text-base">
                            <Link to="/onboarding">Usar Plan Emprendedor Gratis</Link>
                        </Button>
                        <p className="text-white/30 text-sm flex items-center justify-center sm:ml-2">Gratis para siempre • Sin tarjeta</p>
                    </div>
                </AnimatedGroup>

                {/* Mockup Split */}
                <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-20 relative max-w-5xl mx-auto"
                >
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        {/* Left: Admin */}
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-2xl relative translate-y-4 md:translate-y-8">
                            <div className="absolute -top-4 left-6 bg-[#111] border border-white/10 text-white text-xs px-3 py-1 rounded-full text-white/70">
                                Vista del Admin
                            </div>
                            {/* Dummy Admin UI */}
                            <div className="space-y-4 opacity-80 pointer-events-none">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="h-6 w-32 bg-white/10 rounded-md"></div>
                                    <div className="flex gap-2">
                                        <div className="size-8 rounded-full bg-white/10"></div>
                                        <div className="size-8 rounded-full bg-blue-500/50"></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="h-20 bg-white/5 rounded-xl border border-white/5 flex flex-col justify-center p-4">
                                        <div className="h-3 w-16 bg-white/10 rounded mb-2"></div>
                                        <div className="h-6 w-24 bg-white/20 rounded"></div>
                                    </div>
                                    <div className="h-20 bg-white/5 rounded-xl border border-white/5 flex flex-col justify-center p-4">
                                        <div className="h-3 w-16 bg-white/10 rounded mb-2"></div>
                                        <div className="h-6 w-24 bg-white/20 rounded"></div>
                                    </div>
                                </div>
                                <div className="h-40 bg-white/5 rounded-xl border border-white/5 p-4 flex flex-col gap-2">
                                    <div className="h-4 w-32 bg-white/10 rounded mb-2"></div>
                                    {[1,2,3].map(i => <div key={i} className="flex gap-2"><div className="w-12 h-6 bg-white/10 rounded"></div><div className="flex-1 h-6 bg-white/5 rounded"></div></div>)}
                                </div>
                            </div>
                        </div>

                        {/* Right: Member Phone */}
                        <div className="w-full md:w-[320px] bg-black border-4 border-white/20 rounded-[40px] p-2 shadow-2xl relative z-10 mx-auto md:mx-0">
                            <div className="absolute -top-4 right-10 md:-right-4 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg">
                                Vista del Socio
                            </div>
                            <div className="bg-[#0a0a0a] w-full h-[500px] rounded-[32px] overflow-hidden p-5 flex flex-col border border-white/5">
                                <div className="h-8 w-full flex justify-between items-center mb-6">
                                    <div className="h-4 w-20 bg-white/10 rounded-full"></div>
                                    <div className="h-8 w-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">120</div>
                                </div>
                                <div className="h-32 bg-gradient-to-br from-blue-900/40 to-blue-600/10 rounded-2xl mb-4 p-4 border border-blue-500/20">
                                    <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                                    <div className="h-5 w-40 bg-white/40 rounded"></div>
                                </div>
                                <div className="space-y-3 flex-1 overflow-hidden">
                                     <div className="h-4 w-32 bg-white/10 rounded mb-2 mt-4"></div>
                                     {[1,2,3].map(i => (
                                         <div key={i} className="h-16 w-full bg-white/5 rounded-xl border border-white/5 flex items-center p-3 gap-3">
                                             <div className="size-10 rounded-lg bg-white/10"></div>
                                             <div className="flex flex-col gap-1.5 flex-1">
                                                 <div className="h-3 w-1/2 bg-white/20 rounded"></div>
                                                 <div className="h-2 w-1/3 bg-white/10 rounded"></div>
                                             </div>
                                         </div>
                                     ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function AdminModules() {
    const defaultModules = [
        { id: "reservas", icon: Calendar, title: "Reservas y calendario", desc: "Vista semanal con ocupación en tiempo real. Crea, edita y cancela clases. Lista automática." },
        { id: "acceso_qr", icon: QrCode, title: "Control de acceso QR", desc: "Escanea el QR del socio al llegar. Registra asistencias automáticamente y bloquea sin plan." },
        { id: "pos", icon: ShoppingBag, title: "Punto de venta (POS)", desc: "Cobra membresías y productos. Genera CFDI directo desde la pantalla de cobro." },
        { id: "crm", icon: Users, title: "CRM de leads", desc: "Captura prospectos desde tu landing. Gestiona etapas y activa emails de conversión." },
        { id: "nomina", icon: ClipboardList, title: "Nómina de coaches", desc: "Calcula el pago por sesión impartida, incluyendo sustituciones listas para pagar." },
        { id: "facturacion", icon: Receipt, title: "Facturación fiscal LATAM", desc: "CFDI (México) automático. Integración nativa. Sin apps externas.", badge: "Único" },
    ];

    return (
        <section className="py-24 border-y border-white/5 px-6 relative">
            <div className="max-w-7xl mx-auto">
                <ScrollReveal>
                    <div className="text-center mb-16">
                        <p className="text-blue-400 text-sm uppercase tracking-widest font-semibold mb-3">Para el studio</p>
                        <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
                            Operación completa desde un dashboard
                        </h2>
                    </div>
                </ScrollReveal>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {defaultModules.map((mod, i) => (
                        <ScrollReveal key={mod.id} className="h-full">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full hover:bg-white/10 transition-colors cursor-pointer group flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="size-12 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <mod.icon className="size-6" />
                                    </div>
                                    {mod.badge && <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-md font-medium border border-blue-500/30">{mod.badge}</span>}
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">{mod.title}</h3>
                                <p className="text-white/50 leading-relaxed text-sm flex-1">{mod.desc}</p>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

function MemberExperience() {
    const features = [
        { icon: CalendarCheck, title: "Reserva en 3 taps", desc: "Explora el horario semanal, elige clase y confirma. WhatsApp recordatorios." },
        { icon: QrCode, title: "Check-in sin contacto", desc: "Muestra tu QR al llegar. El staff escanea y la asistencia queda." },
        { icon: Award, title: "FitCoins — Recompensas", desc: "Acumula por asistir y rachas. Canjéalos por clases gratis." },
        { icon: TrendingUp, title: "Progreso y récords", desc: "Historial completo de asistencias y métricas de evolución." },
        { icon: CreditCard, title: "Pagos seguros", desc: "Stripe y Mercado Pago para comprar desde tu celular al instante." },
    ];

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="max-w-7xl mx-auto">
                <ScrollReveal>
                    <div className="text-center md:text-left mb-16 md:hidden">
                        <p className="text-purple-400 text-sm uppercase tracking-widest font-semibold mb-3">Para el socio</p>
                        <h2 className="text-4xl font-semibold text-white tracking-tight">Una experiencia que engancha y retiene</h2>
                    </div>
                </ScrollReveal>

                <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
                    {/* Phone Visual */}
                    <ScrollReveal className="w-full md:w-1/2 flex justify-center">
                        <div className="relative w-[300px] h-[600px] rounded-[48px] bg-black border-[6px] border-white/20 p-2 shadow-2xl shadow-purple-900/20">
                            <div className="w-full h-full bg-[#111] rounded-[36px] overflow-hidden flex flex-col relative border border-white/5">
                                {/* Dummy content for member app */}
                                <div className="absolute inset-0 bg-gradient-to-b from-purple-600/20 to-black/90 z-0"></div>
                                <div className="relative z-10 p-6 flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-8">
                                        <div className="text-white font-bold text-lg">Hola, Carlos!</div>
                                        <div className="size-10 rounded-full bg-white/20"></div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/10">
                                        <p className="text-white/60 text-sm mb-1">Próxima clase</p>
                                        <p className="text-white font-semibold text-lg">CrossFit WOD</p>
                                        <p className="text-purple-300 text-sm mt-2">Hoy · 19:00 hrs</p>
                                        <Button className="w-full mt-4 bg-white text-black hover:bg-white/90">QR de Acceso</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-14 bg-white/5 rounded-xl border border-white/5"></div>
                                        <div className="h-14 bg-white/5 rounded-xl border border-white/5"></div>
                                        <div className="h-14 bg-white/5 rounded-xl border border-white/5"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* Features List */}
                    <div className="w-full md:w-1/2">
                        <div className="hidden md:block mb-12">
                            <p className="text-purple-400 text-sm uppercase tracking-widest font-semibold mb-3">Para el socio</p>
                            <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">Una experiencia que engancha y retiene</h2>
                        </div>
                        <div className="space-y-8">
                            {features.map((feat, i) => (
                                <ScrollReveal key={i}>
                                    <div className="flex gap-4">
                                        <div className="shrink-0 size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white">
                                            <feat.icon className="size-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-white mb-1">{feat.title}</h4>
                                            <p className="text-white/50 text-sm leading-relaxed">{feat.desc}</p>
                                        </div>
                                    </div>
                                </ScrollReveal>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Disciplines() {
    const modes = [
        { id: "assigned", name: "Equipamiento asignado", disc: "Pilates Reformer, Cycling", desc: "El socio elige su equipo en un mapa del salón. Control total de distribución.", img: "/images/landing/pilates.png" },
        { id: "capacity", name: "Capacidad por clase", disc: "Yoga, Barre, Dance", desc: "Reserva por cupo disponible. El sistema gestiona lista de espera automáticamente.", img: "/images/landing/yoga.png" },
        { id: "open", name: "Acceso abierto", disc: "HIIT, Funcional, Box", desc: "Sin asignación fija. Confirma asistencia y el sistema registra ocupación.", img: "/images/landing/hiit.png" },
    ];
    
    return (
        <section className="py-24 border-y border-white/5 px-6 relative">
            <div className="max-w-7xl mx-auto">
                <ScrollReveal className="text-center mb-16 max-w-3xl mx-auto">
                    <p className="text-white/40 text-sm uppercase tracking-widest font-semibold mb-3">Hecho para tu disciplina</p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight mb-6">No todos los studios son iguales. La plataforma tampoco.</h2>
                    <p className="text-white/50 text-lg">El calendario, la vista del salón y las reglas de reserva se adaptan según tu operación.</p>
                </ScrollReveal>

                <div className="grid md:grid-cols-3 gap-6">
                    {modes.map(mode => (
                        <ScrollReveal key={mode.id}>
                            <div className="bg-[#111] rounded-2xl border border-white/10 overflow-hidden relative group h-full flex flex-col">
                                <div className="h-48 overflow-hidden relative bg-black/50">
                                    <img src={mode.img} alt={mode.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-all duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent"></div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col relative z-10 -mt-6">
                                    <h3 className="text-xl font-bold text-white mb-2">{mode.name}</h3>
                                    <p className="text-blue-300 font-medium text-sm mb-4">{mode.disc}</p>
                                    <p className="text-white/50 text-sm flex-1">{mode.desc}</p>
                                </div>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

function IntegrationsAndTech() {
    const groups = [
        { name: "Pagos", items: [{ n: "Stripe", d: "MX, CO, CL" }, { n: "Mercado Pago", d: "LATAM" }] },
        { name: "Facturación fiscal", items: [{ n: "Facturama", d: "CFDI México (SAT)" }, { n: "AFIP / SII", d: "Soporte regional" }] },
        { name: "Acceso físico", items: [{ n: "ZKTeco", d: "Torniquetes" }, { n: "QR Dinámico", d: "Sin hardware" }] },
        { name: "Seguridad", items: [{ n: "Cifrado AES-256", d: "Nivel bancario" }, { n: "Row-Level Security", d: "Aislamiento total" }] },
    ];

    return (
        <section className="py-24 px-6">
            <div className="max-w-5xl mx-auto">
                <ScrollReveal className="text-center mb-16">
                    <p className="text-white/40 text-sm uppercase tracking-widest font-semibold mb-3">Infraestructura</p>
                    <h2 className="text-4xl text-white font-semibold tracking-tight">Construido para LATAM, desde el primer día</h2>
                </ScrollReveal>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {groups.map((group, i) => (
                        <ScrollReveal key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                            <h3 className="text-white font-semibold mb-5">{group.name}</h3>
                            <ul className="space-y-4">
                                {group.items.map((item, j) => (
                                    <li key={j}>
                                        <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                                            <CheckCircle2 className="size-4 text-blue-400" />
                                            {item.n}
                                        </div>
                                        <div className="text-white/40 text-xs ml-6 mt-0.5">{item.d}</div>
                                    </li>
                                ))}
                            </ul>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

function CtaBottom() {
    return (
        <section className="py-24 px-6 relative border-t border-white/10 overflow-hidden">
             <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_70%)] pointer-events-none" />
             <div className="max-w-4xl mx-auto text-center relative z-10">
                 <ScrollReveal>
                    <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
                        ¿Listo para ver cómo funciona?
                    </h2>
                    <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
                        Configura tu primer horario, cobra y genera facturas en menos de 30 minutos.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                        <Button asChild size="lg" className="rounded-xl px-8 h-14 w-full sm:w-auto">
                            <Link to="/onboarding">Crear cuenta gratis</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="rounded-xl px-8 h-14 bg-white/5 hover:bg-white/10 border-white/10 text-white w-full sm:w-auto">
                            <Link to="/#pricing">Ver planes y precios</Link>
                        </Button>
                    </div>
                    <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-white/40">
                        <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Soporte en español</span>
                        <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Servidores LATAM</span>
                        <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Cumple SAT / AFIP</span>
                    </div>
                 </ScrollReveal>
             </div>
        </section>
    );
}

import Pricing from "~/components/landing/Pricing";

// ─── Main Route Component ────────────────────────────────────────
export default function Producto() {
    return (
        <>
            <ParticleBackground />
            <div className="text-white font-sans selection:bg-blue-500/30" style={{ position: "relative", zIndex: 1 }}>
                <HeroHeader />
                <main className="relative overflow-hidden">
                    <PageHero />
                    <AdminModules />
                    <MemberExperience />
                    <Disciplines />
                    <IntegrationsAndTech />
                    <Pricing />
                    <CtaBottom />
                </main>
            </div>
        </>
    );
}
