// app/routes/onboarding/setup/_index.tsx
// Step 1: Welcome — Post-checkout confirmation screen
// Shows plan summary and motivates user to continue setup

import { Link, useRouteLoaderData } from "react-router";
import { Sparkles, ArrowRight, CheckCircle2, Building2, Palette, Calendar, CreditCard } from "lucide-react";

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepWelcome() {
    const parentData = useRouteLoaderData("routes/onboarding/setup/layout") as any;
    const planId = parentData?.gymInfo?.plan_id || "starter";

    let title = "¡Suscripción confirmada!";
    let subtitle = (
        <>
            Tu plan está activo con 7 días de prueba gratuita.<br />
            Ahora configuremos tu estudio en menos de 5 minutos.
        </>
    );

    if (planId === "emprendedor") {
        title = "¡Bienvenido a Project Studio!";
        subtitle = (
            <>
                Tu plan <strong className="text-white">Emprendedor (Gratis)</strong> está activo, perfecto para arrancar tu negocio con hasta 10 alumnos.<br />
                Ahora configuremos tu estudio en menos de 5 minutos.
            </>
        );
    } else if (planId === "starter") {
        title = "¡Suscripción confirmada!";
        subtitle = (
            <>
                Tu plan <strong className="text-white">Starter</strong> cuenta con 7 de prueba gratuita.<br />
                Aprovecha alumnos y sedes ilimitadas. Configura tu estudio ahora.
            </>
        );
    } else if (planId === "pro") {
        title = "¡Suscripción Pro configurada!";
        subtitle = (
            <>
                Tu plan <strong className="text-white">Pro</strong> está activo y tienes 7 días de prueba gratuita.<br />
                Escala tu negocio con el CRM, control de accesos y Fitcoins. Comencemos la configuración.
            </>
        );
    } else if (planId === "elite") {
        title = "¡Suscripción Elite lista!";
        subtitle = (
            <>
                Tu plan <strong className="text-white">Elite</strong> está preparado con 7 días de prueba gratuita.<br />
                Tendrás facturación automática web y la app. Configura tu estudio en menos de 5 minutos.
            </>
        );
    }

    return (
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Animated check icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            {/* Title */}
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                    {title}
                </h1>
                <p className="text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {/* What we'll configure */}
            <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6 md:p-8 text-left max-w-md mx-auto">
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-5">
                    Configuraremos
                </h3>
                <ul className="space-y-4">
                    <li className="flex items-center gap-4 text-white/70">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-violet-400" />
                        </div>
                        <span className="text-sm">Tipo de estudio y modo de reservas</span>
                    </li>
                    <li className="flex items-center gap-4 text-white/70">
                        <div className="w-9 h-9 rounded-lg bg-fuchsia-500/20 flex items-center justify-center shrink-0">
                            <Palette className="w-4 h-4 text-fuchsia-400" />
                        </div>
                        <span className="text-sm">Identidad visual (colores de tu marca)</span>
                    </li>
                    <li className="flex items-center gap-4 text-white/70">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-sm">Sala, equipos y capacidad</span>
                    </li>
                    <li className="flex items-center gap-4 text-white/70">
                        <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-teal-400" />
                        </div>
                        <span className="text-sm">Tu primera clase y horario</span>
                    </li>
                    <li className="flex items-center gap-4 text-white/70">
                        <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-sky-400" />
                        </div>
                        <span className="text-sm">Planes y membresías para tus alumnos</span>
                    </li>
                </ul>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
                <Link
                    to="/onboarding/setup/studio-type"
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-500/25"
                >
                    Configurar mi estudio
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>

            <p className="text-xs text-white/30">
                Toma aproximadamente 5 minutos
            </p>
        </div>
    );
}
