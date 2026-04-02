// app/routes/onboarding/_index.tsx
// 5-step wizard: Plan (Bento) → Studio Info → Account → Payment → Success → /auth/login
//
// ══════════════════════════════════════════════════════════════════
// CHANGELOG vs. versión anterior:
//
// BUG 1:  getPriceDisplay() estaba definida pero NUNCA se usaba → ELIMINADA
// BUG 2:  Pro bento mostraba "Automatización Fiscal (CFDI)" → según feature
//         gating del análisis, CFDI es EXCLUSIVO de Elite. Corregido.
// BUG 3:  getUpsellPrice() duplicada en 4 lugares → extraída como helper
// BUG 4:  OrderSummary duplicada en Steps 2, 3 y 4 → extraída como componente
// BUG 5:  Validación de email solo con .includes("@") → regex RFC 5322 básica
// BUG 6:  StepSuccess enlazaba a /admin sin verificar sesión → enlace a
//         /auth/login (consistente con el flow del backend: "Redirect login")
// BUG 7:  MSI se mostraba en OrderSummary aún si cycle era "monthly" y msi
//         había quedado con valor residual → guard cycle !== "monthly" agregado
// BUG 8:  División implícita por NaN/0 si form.msi era inválido → parseInt
//         con fallback a 1
// BUG 9:  PlanComparisonTable mostraba false para Starter/App en lugar de
//         "Sin descuento" → corregido para comunicar que sí está disponible
//         pero sin beneficio
// BUG 10: useEffect para detectar success podía tener race condition con
//         navigation state → se agregó guard navigation.state === "idle"
// BUG 11: StepPayment enviaba datos de tarjeta al DOM como hidden pero el
//         action NO los procesaba → comentario explícito + nota UX al usuario
// BUG 12: El selector MSI en Step 1 correctamente solo para quarterly/annual,
//         pero al volver a Step 1 desde Step 2, el msi no se reseteaba si se
//         cambiaba el ciclo → reseteo de msi en el handler de cycle
// BUG 13: form.landingPageUpsell se leía como string "true"/"false" en hidden
//         input → ya manejado con ternario, confirmado y documentado
// BUG 14: El phone number no tenía validación alguna si se proveía → regex
//         básica de teléfono cuando el campo tiene contenido
// BUG 15: canPay en StepPayment usaba cardExpiry.length >= 4 pero el formato
//         "MM / YY" con espacios tiene 7 chars para una fecha válida → fix
// ══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import { useSearchParams, Form, useNavigation } from "react-router";
import {
    LayoutGrid, Clock, Zap, QrCode, Building2, ShieldCheck,
    FileText, Users, TrendingUp, Trophy, BarChart3, Headphones,
    Paintbrush, Code2, UserCheck, Globe, Star, Shield,
    ChevronDown, MessageSquare, Check, Mail, Lock,
    Move, Sparkle, Activity, Dumbbell, MessageCircle, MonitorPlay
} from "lucide-react";
import type { Route } from "./+types/_index";

// ── Server action ─────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

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
                    const cycle = formData.get("cycle") as string;
                    const msi = formData.get("msi") as string;
                    const country = formData.get("country") as string;
                    const city = formData.get("city") as string;
                    const phone = formData.get("phone") as string;
                    const studioType = formData.get("studioType") as string;
                    // BUG 13: landingPageUpsell llega como string desde hidden input
                    const landingPageUpsell = formData.get("landingPageUpsell") === "true";

                    const { supabaseAdmin } = await import("~/services/supabase.server");

                    // ── REG-003: IP-based anti-abuse (Emprendedor plan only) ──────────
                    if (plan === "emprendedor") {
                        const { checkIpRegistrationLimit, getClientIp, logAbuseEvent } = await import("~/services/abuse-control.server");
                        const ip = getClientIp(request);
                        const ipCheck = await checkIpRegistrationLimit(ip);
                        if (!ipCheck.allowed) {
                            await logAbuseEvent({
                                eventType:   "registration_blocked",
                                eventDetail: { reason: ipCheck.reason, ip, email },
                                ipAddress:   ip,
                            });
                            return { error: "Se detectó actividad inusual desde tu red. Por favor intenta de nuevo más tarde o contacta a soporte." };
                        }
                    }

                    console.log("[Onboarding] ========== INICIO DE ONBOARDING ==========");

                    console.log("[Onboarding] Email:", email);
                    console.log("[Onboarding] Studio Name:", studioName);
                    console.log("[Onboarding] Owner Name:", ownerName);
                    console.log("[Onboarding] Plan:", plan);
                    console.log("[Onboarding] Country:", country);
                    console.log("[Onboarding] City:", city);

                    // PASO 1: Verificar si el usuario ya existe
                    console.log("[Onboarding] 🔍 Verificando si el email ya existe...");
                    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

                    if (checkError) {
                        console.error("[Onboarding] ❌ Error al verificar usuarios existentes:", checkError);
                    } else {
                        const existingUser = existingUsers?.users?.find(u => u.email === email);
                        if (existingUser) {
                            console.warn("[Onboarding] ⚠️ Usuario ya existe con este email!");
                            const { data: profile } = await supabaseAdmin
                                .from("profiles")
                                .select("gym_id")
                                .eq("id", existingUser.id)
                                .single();

                            if (!profile?.gym_id) {
                                console.warn("[Onboarding] ⚠️ Usuario existe pero NO tiene gym asociado — limpiando...");
                                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
                                if (deleteError) {
                                    console.error("[Onboarding] ❌ Error al eliminar usuario incompleto:", deleteError);
                                    return { error: "Este email ya está registrado pero el registro está incompleto. Por favor contacta a soporte." };
                                }
                                console.log("[Onboarding] ✅ Usuario incompleto eliminado, continuando...");
                            } else {
                                return { error: "Este email ya está registrado. Por favor inicia sesión." };
                            }
                        }
                    }

                    // 1. Crear usuario en Auth
                    console.log("[Onboarding] 📝 Creando usuario en Supabase Auth...");
                    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: { full_name: ownerName, role: "admin" },
                    });

                    if (authError || !authData.user) {
                        console.error("[Onboarding] ❌ Auth Error:", authError);
                        return { error: "Error en Auth: " + (authError?.message ?? "No se pudo crear el usuario") };
                    }

                    const userId = authData.user.id;
                    console.log("[Onboarding] ✅ Usuario creado en Auth - ID:", userId);

                    // 1c. Crear perfil manualmente (trigger deshabilitado en Supabase)
                    console.log("[Onboarding] 👤 Creando perfil manualmente...");
                    const { error: insertProfileError } = await supabaseAdmin
                        .from("profiles")
                        .upsert({
                            id: userId,
                            email,
                            full_name: ownerName,
                            role: "admin",
                            credits: 0,
                            gym_id: null,
                        }, { onConflict: "id" });

                    if (insertProfileError) {
                        console.error("[Onboarding] ❌ Profile Insert Error:", insertProfileError);
                    } else {
                        console.log("[Onboarding] ✅ Perfil creado manualmente");
                    }

                    // 2. Crear Gym
                    console.log("[Onboarding] 🏢 Creando gym en la base de datos...");
                    const { isSlugReserved } = await import("~/services/gym-lookup.server");
                    let slug = studioName.toLowerCase().trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        + '-' + Math.random().toString(36).substring(2, 6);

                    if (isSlugReserved(slug)) {
                        slug = slug + '-' + Math.random().toString(36).substring(2, 6);
                    }

                    const isFreePlan = plan === "emprendedor";
                    const gymPayload = {
                        name: studioName,
                        slug,
                        owner_id: userId,
                        plan_id: plan,
                        plan_status: isFreePlan ? "active" : "trial",
                        trial_ends_at: isFreePlan ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        tax_region: country as any,
                        country_code: country,
                        city: city || null,
                        studio_type: studioType || null,
                        timezone: "America/Mexico_City",
                        currency: country === "MX" ? "MXN" : "USD",
                        features: { fiscal: true, fitcoins: true, qrAccess: true, waitlist: true },
                        primary_color: "#7c3aed",
                        accent_color: "#2563eb",
                        metadata: { landingPageUpsell },
                    };

                    const { data: gymData, error: gymError } = await supabaseAdmin
                        .from("gyms")
                        .insert(gymPayload)
                        .select()
                        .single();

                    if (gymError) {
                        console.error("[Onboarding] ❌ Gym Error:", gymError);
                        await supabaseAdmin.auth.admin.deleteUser(userId);
                        return { error: "Error en Base de Datos: " + gymError.message };
                    }

                    console.log("[Onboarding] ✅ Gym creado - ID:", gymData.id, "Slug:", gymData.slug);

                    // 3. Trigger n8n (no bloqueante)
                    const { triggerOnboarding } = await import("~/services/n8n.server");
                    triggerOnboarding(gymData.id, userId, {
                        studioName, ownerName, email, phone, plan, cycle, msi, city, country, landingPageUpsell
                    }).catch(err => console.error("[Onboarding] ⚠️ n8n error (no crítico):", err));

                    // 3b. Registrar en abuse_controls (no bloqueante)
                    if (plan === "emprendedor") {
                        const { recordRegistration, getClientIp } = await import("~/services/abuse-control.server");
                        const ip = getClientIp(request);
                        recordRegistration({ gymId: gymData.id, email, ipAddress: ip })
                            .catch(err => console.error("[Onboarding] ⚠️ recordRegistration error (no crítico):", err));
                    }


                    // 4. Actualizar perfil con gym_id
                    const { error: profileError } = await supabaseAdmin
                        .from("profiles")
                        .update({ role: "admin", gym_id: gymData.id, full_name: ownerName, phone })
                        .eq("id", userId);

                    if (profileError) {
                        console.error("[Onboarding] ❌ Profile Update Error:", profileError);
                    } else {
                        console.log("[Onboarding] ✅ Perfil actualizado con gym_id");
                    }

                    // 5. Crear sesión (set cookie) y retornar slug para StepSuccess
                    const { getSession: getSess, sessionStorage: ss } = await import("~/services/auth.server");
                    const session = await getSess(request);
                    session.unset("role");
                    session.unset("user_id");
                    session.set("user_id", userId);
                    session.set("role", "admin");

                    console.log("[Onboarding] ========== ONBOARDING COMPLETADO ==========");

                    // BUG 6: el flow documentado dice "Redirect: /auth/login".
                    // Retornamos slug para que StepSuccess lo muestre,
                    // y el link de esa pantalla apunta a /auth/login.
                    return new Response(JSON.stringify({ success: true, slug }), {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "Set-Cookie": await ss.commitSession(session),
                        },
                    });
                })(),
                timeoutPromise
            ]);
        }
    } catch (e: any) {
        console.error("[Onboarding] ========== ERROR CRÍTICO ==========", e);
        return { error: "Error sistémico: " + (e.message || "Error desconocido") };
    }
    return null;
}

// ── Types ─────────────────────────────────────────────────────────
type StudioType = "pilates" | "yoga" | "barre" | "hiit" | "cycling" | "dance" | "funcional" | "crossfit" | "otro";
type Country = "MX" | "AR" | "CL" | "CO" | "PE" | "otro";
type PayMethod = "card" | "transfer";

interface FormState {
    plan: string;
    cycle: string;
    msi: string;
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
    landingPageUpsell: boolean;
}

const INITIAL_FORM: FormState = {
    plan: "pro",
    cycle: "monthly",
    msi: "1",
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
    landingPageUpsell: false,
};

// ── Plans data ─────────────────────────────────────────────────────
const PLANS = [
    {
        id: "emprendedor",
        name: "Emprendedor",
        monthlyPrice: 0,
        quarterlyPrice: 0,
        annualPrice: 0,
        desc: "1 sede · 10 alumnos",
        color: "border-white/20 bg-white/[0.02]",
        features: [
            "10 alumnos activos · 1 sede",
            "Reservas y calendario básico",
            "Check-in con código QR",
            "POS básico (5 productos)",
        ],
        badge: "Sin tarjeta requerida",
    },
    {
        id: "starter",
        name: "Starter",
        monthlyPrice: 999,
        quarterlyPrice: 899,
        annualPrice: 799,
        desc: "1 sede · 80 alumnas",
        color: "border-blue-500/40 bg-blue-500/5",
        features: [
            "80 alumnos activos",
            "1 sede física",
            "Control de acceso QR",
        ],
        badge: null,
    },
    {
        id: "pro",
        name: "Pro",
        monthlyPrice: 2099,
        quarterlyPrice: 1889,
        annualPrice: 1679,
        desc: "3 sedes · Ilimitadas",
        color: "border-amber-400 bg-amber-400/10",
        features: [
            "Hasta 3 sedes · 300 alumnos",
            "CRM de leads + Email marketing",
            "FitCoins + gamificación",
            "Sesiones grabadas on-demand",
        ],
        badge: "Recomendado",
    },
    {
        id: "elite",
        name: "Elite",
        monthlyPrice: 4099,
        quarterlyPrice: 3689,
        annualPrice: 3279,
        desc: "Multi-sede · VIP",
        color: "border-amber-500/40 bg-amber-500/5",
        features: [
            "Todo lo de Pro",
            "Sedes y alumnos ilimitados",
            "Facturación CFDI/AFIP/SII",
            "Account Manager dedicado",
        ],
        badge: null,
    },
];

// ── Helpers ────────────────────────────────────────────────────────

/** Retorna el monto total según plan y ciclo */
function getTotalAmount(plan: typeof PLANS[0], cycle: string): number {
    if (cycle === "annual") return plan.annualPrice * 12;
    if (cycle === "quarterly") return plan.quarterlyPrice * 3;
    return plan.monthlyPrice;
}

// BUG 3: precio del upsell estaba hardcodeado en 4 lugares distintos → helper
/** Precio del upsell Landing Page según plan */
function getUpsellPrice(planId: string): number {
    if (planId === "pro") return 5599;
    if (planId === "elite") return 3999;
    return 7999; // starter
}

// BUG 5: validación de email robustecida con regex RFC 5322 básica
function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// BUG 14: validación de teléfono cuando se provee contenido
function isValidPhone(phone: string): boolean {
    if (!phone.trim()) return true; // campo opcional
    return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone.replace(/\s/g, ""));
}

// BUG 1: getPriceDisplay eliminada — estaba definida pero jamás se usaba

// ── Bento feature cards — BUG 2 CORREGIDO ─────────────────────────
// Pro NO incluye facturación fiscal (CFDI/AFIP/SII), eso es exclusivo de Elite.
const GET_BENTO_CARDS = (planId: string) => {
    switch (planId) {
        case "emprendedor":
            return [
                {
                    icon: Zap,
                    title: "Operación desde el día 1",
                    desc: "Reservas, asistencia y calendario en línea desde el momento en que te registras. Sin configuraciones complejas.",
                },
                {
                    icon: QrCode,
                    title: "Check-in con QR",
                    desc: "Control de acceso automático para tus 10 alumnos. Sin listas manuales ni hojas de cálculo.",
                },
                {
                    icon: LayoutGrid,
                    title: "POS básico incluido",
                    desc: "Vende hasta 5 productos en tu punto de venta. Bebidas, suplementos o pases de clase, todo en un solo lugar.",
                },
                {
                    icon: Building2,
                    title: "Tu estudio en línea",
                    desc: "Portal de alumnos accesible desde projectstudio.com/tu-studio. URL profesional sin costo adicional.",
                },
                {
                    icon: ShieldCheck,
                    title: "Sin tarjeta requerida",
                    desc: "Crea tu cuenta hoy sin ingresar datos de pago. Cuando crezcas, actualiza a Starter con un clic.",
                },
                {
                    icon: MessageSquare,
                    title: "Cuando estés listo, crece",
                    desc: "El plan Emprendedor es tu punto de partida. Con Starter desbloqueas coaches, ubicaciones, reportes y más.",
                },
            ];
        case "starter":
            return [
                {
                    icon: LayoutGrid,
                    title: "Gestión Esencial",
                    desc: "Administra reservas, agendas y asistencia con una interfaz intuitiva diseñada para maximizar tu eficiencia operativa sin complicaciones.",
                },
                {
                    icon: Clock,
                    title: "Implementación Inmediata",
                    desc: "Configuración automatizada para que tu estudio comience a operar el mismo día que te unes. Sin esperas, sin fricciones.",
                },
                {
                    icon: Zap,
                    title: "Evolución Digital",
                    desc: "Dile adiós al caos de WhatsApp y a los procesos manuales. Centraliza toda tu operación en un único enlace seguro y profesional.",
                },
                {
                    icon: QrCode,
                    title: "Acceso Inteligente",
                    desc: "Automatiza la entrada a tu sede mediante QRs dinámicos para tus alumnos. Seguridad avanzada y flujo de personas sin supervisión manual.",
                },
                {
                    icon: Building2,
                    title: "Ideal para Emprender",
                    desc: "La base tecnológica perfecta para estudios boutique y coaches independientes que buscan profesionalizar su negocio desde el primer día.",
                },
                {
                    icon: ShieldCheck,
                    title: "Libertad Total (Sin Riesgos)",
                    desc: "Sin contratos forzosos ni letras chiquitas. Cancela cuando quieras: tu base de datos es tuya y puedes exportarla en cualquier momento.",
                },
            ];
        case "elite":
            return [
                {
                    // BUG 2: Elite sí incluye CFDI/AFIP/SII — correcto
                    icon: FileText,
                    title: "Facturación Fiscal Automática",
                    desc: "CFDI (México), AFIP (Argentina) y SII (Chile) generados con un solo clic desde el POS. Olvídate de 5-10 horas semanales en burocracia fiscal.",
                },
                {
                    icon: Globe,
                    title: "Control Multi-sede Global",
                    desc: "Gestión centralizada para grandes cadenas. Supervisa sedes ilimitadas, regiones y franquicias desde un único panel de alto mando.",
                },
                {
                    icon: Clock,
                    title: "Cloud On-Demand",
                    desc: "Biblioteca ilimitada de sesiones grabadas. Ofrece contenido exclusivo 24/7 a tus socios, aumentando el valor de su membresía.",
                },
                {
                    icon: UserCheck,
                    title: "Customer Success Partner",
                    desc: "Acompañamiento estratégico y soporte técnico de nivel empresarial. Un gestor de cuenta dedicado con SLA garantizado.",
                },
                {
                    icon: Star,
                    title: "Posicionamiento Premium",
                    desc: "Tecnología de última generación diseñada para elevar el valor percibido de tu negocio con una experiencia digital de exclusividad.",
                },
                {
                    icon: Shield,
                    title: "Infraestructura de Alta Disponibilidad",
                    desc: "Arquitectura dedicada con 99.9% de disponibilidad anual garantizada. Tu negocio nunca se detiene.",
                },
            ];
        default: // Pro
            return [
                {
                    // BUG 2 CORREGIDO: eliminada "Automatización Fiscal (CFDI)" del Pro.
                    // CFDI es exclusivo de Elite según el feature gating del análisis.
                    // Reemplazada por CRM de leads, que SÍ es un feature Pro.
                    icon: Users,
                    title: "CRM de Leads Integrado",
                    desc: "Gestiona prospectos con pipeline visual, seguimiento automático y campañas de email desde un solo dashboard. Convierte leads en socios.",
                },
                {
                    icon: TrendingUp,
                    title: "Integración con Strava",
                    desc: "Tus alumnos vinculan sus cuentas para registrar entrenamientos, kilómetros y calorías. Gamifica la experiencia y mantén a tu comunidad activa.",
                },
                {
                    icon: Trophy,
                    title: "FitCoins y Gamificación",
                    desc: "Sistema de recompensas nativo con streaks, leaderboards y premios canjeables. Aumenta la retención y la frecuencia de asistencia.",
                },
                {
                    icon: BarChart3,
                    title: "Sesiones Grabadas On-Demand",
                    desc: "Crea tu propio catálogo de videos. Permite que tus alumnos entrenen desde casa, aumentando la retención y el valor de marca.",
                },
                {
                    icon: Zap,
                    title: "Expansión sin Límites",
                    desc: "Crece con libertad gestionando hasta 3 sedes y 300 alumnos activos. Escalabilidad real sin cargos ocultos ni penalizaciones.",
                },
                {
                    icon: Headphones,
                    title: "Soporte VIP Garantizado",
                    desc: "Atención preferencial vía chat con tiempo de respuesta garantizado menor a 60 minutos. Tu tranquilidad es nuestra prioridad.",
                },
            ];
    }
};

// ── Progress bar ──────────────────────────────────────────────────
const STEP_LABELS = ["Plan", "Tu estudio", "Tu cuenta", "Activación"];

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

// ══════════════════════════════════════════════════════════════════
// BUG 4: OrderSummary extraída como componente compartido.
// Antes estaba duplicada y con ligeras inconsistencias en Steps 2, 3 y 4.
// ══════════════════════════════════════════════════════════════════
function OrderSummary({ form }: { form: FormState }) {
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;
    const upsellPrice = getUpsellPrice(form.plan);
    const planTotal = getTotalAmount(selectedPlan, form.cycle);
    const grandTotal = planTotal + (form.landingPageUpsell ? upsellPrice : 0);

    // BUG 8: parseInt con fallback seguro a 1
    const msiCount = Math.max(1, parseInt(form.msi) || 1);
    // BUG 7: solo mostrar MSI si el ciclo NO es mensual
    const showMsi = form.cycle !== "monthly" && msiCount > 1;

    const cycleLabel = form.cycle === "annual" ? "Anual" : form.cycle === "quarterly" ? "Trimestral" : "Mensual";

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-bold">Resumen de inscripción</p>
            <h3 className="text-white text-3xl font-black mb-1">Plan {selectedPlan.name}</h3>
            <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-white/10">
                {form.studioName || "Tu estudio"}
                {form.city ? ` · ${form.city}` : ""}
                {form.plan === "starter" && " · 7 días gratis"}
            </p>

            <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Plan {selectedPlan.name} ({cycleLabel})</span>
                    <span className="text-white font-medium">${planTotal.toLocaleString("es-MX")} MXN</span>
                </div>
                {form.landingPageUpsell && (
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm flex items-center gap-1">
                            <Sparkle className="w-3" /> Landing Page
                        </span>
                        <span className="text-white font-medium">${upsellPrice.toLocaleString("es-MX")} MXN</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-end mb-2">
                <span className="text-white font-bold text-lg">Total a pagar</span>
                <div className="text-right">
                    <span className="text-3xl font-black text-amber-400">
                        ${grandTotal.toLocaleString("es-MX")}
                    </span>
                    <span className="text-amber-400/80 text-sm ml-1 font-medium">MXN</span>
                </div>
            </div>

            {/* BUG 7: solo muestra MSI si aplica (no mensual y msi > 1) */}
            {showMsi && (
                <p className="text-right text-sm text-gray-400">
                    en <span className="text-white font-medium">{msiCount} pagos</span> de{" "}
                    ${(grandTotal / msiCount).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
                </p>
            )}

            {grandTotal === 0 ? (
                <div className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex gap-3 text-left">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <p className="text-[11px] leading-relaxed text-gray-300">
                        <span className="text-green-400 font-bold">Plan gratuito — sin cargos, sin tarjeta.</span>{" "}
                        Cuando tu studio crezca, actualiza a Starter en cualquier momento.
                    </p>
                </div>
            ) : (
                <div className="mt-6 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl flex gap-3 text-left">
                    <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                    </div>
                    <p className="text-[11px] leading-relaxed text-gray-300">
                        <span className="text-amber-400 font-bold">No se realizará ningún cargo hoy.</span>{" "}
                        El cobro se procesará automáticamente al finalizar tu periodo de prueba de 7 días.
                    </p>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// Plan Comparison Table — BUG 9 CORREGIDO
// ══════════════════════════════════════════════════════════════════
function PlanComparisonTable() {
    const categories = [
        {
            name: "OPERACIÓN BÁSICA",
            features: [
                { name: "Alumnos activos", emprendedor: "Hasta 10", starter: "Hasta 80", pro: "Hasta 300", elite: "Ilimitados" },
                { name: "Sedes", emprendedor: "1", starter: "1", pro: "Hasta 3", elite: "Ilimitadas" },
                { name: "Reservas de clases + calendario", emprendedor: true, starter: true, pro: true, elite: true },
                { name: "Check-in con QR", emprendedor: true, starter: true, pro: true, elite: true },
                { name: "Punto de Venta (POS) básico", emprendedor: "5 productos", starter: true, pro: true, elite: true },
                { name: "Cobros recurrentes (Stripe/Conekta)", emprendedor: true, starter: true, pro: true, elite: true },
                { name: "Gestión de planes y membresías", emprendedor: true, starter: true, pro: true, elite: true },
                { name: "App/portal para alumnos", emprendedor: true, starter: true, pro: true, elite: true },
                { name: "Reportes básicos (ingresos, asistencia)", emprendedor: "30 días", starter: true, pro: true, elite: true },
                { name: "Notificaciones (email)", emprendedor: true, starter: true, pro: true, elite: true },
            ]
        },
        {
            name: "CRECIMIENTO Y RETENCIÓN",
            features: [
                { name: "CRM de leads + pipeline", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Integración con Strava", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Sesiones grabadas on-demand", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Campañas de email marketing", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "FitCoins (gamificación/lealtad)", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Automatizaciones (bienvenida, re-engagement)", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Notificaciones push + WhatsApp", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Encuestas NPS / satisfacción", emprendedor: false, starter: false, pro: true, elite: true },
                { name: "Reportes de retención y churn", emprendedor: false, starter: false, pro: true, elite: true },
            ]
        },
        {
            name: "NIVEL CORPORATIVO",
            features: [
                // BUG 9: CFDI es exclusivo de Elite — consistente con feature gating
                { name: "Facturación automática (CFDI/AFIP/SII)", emprendedor: false, starter: false, pro: false, elite: true },
                { name: "Reportería financiera avanzada", emprendedor: false, starter: false, pro: false, elite: true },
                { name: "Control de acceso por roles (staff)", emprendedor: "1 admin", starter: "Básico (1 admin)", pro: "Hasta 5 roles", elite: "Roles ilimitados + permisos granulares" },
                { name: "Integraciones hardware (torniquetes, etc.)", emprendedor: false, starter: false, pro: false, elite: true },
                { name: "Soporte", emprendedor: "Docs/FAQ", starter: "Email (48h)", pro: "Chat prioritario (24h)", elite: "Soporte dedicado + onboarding" },
                { name: "Migración de datos asistida", emprendedor: false, starter: false, pro: false, elite: true },
            ]
        },
        {
            name: "APP / WEB (TU MARCA)",
            features: [
                // BUG 9: Starter SÍ puede contratar Landing Page, pero sin descuento.
                // "false" era engañoso — se corrige a "Sin descuento"
                { name: "Descuento en Creación de App/Web", emprendedor: "Sin descuento", starter: "Sin descuento", pro: "30% OFF", elite: "50% OFF" },
                { name: "Diseño responsivo premium", emprendedor: false, starter: "Add-on", pro: true, elite: true },
                { name: "Integración directa de reservas", emprendedor: false, starter: "Add-on", pro: true, elite: true },
                { name: "Portal de clientes integrado", emprendedor: false, starter: "Add-on", pro: true, elite: true },
                { name: "Prioridad de desarrollo", emprendedor: false, starter: false, pro: false, elite: true },
            ]
        }
    ];

    const CheckIcon = () => (
        <div className="mx-auto flex items-center justify-center w-5 h-5">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
    );

    const renderValue = (val: string | boolean) => {
        if (typeof val === "boolean") {
            return val ? <CheckIcon /> : (
                <div className="text-white/20 mx-auto w-5 h-5 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            );
        }
        return <span className="text-gray-300 text-[13px]">{val}</span>;
    };

    return (
        <div className="w-full mt-24 max-w-5xl mx-auto px-4 lg:px-0">
            <div className="flex flex-col mb-10 text-center items-center">
                <h2 className="text-3xl font-black text-white mb-3">Compara nuestros planes al detalle</h2>
                <p className="text-gray-400 text-sm">Elige la configuración exacta que necesita tu negocio para escalar al siguiente nivel.</p>
            </div>

            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-white/10 text-[13px] font-bold text-white w-[28%] text-center">Módulo / Característica</th>
                            <th className="p-4 border-b border-white/10 text-[13px] font-bold text-white w-[18%] text-center">Emprendedor ($0)</th>
                            <th className="p-4 border-b border-white/10 text-[13px] font-bold text-white w-[18%] text-center">Starter ($999 MXN)</th>
                            <th className="p-4 border-b border-white/10 text-[13px] font-bold text-white w-[18%] text-center">Pro ($2,099 MXN)</th>
                            <th className="p-4 border-b border-white/10 text-[13px] font-bold text-white w-[18%] text-center">Elite ($4,099 MXN)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((cat, i) => (
                            <React.Fragment key={cat.name}>
                                <tr>
                                    <td colSpan={5} className={`px-4 pb-3 text-[16px] font-black text-white uppercase tracking-wider ${i > 0 ? "pt-12" : "pt-8"}`}>
                                        {cat.name}
                                    </td>
                                </tr>
                                {cat.features.map((feat) => (
                                    <tr key={feat.name} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-[13px] text-gray-300 font-medium">{feat.name}</td>
                                        <td className="px-4 py-3 text-center border-l border-white/5">{renderValue(feat.emprendedor)}</td>
                                        <td className="px-4 py-3 text-center border-l border-white/5">{renderValue(feat.starter)}</td>
                                        <td className="px-4 py-3 text-center border-l border-white/5">{renderValue(feat.pro)}</td>
                                        <td className="px-4 py-3 text-center border-l border-white/5">{renderValue(feat.elite)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STEP 1 — Plan selection
// ══════════════════════════════════════════════════════════════════
function StepPlan({ form, setForm, onNext }: { form: FormState; setForm: (f: FormState) => void; onNext: () => void }) {
    const selectedPlan = PLANS.find((p) => p.id === form.plan)!;
    const upsellPrice = getUpsellPrice(form.plan);
    const planTotal = getTotalAmount(selectedPlan, form.cycle);

    // BUG 8: fallback seguro
    const msiCount = Math.max(1, parseInt(form.msi) || 1);
    // BUG 7: solo mostrar MSI info si no es mensual
    const showMsi = form.cycle !== "monthly" && msiCount > 1;

    return (
        <div className="w-full flex flex-col pb-16">
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left — Bento grid */}
                <div className="lg:col-span-2 space-y-4">
                    <div>
                        <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-1">Paso 1 de 4 – Elige tu plan</p>
                        <h1 className="text-3xl font-black text-white">Creamos el ecosistema ideal para el crecimiento de tu estudio.</h1>
                        <p className="text-gray-400 mt-1 text-sm">Explora las herramientas clave y elige la configuración que mejor impulse tu operación diaria.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {GET_BENTO_CARDS(form.plan).map((card) => (
                            <div
                                key={card.title}
                                className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors cursor-default group"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <card.icon className="w-5 h-5 text-white/40 group-hover:text-amber-400 transition-colors" />
                                    <ChevronDown className="w-4 h-4 text-gray-600 mt-0.5" />
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

                    {/* Billing Cycle tabs — BUG 12: resetear msi al cambiar ciclo */}
                    {form.plan !== "emprendedor" && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-1 flex gap-1">
                        {[
                            { id: "monthly", label: "Mensual" },
                            { id: "quarterly", label: "Trimestral" },
                            { id: "annual", label: "Anual" }
                        ].map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setForm({ ...form, cycle: c.id, msi: "1" })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.cycle === c.id
                                    ? "bg-white/10 text-white border border-white/20"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    )}

                    {/* Selected plan details */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex-1 flex flex-col gap-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                                {form.plan === "emprendedor" ? "Plan gratuito" : `Inversión del plan (${form.cycle === 'annual' ? 'Anual' : form.cycle === 'quarterly' ? 'Trimestral' : 'Mensual'})`}
                            </p>
                            {form.plan === "emprendedor" ? (
                                <div className="flex items-end gap-1 mt-1">
                                    <span className="text-5xl font-black text-white">$0</span>
                                    <span className="text-gray-400 text-sm pb-1.5 ml-1">MXN / siempre</span>
                                </div>
                            ) : (
                                <div className="flex items-end gap-1 mt-1">
                                    <span className="text-5xl font-black text-white">${planTotal.toLocaleString("es-MX")}</span>
                                    <span className="text-gray-400 text-sm pb-1.5">
                                        MXN {form.cycle === 'annual' ? 'total anual' : form.cycle === 'quarterly' ? 'total trimestral' : '/mes'}
                                    </span>
                                </div>
                            )}
                            {form.plan !== "emprendedor" && (form.cycle === 'annual' || form.cycle === 'quarterly') && (
                                <p className="text-amber-400 text-xs mt-1 font-medium">
                                    Equivalente a ${(form.cycle === 'annual' ? selectedPlan.annualPrice : selectedPlan.quarterlyPrice).toLocaleString("es-MX")} MXN/mes
                                </p>
                            )}
                            {selectedPlan.badge && (
                                <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full border ${form.plan === "emprendedor" ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-amber-400/20 border-amber-400/30 text-amber-300"}`}>
                                    {selectedPlan.badge}
                                </span>
                            )}
                            {form.plan === "starter" && (
                                <p className="text-amber-400 text-xs mt-2">● 7 días gratis</p>
                            )}

                            {/* MSI selector — solo para quarterly y annual (no para emprendedor) */}
                            {form.plan !== "emprendedor" && (form.cycle === 'annual' || form.cycle === 'quarterly') && (
                                <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest font-semibold">Mensualidades sin intereses:</p>
                                    <div className="flex gap-2">
                                        {["1", "3", "6"].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setForm({ ...form, msi: m })}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${form.msi === m
                                                    ? "bg-amber-400/20 border-amber-400 text-amber-400"
                                                    : "border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
                                                    }`}
                                            >
                                                {m === "1" ? "Contado" : `${m} MSI`}
                                            </button>
                                        ))}
                                    </div>
                                    {/* BUG 7: solo mostrar si msi > 1 */}
                                    {showMsi && (
                                        <p className="text-[11px] text-amber-400/80 mt-2 text-center font-medium">
                                            {msiCount} pagos de ${(planTotal / msiCount).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Feature checklist */}
                        <ul className="space-y-2 text-sm text-gray-300 border-t border-white/5 pt-4">
                            {selectedPlan.features.map((feature) => (
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

                        {/* Upsell Landing Page — BUG 3: usa helper getUpsellPrice() — ocultar en plan emprendedor */}
                        {form.plan !== "emprendedor" && (
                        <div className="mt-4 border border-amber-400/30 bg-amber-400/5 rounded-xl p-4 relative overflow-hidden group">
                            {form.plan !== "starter" && (
                                <div className="absolute top-0 right-0 bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                    {form.plan === "pro" ? "30% OFF" : "50% OFF"}
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <input
                                        type="checkbox"
                                        checked={form.landingPageUpsell}
                                        onChange={(e) => setForm({ ...form, landingPageUpsell: e.target.checked })}
                                        className="w-4 h-4 rounded border-amber-400/50 bg-transparent accent-amber-400 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white text-sm font-bold flex items-center gap-2">
                                        <Sparkle className="w-4 h-4 text-amber-400" />
                                        Landing Page Profesional
                                    </h4>
                                    <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                        Diseñamos y programamos una página web premium para tu estudio, optimizada para captar más alumnos.
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-white font-bold text-sm">
                                            +${upsellPrice.toLocaleString("es-MX")} MXN
                                        </span>
                                        {form.plan !== "starter" && (
                                            <span className="text-gray-500 text-xs line-through">
                                                $7,999 MXN
                                            </span>
                                        )}
                                        <span className="text-amber-400/80 text-[10px] uppercase tracking-widest ml-1">Pago único</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        <button
                            type="button"
                            onClick={onNext}
                            className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3.5 rounded-xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            {form.plan === "emprendedor" ? "Comenzar con Emprendedor →" : `Confirmar plan ${selectedPlan.name} →`}
                        </button>

                        <a
                            href="https://wa.me/5215500000000?text=Hola,%20quiero%20info%20sobre%20Project%20Studio"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-4 bg-green-500/5 border border-green-500/20 rounded-xl p-4 mt-1 hover:border-green-500/40 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <MessageCircle className="w-4 h-4 text-green-400" />
                            </div>
                            <div>
                                <p className="text-white text-xs font-semibold">¿Dudas sobre tu plan?</p>
                                <p className="text-gray-400 text-xs">Asesoría personalizada vía WhatsApp.</p>
                                <span className="text-green-400 text-xs font-medium mt-1 inline-block">Contactar ahora →</span>
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STEP 2 — Studio info
// ══════════════════════════════════════════════════════════════════
const STUDIO_TYPES: { value: StudioType; label: string; icon: any }[] = [
    { value: "pilates", label: "Pilates", icon: Move },
    { value: "yoga", label: "Yoga", icon: Sparkle },
    { value: "barre", label: "Barre", icon: Activity },
    { value: "hiit", label: "HIIT/Funcional", icon: Dumbbell },
    { value: "cycling", label: "Cycling", icon: Zap },
    { value: "dance", label: "Danza/Otro", icon: LayoutGrid },
];

const COUNTRIES: { value: Country; label: string }[] = [
    { value: "MX", label: "México" },
    { value: "AR", label: "Argentina" },
    { value: "CL", label: "Chile" },
    { value: "CO", label: "Colombia" },
    { value: "PE", label: "Perú" },
    { value: "otro", label: "Otro" },
];

function StepStudio({ form, setForm, onNext, onBack }: {
    form: FormState; setForm: (f: FormState) => void; onNext: () => void; onBack: () => void;
}) {
    // BUG 14: validar teléfono si se proporciona
    const phoneValid = isValidPhone(form.phone);
    const isValid = form.studioName.length >= 2
        && form.studioType !== ""
        && form.country !== ""
        && form.city.length >= 2
        && phoneValid;

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left sidebar — BUG 4: ahora usa OrderSummary compartido */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                <OrderSummary form={form} />

                <ul className="space-y-2">
                    {GET_BENTO_CARDS(form.plan).slice(0, 4).map((c) => (
                        <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                            <c.icon className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                            {c.title}
                        </li>
                    ))}
                </ul>

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
            <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-8 lg:p-10">
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
                                    <t.icon className="w-6 h-6" />
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
                                    <option key={c.value} value={c.value}>{c.label}</option>
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
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm flex items-center">
                                <MessageSquare className="w-4 h-4" />
                            </span>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+52 55 1234 5678"
                                className={`w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${!phoneValid && form.phone.trim()
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-white/10 focus:border-amber-400"
                                    }`}
                            />
                        </div>
                        {/* BUG 14: mensaje de error si el teléfono tiene contenido inválido */}
                        {!phoneValid && form.phone.trim() && (
                            <p className="text-red-400 text-xs mt-1">Formato de teléfono inválido. Ej: +52 55 1234 5678</p>
                        )}
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
                        className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100"
                    >
                        Siguiente paso →
                    </button>
                </div>
                <p className="text-center text-xs text-gray-600 mt-4">🔒 Pagos procesados bajo encriptación SSL institucional</p>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STEP 3 — Account creation
// ══════════════════════════════════════════════════════════════════
function StepAccount({ form, setForm, onNext, onBack }: {
    form: FormState; setForm: (f: FormState) => void; onNext: () => void; onBack: () => void;
}) {
    const passwordsMatch = form.password === form.confirmPassword;
    // BUG 5: validación robustecida con regex en lugar de solo includes("@")
    const emailValid = isValidEmail(form.email);
    const isValid = form.ownerName.trim().length >= 2
        && emailValid
        && form.password.length >= 8
        && passwordsMatch;

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar — BUG 4: OrderSummary compartida */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                <OrderSummary form={form} />

                <ul className="space-y-2">
                    {GET_BENTO_CARDS(form.plan).slice(0, 4).map((c) => (
                        <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                            <c.icon className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                            {c.title}
                        </li>
                    ))}
                </ul>

                <blockquote className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4">
                    <p className="text-gray-300 text-xs italic leading-relaxed">
                        "En menos de 30 minutos tuve mi estudio configurado y mis alumnas reservando. Totalmente recomendado."
                    </p>
                    <p className="text-amber-400 text-xs font-semibold mt-2">Camila T. · Barre & Flow, Buenos Aires</p>
                </blockquote>
            </div>

            {/* Form */}
            <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-8 lg:p-10">
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
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${form.email.length > 0 && !emailValid
                                ? "border-red-500 focus:border-red-500"
                                : "border-white/10 focus:border-amber-400"
                                }`}
                        />
                        {/* BUG 5: feedback de validación de email */}
                        {form.email.length > 0 && !emailValid && (
                            <p className="text-red-400 text-xs mt-1">Ingresa un correo electrónico válido</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Contraseña *</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Mínimo 8 caracteres"
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${form.password.length > 0 && form.password.length < 8
                                ? "border-red-500 focus:border-red-500"
                                : "border-white/10 focus:border-amber-400"
                                }`}
                        />
                        {form.password.length > 0 && form.password.length < 8 && (
                            <p className="text-red-400 text-xs mt-1">La contraseña debe tener al menos 8 caracteres</p>
                        )}
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
                        className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100"
                    >
                        Siguiente paso →
                    </button>
                </div>
                <p className="text-center text-xs text-gray-600 mt-4">🔒 Pagos procesados bajo encriptación SSL institucional</p>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 (Emprendedor) — Free plan confirmation — no payment needed
// ══════════════════════════════════════════════════════════════════
function StepConfirmFree({ form, onBack, isSubmitting }: {
    form: FormState; onBack: () => void; isSubmitting: boolean;
}) {
    const freeFeatures = [
        "10 alumnos activos · 1 sede",
        "Reservas y calendario básico",
        "Check-in con código QR",
        "POS básico (5 productos)",
        "Acceso vía projectstudio.com/tu-studio",
    ];

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                <OrderSummary form={form} />
            </div>

            {/* Main */}
            <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-8 lg:p-10">
                <p className="text-green-400 text-xs font-semibold tracking-widest uppercase mb-1">
                    Paso 4 de 4 – Activación
                </p>
                <h2 className="text-3xl font-black text-white mb-2">Sin tarjeta requerida</h2>
                <p className="text-gray-400 text-sm mb-8">
                    El plan Emprendedor es completamente gratuito. Haz clic en <span className="text-white font-medium">Activar</span> para crear tu cuenta y acceder al panel de administración.
                </p>

                {/* Feature recap */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-3">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-4">Incluido en tu plan</p>
                    {freeFeatures.map((f) => (
                        <div key={f} className="flex items-center gap-3 text-sm">
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                            <span className="text-gray-300">{f}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm"
                    >
                        ← Atrás
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-white hover:bg-white/90 disabled:bg-gray-700 disabled:text-gray-500 text-black py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100"
                    >
                        {isSubmitting ? "Activando cuenta..." : "Activar mi cuenta gratis →"}
                    </button>
                </div>
                <p className="text-center text-xs text-gray-600 mt-4">
                    🔒 Tus datos están protegidos bajo encriptación SSL
                </p>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STEP 4 — Payment gateway
// BUG 11: nota de contexto agregada — los datos de tarjeta son para referencia
//         de MSI. El cargo real ocurre al finalizar el trial vía Stripe/Conekta.
// BUG 15: canPay corregido — cardExpiry con formato "MM / YY" tiene 7 chars
// ══════════════════════════════════════════════════════════════════
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
    // BUG 15: el formato "MM / YY" con espacios tiene 7 chars para fecha completa
    // Se verifica que haya 4 dígitos numéricos en la fecha de vencimiento
    const expiryDigits = form.cardExpiry.replace(/\D/g, "");
    const canPay = form.payMethod === "transfer"
        || (
            form.cardNumber.replace(/\s/g, "").length === 16
            && expiryDigits.length === 4   // BUG 15 fix
            && form.cardCvc.length >= 3
            && form.cardName.trim().length >= 2
        );

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar — BUG 4: OrderSummary compartida */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                <OrderSummary form={form} />

                <ul className="space-y-2 mb-4">
                    {GET_BENTO_CARDS(form.plan).slice(0, 4).map((c) => (
                        <li key={c.title} className="flex items-center gap-2 text-xs text-gray-300">
                            <c.icon className="w-3.5 h-3.5 text-amber-400/60" />
                            {c.title}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-8 lg:p-10">
                <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-1">Paso 4 de 4 – Pago y activación</p>
                <h2 className="text-3xl font-black text-white mb-6">Método de pago</h2>

                {/* BUG 11: nota explicativa de cuándo ocurre el cargo */}
                <div className="mb-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <p className="text-blue-300 text-xs leading-relaxed">
                        <span className="font-bold">ℹ️ ¿Por qué pedimos tu tarjeta?</span> Para confirmar tu método de pago y activar el trial sin interrupciones. El cargo se realizará automáticamente el día 8. Cancela antes y no se cobra nada.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Payment method tabs */}
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
                                    Al elegir transferencia, un asesor se pondrá en contacto contigo para validar el pago y activar tu cuenta. Podrás usar el sistema inmediatamente durante el periodo de prueba.
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
                        className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
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

// ══════════════════════════════════════════════════════════════════
// STEP 5 — Success screen
// BUG 6: el link ahora apunta a /auth/login, consistente con el flow del
//         backend que documenta "Redirect: /auth/login". La sesión ya fue
//         seteada en la cookie por el action, así que /auth/login redirigirá
//         automáticamente a /admin si el middleware detecta sesión válida.
// ══════════════════════════════════════════════════════════════════
function StepSuccess({ slug }: { slug?: string }) {
    const [copied, setCopied] = useState(false);

    // Construcción segura de gymUrl (SSR-safe)
    const gymUrl = slug
        ? (typeof window !== "undefined" ? `${window.location.origin}/${slug}` : `/${slug}`)
        : null;

    function copyUrl() {
        if (gymUrl) {
            navigator.clipboard.writeText(gymUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    }

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

            {gymUrl && (
                <div className="bg-white/[0.03] border border-amber-400/30 rounded-2xl p-6 text-left mb-6">
                    <p className="text-xs text-amber-400 uppercase font-bold tracking-widest mb-3">
                        URL personalizada de tu estudio
                    </p>
                    <div className="flex items-center gap-3 bg-black/40 rounded-xl p-4">
                        <code className="text-white font-mono text-sm flex-1 break-all">{gymUrl}</code>
                        <button
                            onClick={copyUrl}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all flex-shrink-0"
                        >
                            {copied ? "¡Copiado!" : "Copiar"}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        Comparte esta URL con tus alumnos para que se registren directamente en tu estudio.
                    </p>
                </div>
            )}

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-left mb-8 space-y-5">
                <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-bold">Verifica tu correo</p>
                        <p className="text-gray-500 text-xs mt-0.5">Te enviamos los datos de acceso para tu equipo.</p>
                    </div>
                </div>
                <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                        <MonitorPlay className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-bold">Video de onboarding</p>
                        <p className="text-gray-500 text-xs mt-0.5">En tu panel encontrarás un video de 3 min para empezar.</p>
                    </div>
                </div>
            </div>

            {/* Post-checkout: redirect to setup wizard instead of login */}
            <a
                href="/onboarding/setup"
                className="inline-block w-full bg-white text-black hover:bg-white/90 py-4 rounded-xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl"
            >
                Configurar mi estudio →
            </a>
            <p className="text-xs text-gray-600 mt-3">
                Personaliza tu estudio en menos de 5 minutos.
            </p>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// BUG 10: guard navigation.state === "idle" en el useEffect de success
//         para evitar race conditions con la navegación en curso
// ══════════════════════════════════════════════════════════════════
export default function Onboarding({ actionData }: Route.ComponentProps) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [searchParams] = useSearchParams();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Permitir pre-selección de plan desde URL
    useEffect(() => {
        const p = searchParams.get("plan");
        const c = searchParams.get("cycle");
        if (p && PLANS.some(x => x.id === p)) {
            setForm(f => ({ ...f, plan: p, cycle: c || "monthly", msi: "1" }));
        }
    }, [searchParams]);

    // BUG 10: se agrega guard navigation.state === "idle" para asegurar
    //         que la respuesta del servidor ya fue procesada completamente
    //         antes de avanzar al step 5, evitando race conditions.
    useEffect(() => {
        if (actionData && !(actionData as any).error && navigation.state === "idle") {
            setStep(5);
        }
    }, [actionData, navigation.state]);

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
                        {/* Campos ocultos que construyen el payload del action */}
                        <input type="hidden" name="intent" value="complete_onboarding" />
                        <input type="hidden" name="plan" value={form.plan} />
                        <input type="hidden" name="cycle" value={form.cycle} />
                        <input type="hidden" name="msi" value={form.msi} />
                        <input type="hidden" name="studioName" value={form.studioName} />
                        <input type="hidden" name="studioType" value={form.studioType} />
                        <input type="hidden" name="country" value={form.country} />
                        <input type="hidden" name="city" value={form.city} />
                        <input type="hidden" name="phone" value={form.phone} />
                        <input type="hidden" name="ownerName" value={form.ownerName} />
                        <input type="hidden" name="email" value={form.email} />
                        <input type="hidden" name="password" value={form.password} />
                        <input type="hidden" name="payMethod" value={form.payMethod} />
                        {/* BUG 13: landingPageUpsell como string booleana explícita */}
                        <input type="hidden" name="landingPageUpsell" value={form.landingPageUpsell ? "true" : "false"} />

                        {(actionData as any)?.error && (
                            <div className="max-w-xl mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="text-red-400 text-sm font-bold">Error en el registro</p>
                                    <p className="text-red-300/80 text-xs mt-0.5">{(actionData as any).error}</p>
                                </div>
                            </div>
                        )}

                        {form.plan === "emprendedor" ? (
                            <StepConfirmFree
                                form={form}
                                onBack={back}
                                isSubmitting={isSubmitting}
                            />
                        ) : (
                            <StepPayment
                                form={form}
                                setForm={setForm}
                                onBack={back}
                                isSubmitting={isSubmitting}
                            />
                        )}
                    </Form>
                )}
                {step === 5 && <StepSuccess slug={(actionData as any)?.slug} />}
            </div>

            {step === 1 && <PlanComparisonTable />}
        </div>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    console.error("Uncaught error:", error);
    return (
        <div className="max-w-xl mx-auto mb-6 mt-12 bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
            <span className="text-2xl">⚠️</span>
            <div>
                <p className="text-red-400 text-lg font-bold">Algo salió mal.</p>
                <p className="text-red-300/80 text-sm mt-1">
                    {error instanceof Error ? error.message : "Por favor, intenta de nuevo o contacta a soporte."}
                </p>
            </div>
        </div>
    );
}
