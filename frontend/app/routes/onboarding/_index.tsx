// app/routes/onboarding/_index.tsx
// 5-step wizard: Plan (Bento) → Studio Info → Account → Payment → Success → /auth/login

import { useState, useEffect } from "react";
import { useSearchParams, Form, useNavigation } from "react-router";
import type { Route } from "./+types/_index";

// ── Server action ─────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    // Safety timeout for the entire action (15s)
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout: La operación tardó demasiado tiempo.")), 15000)
    );

    try {
        if (intent === "complete_onboarding") {
            return await Promise.race([
                (async () => {
                    const email = (formData.get("email") as string).toLowerCase().trim();
                    const password = formData.get("password") as string;
                    const studioName = formData.get("studioName") as string;
                    const ownerName = formData.get("ownerName") as string;
                    const plan = formData.get("plan") as string;
                    const country = formData.get("country") as string;
                    const city = formData.get("city") as string;
                    const phone = formData.get("phone") as string;

                    const { supabaseAdmin } = await import("~/services/supabase.server");

                    console.log(`[Onboarding] Starting for ${email}`);

                    // 1. Create Auth User
                    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: { full_name: ownerName, role: "admin" }
                    });

                    if (authError) {
                        console.error("[Onboarding] Auth Error:", authError);
                        return { error: "Error en Auth: " + authError.message };
                    }

                    const userId = authData.user.id;

                    // 2. Create Gym
                    const slug = studioName.toLowerCase().trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-')
                        .replace(/^-+|-+$/g, '') 
                        + '-' + Math.random().toString(36).substring(2, 6);

                    const { data: gymData, error: gymError } = await supabaseAdmin
                        .from("gyms")
                        .insert({
                            name: studioName,
                            slug,
                            owner_id: userId,
                            plan_id: plan,
                            plan_status: "trial",
                            tax_region: country as any,
                            country_code: country,
                            timezone: "America/Mexico_City",
                            currency: country === "MX" ? "MXN" : "USD",
                            features: { fiscal: true, fitcoins: true, qrAccess: true, waitlist: true }, 
                            primary_color: "#7c3aed",
                            accent_color: "#2563eb"
                        })
                        .select()
                        .single();

                    if (gymError) {
                        console.error("[Onboarding] Gym Error:", gymError);
                        await supabaseAdmin.auth.admin.deleteUser(userId);
                        return { error: "Error en Base de Datos: " + gymError.message };
                    }

                    // 3. Trigger n8n (Non-blocking)
                    const { triggerOnboarding } = await import("~/services/n8n.server");
                    triggerOnboarding(gymData.id, userId, {
                        studioName, ownerName, email, phone, plan, city, country
                    }).catch(err => console.error("[Onboarding] n8n error:", err));

                    // 4. Update Profile
                    const { error: profileError } = await supabaseAdmin
                        .from("profiles")
                        .update({ role: "admin", gym_id: gymData.id, full_name: ownerName, phone: phone })
                        .eq("id", userId);

                    if (profileError) console.error("[Onboarding] Profile Error:", profileError);

                    // 5. Create Session
                    const { createUserSession } = await import("~/services/auth.server");
                    return createUserSession(request, "/admin", userId, "admin");
                })(),
                timeoutPromise
            ]);
        }
    } catch (e: any) {
        console.error("[Onboarding] CRITICAL:", e);
        return { error: "Error sistémico: " + (e.message || "Error desconocido") };
    }
    return null;
}

// ── Types ─────────────────────────────────────────────────────────
type StudioType = "pilates" | "yoga" | "barre" | "funcional" | "crossfit" | "otro";
type Country = "MX" | "AR" | "CL" | "CO" | "PE" | "otro";
type PayMethod = "card" | "transfer";

interface FormState {
    plan: string;
    studioName: string;
    studioType: StudioType | "";
    country: Country | "";
    city: string;
    phone: string;
    ownerName: string;
    email: string;
    password: string;
    confirmPassword: string;
    payMethod: PayMethod;
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
    cardName: string;
    termsAccepted: boolean;
}

const INITIAL_FORM: FormState = {
    plan: "pro",
    studioName: "",
    studioType: "",
    country: "",
    city: "",
    phone: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    payMethod: "card",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardName: "",
    termsAccepted: false,
};

// ── Plans data ────────────────────────────────────────────────────
const PLANS = [
    {
        id: "starter",
        name: "Starter",
        monthlyPrice: 999,
        desc: "1 sede · 80 alumnas",
        color: "border-blue-500/40 bg-blue-500/5",
        features: [
            "1 sede física",
            "Hasta 80 alumnos activos",
            "Calendario y reservas",
            "Control de acceso QR",
        ],
        badge: null,
    },
    {
        id: "pro",
        name: "Pro",
        monthlyPrice: 2099,
        desc: "3 sedes · Ilimitadas",
        color: "border-amber-400 bg-amber-400/10",
        features: [
            "Hasta 3 sedes físicas",
            "Alumnas ilimitadas",
            "Facturación fiscal automática",
            "CRM de leads y socios",
        ],
        badge: "Recomendado",
    },
    {
        id: "elite",
        name: "Elite",
        monthlyPrice: 3199,
        desc: "Multi-sede · API",
        color: "border-amber-500/40 bg-amber-500/5",
        features: [
            "Sedes ilimitadas",
            "Marca blanca (Logo propio)",
            "API pública y webhooks",
            "Gerente de cuenta dedicado",
        ],
        badge: null,
    },
];

// ── Bento feature cards for Step 1 ───────────────────────────────
const BENTO_CARDS = [
    {
        icon: "📅",
        title: "Módulos del sistema",
        desc: "Reservas, control de acceso QR, CRM, facturación fiscal y finanzas en un solo panel.",
    },
    {
        icon: "⏱️",
        title: "Alta en menos de 24 hrs",
        desc: "Sin instalaciones. Tus alumnas pueden reservar desde el primer día.",
    },
    {
        icon: "⚡",
        title: "¿Qué cambia contigo?",
        desc: "Eliminas WhatsApp para reservas, hojas de cálculo y apps desconectadas.",
    },
    {
        icon: "🎯",
        title: "¿Para quién es?",
        desc: "Estudios boutique de Pilates, Yoga, Barre, Funcional o Crossfit en LATAM.",
    },
    {
        icon: "🏢",
        title: "Capacidad y sedes",
        desc: "Desde 1 sede hasta múltiples ubicaciones. Alumni ilimitadas en Pro y Elite.",
    },
    {
        icon: "🛡️",
        title: "Transparencia total",
        desc: "Sin contratos forzosos. Cancela cuando quieras. Exporta tus datos siempre.",
    },
];

// ── Progress bar ──────────────────────────────────────────────────
const STEP_LABELS = ["Plan", "Tu estudio", "Tu cuenta", "Pago", "¡Listo!"];

function ProgressBar({ step, total }: { step: number; total: number }) {
    return (
        <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-3">
                {Array.from({ length: total }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 flex-shrink-0 ${i + 1 < step
                                ? "bg-amber-400 text-white"
                                : i + 1 === step
                                    ? "bg-amber-400 text-white ring-4 ring-amber-400/20"
                                    : "bg-white/5 text-gray-500 border border-white/10"
                                }`}
                        >
                            {i + 1 < step ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                i + 1
                            )}
                        </div>
                        {i < total - 1 && (
                            <div className={`flex-1 h-px transition-all duration-300 ${i + 1 < step ? "bg-amber-400" : "bg-white/10"}`} />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                {STEP_LABELS.map((l) => (
                    <span key={l}>{l}</span>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 1 — Plan selection (Bento layout)
// ═══════════════════════════════════════════════════════════════════
function StepPlan({ form, setForm, onNext }: { form: FormState; setForm: (f: FormState) => void; onNext: () => void }) {
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;

    return (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — Bento grid */}
            <div className="lg:col-span-2 space-y-4">
                <div>
                    <h1 className="text-3xl font-black text-white">Construimos el plan ideal para tu estudio.</h1>
                    <p className="text-gray-400 mt-1 text-sm">Revisa los detalles y elige el que mejor se adapte a tu operación.</p>
                </div>

                {/* Bento 2×3 grid */}
                <div className="grid grid-cols-2 gap-3">
                    {BENTO_CARDS.map((card) => (
                        <div
                            key={card.title}
                            className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors cursor-default"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <span className="text-2xl">{card.icon}</span>
                                <svg className="w-4 h-4 text-gray-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                            <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
                            <p className="text-gray-400 text-xs leading-relaxed">{card.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right — Plan selector + confirm */}
            <div className="flex flex-col gap-4">
                {/* Plan tabs */}
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-1 flex gap-1">
                    {PLANS.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setForm({ ...form, plan: p.id })}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.plan === p.id
                                ? "bg-amber-400 text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>

                {/* Selected plan details */}
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex-1 flex flex-col gap-4">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Inversión del plan</p>
                        <div className="flex items-end gap-1">
                            <span className="text-5xl font-black text-white">${selectedPlan.monthlyPrice.toLocaleString("es-MX")}</span>
                            <span className="text-gray-400 text-sm pb-1.5">MXN/mes</span>
                        </div>
                        {selectedPlan.badge && (
                            <span className="inline-block mt-1 bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {selectedPlan.badge}
                            </span>
                        )}
                        <p className="text-amber-400 text-xs mt-2">● 7 días gratis</p>
                    </div>

                    {/* Feature checklist */}
                    <ul className="space-y-2 text-sm text-gray-300 border-t border-white/5 pt-4">
                        {(selectedPlan as any).features.map((feature: string) => (
                            <li key={feature} className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-xs">{feature}</span>
                            </li>
                        ))}
                        <li className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span className="text-xs text-blue-300 font-medium">Project Studio: Inscripción protegida</span>
                        </li>
                    </ul>

                    {/* Terms */}
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.termsAccepted}
                            onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-transparent accent-amber-400"
                        />
                        <span className="text-xs text-gray-400">
                            Acepto los <span className="text-amber-400">Términos y Condiciones</span> y las Políticas de Privacidad.
                        </span>
                    </label>

                    {!form.termsAccepted && (
                        <p className="text-amber-400 text-xs flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Se requieren los términos para continuar
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!form.termsAccepted}
                        className="w-full bg-amber-400 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3.5 rounded-xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:scale-100 disabled:cursor-not-allowed"
                    >
                        Confirmar plan {selectedPlan.name} →
                    </button>

                    {/* WhatsApp support */}
                    <a
                        href="https://wa.me/5215500000000?text=Hola,%20quiero%20info%20sobre%20Grind%20Project"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-3 bg-green-500/5 border border-green-500/20 rounded-xl p-3 mt-1 hover:border-green-500/40 transition-colors"
                    >
                        <span className="text-2xl">💬</span>
                        <div>
                            <p className="text-white text-xs font-semibold">¿Dudas sobre tu plan?</p>
                            <p className="text-gray-400 text-xs">¿Necesitas ayuda antes de continuar?</p>
                            <span className="text-green-400 text-xs font-medium">Contactar a mi asesor →</span>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2 — Studio info
// ═══════════════════════════════════════════════════════════════════
const STUDIO_TYPES: { value: StudioType; label: string; icon: string }[] = [
    { value: "pilates", label: "Pilates", icon: "🤸" },
    { value: "yoga", label: "Yoga", icon: "🧘" },
    { value: "barre", label: "Barre", icon: "🩰" },
    { value: "funcional", label: "Funcional", icon: "💪" },
    { value: "crossfit", label: "CrossFit", icon: "🏋️" },
    { value: "otro", label: "Otro", icon: "✨" },
];

const COUNTRIES: { value: Country; label: string; flag: string }[] = [
    { value: "MX", label: "México", flag: "🇲🇽" },
    { value: "AR", label: "Argentina", flag: "🇦🇷" },
    { value: "CL", label: "Chile", flag: "🇨🇱" },
    { value: "CO", label: "Colombia", flag: "🇨🇴" },
    { value: "PE", label: "Perú", flag: "🇵🇪" },
    { value: "otro", label: "Otro", flag: "🌎" },
];

function StepStudio({ form, setForm, onNext, onBack }: {
    form: FormState; setForm: (f: FormState) => void; onNext: () => void; onBack: () => void;
}) {
    const isValid = form.studioName.length >= 2 && form.studioType && form.country && form.city.length >= 2;
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;

    return (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left sidebar — plan summary */}
            <div className="flex flex-col gap-4">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Resumen de inscripción</p>
                    <h3 className="text-white text-xl font-black mb-0.5">Plan {selectedPlan.name}</h3>
                    <p className="text-gray-400 text-xs mb-4">${selectedPlan.monthlyPrice.toLocaleString("es-MX")} MXN/mes · 7 días gratis</p>
                    <ul className="space-y-2">
                        {BENTO_CARDS.slice(0, 4).map((c) => (
                            <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {c.title}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                        <p className="text-white text-xs font-bold">Alta segura</p>
                        <p className="text-gray-400 text-xs">Tus datos están protegidos bajo estándares de seguridad bancaria.</p>
                    </div>
                </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-8">
                <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-1">Paso 2 de 4 – Configura tu espacio</p>
                <h2 className="text-3xl font-black text-white mb-6">Tu estudio</h2>

                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Nombre del estudio *</label>
                        <input
                            type="text"
                            value={form.studioName}
                            onChange={(e) => setForm({ ...form, studioName: e.target.value })}
                            placeholder="Ej: Studio Valentina Pilates"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Tipo de estudio *</label>
                        <div className="grid grid-cols-3 gap-3">
                            {STUDIO_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setForm({ ...form, studioType: t.value })}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-sm ${form.studioType === t.value
                                        ? "border-amber-400 bg-amber-400/10 text-white"
                                        : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20"
                                        }`}
                                >
                                    <span className="text-2xl">{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">País *</label>
                            <select
                                value={form.country}
                                onChange={(e) => setForm({ ...form, country: e.target.value as Country })}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors appearance-none"
                            >
                                <option value="" disabled>Seleccionar…</option>
                                {COUNTRIES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.flag} {c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Ciudad *</label>
                            <input
                                type="text"
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                                placeholder="CDMX"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">WhatsApp para seguimiento</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">📱</span>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+52 55 1234 5678"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Para soporte técnico rápido y notificaciones de tu plan.</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button type="button" onClick={onBack} className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm">
                        ← Atrás
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!isValid}
                        className="flex-1 bg-amber-400 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100"
                    >
                        Siguiente paso →
                    </button>
                </div>
                <p className="text-center text-xs text-gray-600 mt-4">🔒 Pagos procesados bajo encriptación SSL institucional</p>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3 — Account creation
// ═══════════════════════════════════════════════════════════════════
function StepAccount({ form, setForm, onNext, onBack }: {
    form: FormState; setForm: (f: FormState) => void; onNext: () => void; onBack: () => void;
}) {
    const passwordsMatch = form.password === form.confirmPassword;
    const isValid = form.ownerName.length >= 2 && form.email.includes("@") && form.password.length >= 8 && passwordsMatch;
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;

    return (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="flex flex-col gap-4">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Resumen de inscripción</p>
                    <h3 className="text-white text-xl font-black mb-0.5">Plan {selectedPlan.name}</h3>
                    <p className="text-gray-400 text-xs mb-4">{form.studioName || "Tu estudio"} · {form.city || "Tu ciudad"}</p>
                    <ul className="space-y-2">
                        {BENTO_CARDS.slice(0, 4).map((c) => (
                            <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {c.title}
                            </li>
                        ))}
                    </ul>
                </div>
                <blockquote className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4">
                    <p className="text-gray-300 text-xs italic leading-relaxed">
                        "En menos de 30 minutos tuve mi estudio configurado y mis alumnas reservando. Totalmente recomendado."
                    </p>
                    <p className="text-amber-400 text-xs font-semibold mt-2">Camila T. · Barre & Flow, Buenos Aires</p>
                </blockquote>
            </div>

            {/* Form */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-8">
                <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-1">Paso 3 de 4 – Tu acceso al sistema</p>
                <h2 className="text-3xl font-black text-white mb-6">Datos del administrador</h2>

                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Nombre *</label>
                            <input
                                type="text"
                                value={form.ownerName.split(" ")[0] ?? ""}
                                onChange={(e) => {
                                    const last = form.ownerName.split(" ").slice(1).join(" ");
                                    setForm({ ...form, ownerName: `${e.target.value} ${last}`.trim() });
                                }}
                                placeholder="Tu nombre"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Apellido *</label>
                            <input
                                type="text"
                                value={form.ownerName.split(" ").slice(1).join(" ")}
                                onChange={(e) => {
                                    const first = form.ownerName.split(" ")[0] ?? "";
                                    setForm({ ...form, ownerName: `${first} ${e.target.value}`.trim() });
                                }}
                                placeholder="Tus apellidos"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Correo electrónico *</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="tu@estudio.com"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Contraseña *</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Mínimo 8 caracteres"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Confirmar contraseña *</label>
                        <input
                            type="password"
                            value={form.confirmPassword}
                            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                            placeholder="Repetir contraseña"
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${form.confirmPassword.length > 0 && !passwordsMatch
                                ? "border-red-500"
                                : "border-white/10 focus:border-amber-400"
                                }`}
                        />
                        {form.confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="text-red-400 text-xs mt-1">Las contraseñas no coinciden</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button type="button" onClick={onBack} className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm">
                        ← Atrás
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!isValid}
                        className="flex-1 bg-amber-400 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100"
                    >
                        Siguiente paso →
                    </button>
                </div>
                <p className="text-center text-xs text-gray-600 mt-4">🔒 Pagos procesados bajo encriptación SSL institucional</p>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4 — Payment gateway
// ═══════════════════════════════════════════════════════════════════
function formatCardNumber(value: string) {
    return value.replace(/\D/g, "").substring(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").substring(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    return digits;
}

function StepPayment({ form, setForm, onBack, isSubmitting }: {
    form: FormState; setForm: (f: FormState) => void; onBack: () => void; isSubmitting: boolean;
}) {
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;
    const canPay = form.payMethod === "transfer" || (form.cardNumber.replace(/\s/g, "").length === 16 && form.cardExpiry.length >= 4 && form.cardCvc.length >= 3 && form.cardName.length >= 2);

    return (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar — plan summary */}
            <div className="flex flex-col gap-4">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Resumen de inscripción</p>
                    <h3 className="text-white text-xl font-black mb-0.5">Plan {selectedPlan.name}</h3>
                    <p className="text-gray-400 text-xs mb-4">{form.studioName || "Tu estudio"}</p>
                    <ul className="space-y-2 mb-4">
                        {BENTO_CARDS.slice(0, 4).map((c) => (
                            <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {c.title}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Right sidebar — form */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-8">
                <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-1">Paso 4 de 4 – Pago y activación</p>
                <h2 className="text-3xl font-black text-white mb-6">Método de pago</h2>

                <div className="space-y-6">
                    {/* Payment methods tabs */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-2xl border border-white/10">
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, payMethod: "card" })}
                            className={`flex flex-col items-center gap-1 py-4 rounded-xl transition-all border ${form.payMethod === "card"
                                ? "bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-400/20"
                                : "text-gray-400 border-transparent hover:text-white"
                                }`}
                        >
                            <span className="text-2xl">💳</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Tarjeta</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, payMethod: "transfer" })}
                            className={`flex flex-col items-center gap-1 py-4 rounded-xl transition-all border ${form.payMethod === "transfer"
                                ? "bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-400/20"
                                : "text-gray-400 border-transparent hover:text-white"
                                }`}
                        >
                            <span className="text-2xl">🏦</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Transferencia</span>
                        </button>
                    </div>

                    {form.payMethod === "card" ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Número de tarjeta</label>
                                <input
                                    type="text"
                                    value={form.cardNumber}
                                    onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })}
                                    placeholder="0000 0000 0000 0000"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Vencimiento</label>
                                    <input
                                        type="text"
                                        value={form.cardExpiry}
                                        onChange={(e) => setForm({ ...form, cardExpiry: formatExpiry(e.target.value) })}
                                        placeholder="MM / YY"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">CVV</label>
                                    <input
                                        type="text"
                                        value={form.cardCvc}
                                        onChange={(e) => setForm({ ...form, cardCvc: e.target.value.replace(/\D/g, "").substring(0, 4) })}
                                        placeholder="123"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Nombre en la tarjeta</label>
                                <input
                                    type="text"
                                    value={form.cardName}
                                    onChange={(e) => setForm({ ...form, cardName: e.target.value })}
                                    placeholder="TITULAR DE LA TARJETA"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors uppercase"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex gap-3 text-blue-300">
                                <span className="text-xl">ℹ️</span>
                                <p className="text-xs leading-relaxed">
                                    Al elegir transferencia, un asesor se pondrá en contacto contigo para validar el pago y activar tu cuenta permanentemente. Podrás usar el sistema inmediatamente durante el periodo de prueba.
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Banco</p>
                                <p className="text-sm text-white font-bold">BBVA Bancomer</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">CLABE Interbancaria</p>
                                <p className="text-sm text-white font-bold tracking-wider">0123 4567 8901 2345 67</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-8">
                    <button type="button" onClick={onBack} disabled={isSubmitting} className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm disabled:opacity-50">
                        ← Atrás
                    </button>
                    <button
                        type="submit"
                        disabled={!canPay || isSubmitting}
                        className="flex-1 bg-amber-400 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Activando estudio...
                            </>
                        ) : (
                            "Activar mi cuenta hoy →"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 5 — Success screen
// ═══════════════════════════════════════════════════════════════════
function StepSuccess() {
    return (
        <div className="w-full max-w-xl mx-auto text-center animate-in zoom-in-95 fade-in duration-500">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-500/20">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h1 className="text-4xl font-black text-white mb-4">¡Todo listo!</h1>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Tu estudio ha sido configurado con éxito. Hemos enviado un correo con tus accesos y la guía de inicio rápido.
            </p>

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-left mb-8 space-y-4">
                <div className="flex gap-4 items-start">
                    <span className="text-2xl">📧</span>
                    <div>
                        <p className="text-white text-sm font-bold">Verifica tu correo</p>
                        <p className="text-gray-500 text-xs mt-0.5">Te enviamos los datos de acceso para tu equipo.</p>
                    </div>
                </div>
                <div className="flex gap-4 items-start">
                    <span className="text-2xl">🎓</span>
                    <div>
                        <p className="text-white text-sm font-bold">Video de onboarding</p>
                        <p className="text-gray-500 text-xs mt-0.5">En tu panel encontrarás un video de 3 min para empezar.</p>
                    </div>
                </div>
            </div>

            <a
                href="/admin"
                className="inline-block w-full bg-white text-black hover:bg-white/90 py-4 rounded-xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl"
            >
                Entrar al Panel Administrativo
            </a>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Onboarding({ actionData }: Route.ComponentProps) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [searchParams] = useSearchParams();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Allow jumping to plan if provided in URL
    useEffect(() => {
        const p = searchParams.get("plan");
        if (p && PLANS.some(x => x.id === p)) {
            setForm(f => ({ ...f, plan: p }));
        }
    }, [searchParams]);

    // Handle success transition
    useEffect(() => {
        if (actionData && !(actionData as any).error) {
            setStep(5);
        }
    }, [actionData]);

    const next = () => setStep(s => Math.min(s + 1, 5));
    const back = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="w-full py-4 min-h-[600px] flex flex-col items-center overflow-x-hidden">
            {step < 5 && <ProgressBar step={step} total={4} />}

            <div className="w-full transition-all duration-300">
                {step === 1 && <StepPlan form={form} setForm={setForm} onNext={next} />}
                {step === 2 && <StepStudio form={form} setForm={setForm} onNext={next} onBack={back} />}
                {step === 3 && <StepAccount form={form} setForm={setForm} onNext={next} onBack={back} />}
                {step === 4 && (
                    <Form method="post">
                        {/* Hidden inputs to send all data in one submission */}
                        <input type="hidden" name="intent" value="complete_onboarding" />
                        <input type="hidden" name="plan" value={form.plan} />
                        <input type="hidden" name="studioName" value={form.studioName} />
                        <input type="hidden" name="studioType" value={form.studioType} />
                        <input type="hidden" name="country" value={form.country} />
                        <input type="hidden" name="city" value={form.city} />
                        <input type="hidden" name="phone" value={form.phone} />
                        <input type="hidden" name="ownerName" value={form.ownerName} />
                        <input type="hidden" name="email" value={form.email} />
                        <input type="hidden" name="password" value={form.password} />
                        <input type="hidden" name="payMethod" value={form.payMethod} />
                        
                        {(actionData as any)?.error && (
                            <div className="max-w-xl mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="text-red-400 text-sm font-bold">Error en el registro</p>
                                    <p className="text-red-300/80 text-xs mt-0.5">{(actionData as any).error}</p>
                                </div>
                            </div>
                        )}

                        <StepPayment 
                            form={form} 
                            setForm={setForm} 
                            onBack={back} 
                            isSubmitting={isSubmitting} 
                        />
                    </Form>
                )}
                {step === 5 && <StepSuccess />}
            </div>
        </div>
    );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="max-w-xl mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <p className="text-red-400 text-sm font-bold">Algo salió mal.</p>
                        <p className="text-red-300/80 text-xs mt-0.5">Por favor, intenta de nuevo o contacta a soporte.</p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
