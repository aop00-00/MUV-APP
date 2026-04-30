// app/routes/gym-portal.tsx
// Dynamic /:slug route — full white-label landing page for each gym.
// Also serves as login/register portal when no slug matches a landing section.

import { useState } from "react";
import { Form, useNavigation, Link, useRouteLoaderData } from "react-router";
import {
    MapPin, Phone, Mail, Instagram, Facebook, MessageCircle,
    Clock, Users, ChevronRight, Star, Calendar,
} from "lucide-react";
import type { Route } from "./+types/gym-portal";
import type { GymLandingData } from "~/services/gym-lookup.server";

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ params, request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const host = url.hostname;
    const appDomain = process.env.APP_DOMAIN || "projectstudio.app";

    const isMainDomain =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === appDomain ||
        host === `www.${appDomain}` ||
        host.endsWith(".vercel.app") ||
        host.endsWith(`.${appDomain}`);

    const { getGymLandingData, getGymLandingDataByDomain } = await import("~/services/gym-lookup.server");

    let gym: GymLandingData | null = null;

    // Custom domain takes priority over slug
    if (!isMainDomain) {
        gym = await getGymLandingDataByDomain(host);
    }

    // Fall back to slug lookup (subdomain or direct /:slug)
    if (!gym) {
        const slug = params.slug;
        if (!slug) throw new Response("Not Found", { status: 404 });
        gym = await getGymLandingData(slug);
    }

    if (!gym) {
        throw new Response("Estudio no encontrado", { status: 404 });
    }

    // If user is already logged in and belongs to this gym, redirect to their panel
    try {
        const { getSession } = await import("~/services/auth.server");
        const session = await getSession(request);
        const userId = session.get("user_id") as string | undefined;

        if (userId) {
            const { supabaseAdmin } = await import("~/services/supabase.server");
            const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("role, gym_id")
                .eq("id", userId)
                .single();

            if (profile?.gym_id === gym.id) {
                const redirectMap: Record<string, string> = {
                    admin: "/admin",
                    coach: "/barista",
                    member: "/dashboard",
                    front_desk: "/staff",
                };
                throw new Response(null, {
                    status: 302,
                    headers: { Location: redirectMap[profile.role] || "/dashboard" },
                });
            }
        }
    } catch (e) {
        if (e instanceof Response) throw e;
    }

    return { gym };
}

// ─── Meta ────────────────────────────────────────────────────────
export function meta({ data }: Route.MetaArgs) {
    const gym = data?.gym;
    const name = gym?.name || "Estudio";
    const desc = gym?.tagline || gym?.description || `Reserva clases en ${name}`;
    return [
        { title: name },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        ...(gym?.hero_image_url ? [{ property: "og:image", content: gym.hero_image_url }] : []),
    ];
}

// ─── Action ──────────────────────────────────────────────────────
export async function action({ params, request }: Route.ActionArgs) {
    const url = new URL(request.url);
    const host = url.hostname;
    const appDomain = process.env.APP_DOMAIN || "projectstudio.app";
    const isMainDomain =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === appDomain ||
        host === `www.${appDomain}` ||
        host.endsWith(".vercel.app") ||
        host.endsWith(`.${appDomain}`);

    const { getGymBySlug, getGymByCustomDomain } = await import("~/services/gym-lookup.server");

    let gym = null;
    if (!isMainDomain) {
        gym = await getGymByCustomDomain(host);
    }
    if (!gym) {
        const slug = params.slug;
        if (!slug) throw new Response("Not Found", { status: 404 });
        gym = await getGymBySlug(slug);
    }
    if (!gym) throw new Response("Estudio no encontrado", { status: 404 });

    const { handleGymAuth } = await import("~/services/gym-auth.server");
    const formData = await request.formData();
    return handleGymAuth(request, gym, formData);
}

// ─── Helpers ─────────────────────────────────────────────────────
function fmtPrice(price: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
    }).format(price);
}

function fmtTime(iso: string, tz: string) {
    return new Date(iso).toLocaleString("es-MX", {
        weekday: "short", hour: "2-digit", minute: "2-digit",
        timeZone: tz || "America/Mexico_City",
    });
}

// ─── Auth Modal ───────────────────────────────────────────────────
function AuthModal({
    gym,
    onClose,
    actionData,
}: {
    gym: GymLandingData;
    onClose: () => void;
    actionData: any;
}) {
    const [view, setView] = useState<"login" | "register">("register");
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const color = gym.primary_color || "#7c3aed";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gym header */}
                <div className="p-6 border-b border-white/10 flex items-center gap-4">
                    {gym.logo_url ? (
                        <img src={gym.logo_url} alt={gym.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: color + "30" }}
                        >
                            💪
                        </div>
                    )}
                    <div>
                        <h2 className="text-white font-bold text-lg">{gym.name}</h2>
                        <p className="text-white/40 text-xs">Crea tu cuenta o inicia sesión</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Tab toggle */}
                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-6">
                        {(["register", "login"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
                                style={view === v ? { backgroundColor: color + "30", color: "white" } : { color: "rgba(255,255,255,0.4)" }}
                            >
                                {v === "register" ? "REGISTRARME" : "YA TENGO CUENTA"}
                            </button>
                        ))}
                    </div>

                    {view === "register" ? (
                        <Form method="post" className="space-y-4">
                            <input type="hidden" name="intent" value="register" />
                            <input
                                type="text" name="full_name" required placeholder="Nombre completo"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            <input
                                type="email" name="email" required placeholder="tu@email.com"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            <input
                                type="password" name="password" required minLength={6} placeholder="Contraseña (mín. 6 caracteres)"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            {actionData?.error && (
                                <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{actionData.error}</p>
                            )}
                            <button
                                type="submit" disabled={isSubmitting}
                                className="w-full text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                                style={{ backgroundColor: color }}
                            >
                                {isSubmitting ? "CREANDO..." : "CREAR MI CUENTA"}
                            </button>
                        </Form>
                    ) : (
                        <Form method="post" className="space-y-4">
                            <input type="hidden" name="intent" value="login" />
                            <input
                                type="email" name="email" required placeholder="tu@email.com"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            <input
                                type="password" name="password" required placeholder="Contraseña"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            {actionData?.error && (
                                <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{actionData.error}</p>
                            )}
                            <button
                                type="submit" disabled={isSubmitting}
                                className="w-full text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                                style={{ backgroundColor: color }}
                            >
                                {isSubmitting ? "ENTRANDO..." : "ENTRAR"}
                            </button>
                        </Form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Section: Hero ────────────────────────────────────────────────
function HeroSection({ gym, onCta }: { gym: GymLandingData; onCta: () => void }) {
    const color = gym.primary_color || "#7c3aed";
    return (
        <section
            className="relative min-h-screen flex items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${color}22 100%)` }}
        >
            {gym.hero_image_url && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url(${gym.hero_image_url})` }}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />

            <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
                {gym.logo_url && (
                    <img src={gym.logo_url} alt={gym.name} className="w-20 h-20 rounded-2xl mx-auto mb-8 object-cover shadow-2xl" />
                )}
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-4">
                    {gym.name}
                </h1>
                {gym.tagline && (
                    <p className="text-xl md:text-2xl text-white/70 mb-8 max-w-2xl mx-auto font-medium">
                        {gym.tagline}
                    </p>
                )}
                {gym.description && (
                    <p className="text-white/50 mb-10 max-w-xl mx-auto text-lg leading-relaxed">
                        {gym.description}
                    </p>
                )}
                <button
                    onClick={onCta}
                    className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all hover:scale-105 shadow-2xl"
                    style={{ backgroundColor: color }}
                >
                    Reservar clase <ChevronRight className="size-5" />
                </button>
                {gym.city && (
                    <p className="text-white/30 mt-6 flex items-center justify-center gap-1.5 text-sm">
                        <MapPin className="size-4" /> {gym.city}
                    </p>
                )}
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20 animate-bounce">
                <div className="w-px h-8 bg-white/20" />
            </div>
        </section>
    );
}

// ─── Section: Classes ─────────────────────────────────────────────
function ClassesSection({ gym }: { gym: GymLandingData }) {
    const color = gym.primary_color || "#7c3aed";
    if (!gym.class_types.length) return null;
    return (
        <section className="py-24 px-6 bg-black">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm uppercase tracking-widest font-semibold mb-3" style={{ color }}>
                        Disciplinas
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                        Clases que transforman
                    </h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gym.class_types.map((ct) => (
                        <div
                            key={ct.id}
                            className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all hover:border-white/20"
                        >
                            <div
                                className="w-3 h-3 rounded-full mb-4"
                                style={{ backgroundColor: ct.color || color }}
                            />
                            <h3 className="text-xl font-bold text-white mb-2">{ct.name}</h3>
                            {ct.description && (
                                <p className="text-white/50 text-sm leading-relaxed mb-4">{ct.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-white/30 text-xs">
                                <span className="flex items-center gap-1"><Clock className="size-3" /> {ct.duration} min</span>
                                {ct.credits_required > 0 && (
                                    <span className="flex items-center gap-1"><Star className="size-3" /> {ct.credits_required} créditos</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Section: Schedule ────────────────────────────────────────────
function ScheduleSection({ gym }: { gym: GymLandingData }) {
    const color = gym.primary_color || "#7c3aed";
    if (!gym.upcoming_classes.length) return null;
    return (
        <section className="py-24 px-6" style={{ background: "#0a0a0a" }}>
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm uppercase tracking-widest font-semibold mb-3" style={{ color }}>
                        Próximas clases
                    </p>
                    <h2 className="text-4xl font-black text-white tracking-tight">Horario</h2>
                </div>
                <div className="space-y-3">
                    {gym.upcoming_classes.map((cls) => {
                        const pct = cls.capacity > 0 ? Math.round((cls.current_enrolled / cls.capacity) * 100) : 0;
                        const isFull = cls.current_enrolled >= cls.capacity;
                        return (
                            <div
                                key={cls.id}
                                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4"
                            >
                                <div
                                    className="hidden sm:flex w-1 self-stretch rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold truncate">{cls.title}</p>
                                    <p className="text-white/40 text-sm mt-0.5">
                                        {fmtTime(cls.start_time, "America/Mexico_City")}
                                        {cls.coach_name && ` · ${cls.coach_name}`}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-white/30 text-xs mb-1">
                                        {cls.current_enrolled}/{cls.capacity}
                                    </p>
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${pct}%`,
                                                backgroundColor: isFull ? "#ef4444" : color,
                                            }}
                                        />
                                    </div>
                                </div>
                                {isFull && (
                                    <span className="text-xs text-red-400 font-bold shrink-0">LLENO</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ─── Section: Coaches ─────────────────────────────────────────────
function CoachesSection({ gym }: { gym: GymLandingData }) {
    const color = gym.primary_color || "#7c3aed";
    if (!gym.coaches.length) return null;
    return (
        <section className="py-24 px-6 bg-black">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm uppercase tracking-widest font-semibold mb-3" style={{ color }}>
                        Equipo
                    </p>
                    <h2 className="text-4xl font-black text-white tracking-tight">Nuestros coaches</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gym.coaches.map((coach) => (
                        <div key={coach.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                            <div
                                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white"
                                style={{ backgroundColor: color + "30" }}
                            >
                                {coach.name.charAt(0)}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">{coach.name}</h3>
                            {coach.specialties?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {coach.specialties.map((s: string) => (
                                        <span
                                            key={s}
                                            className="text-xs px-2 py-0.5 rounded-full border"
                                            style={{ borderColor: color + "50", color }}
                                        >
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Section: Pricing ─────────────────────────────────────────────
function PricingSection({ gym, onCta }: { gym: GymLandingData; onCta: () => void }) {
    const color = gym.primary_color || "#7c3aed";
    if (!gym.plans.length) return null;
    return (
        <section className="py-24 px-6" style={{ background: "#0a0a0a" }}>
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm uppercase tracking-widest font-semibold mb-3" style={{ color }}>
                        Membresías
                    </p>
                    <h2 className="text-4xl font-black text-white tracking-tight">Elige tu plan</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gym.plans.map((plan, i) => {
                        const isHighlighted = i === Math.floor(gym.plans.length / 2);
                        return (
                            <div
                                key={plan.id}
                                className="relative rounded-2xl p-6 border flex flex-col"
                                style={
                                    isHighlighted
                                        ? { backgroundColor: color + "15", borderColor: color + "50" }
                                        : { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" }
                                }
                            >
                                {isHighlighted && (
                                    <span
                                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full text-white"
                                        style={{ backgroundColor: color }}
                                    >
                                        MÁS POPULAR
                                    </span>
                                )}
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                {plan.description && (
                                    <p className="text-white/50 text-sm mb-4 flex-1">{plan.description}</p>
                                )}
                                <div className="mt-auto pt-4 border-t border-white/10">
                                    <p className="text-3xl font-black text-white mb-4">
                                        {fmtPrice(plan.price, gym.currency)}
                                    </p>
                                    <button
                                        onClick={onCta}
                                        className="w-full font-bold py-3 rounded-xl transition-all hover:opacity-90 text-sm"
                                        style={
                                            isHighlighted
                                                ? { backgroundColor: color, color: "white" }
                                                : { backgroundColor: "rgba(255,255,255,0.1)", color: "white" }
                                        }
                                    >
                                        Elegir plan
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ─── Section: CTA ─────────────────────────────────────────────────
function CtaSection({ gym, onCta }: { gym: GymLandingData; onCta: () => void }) {
    const color = gym.primary_color || "#7c3aed";
    return (
        <section className="py-24 px-6 text-center bg-black border-t border-white/5">
            <div className="max-w-2xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
                    ¿Listo para empezar?
                </h2>
                <p className="text-white/50 text-lg mb-10">
                    Únete a {gym.name} y reserva tu primera clase hoy.
                </p>
                <button
                    onClick={onCta}
                    className="inline-flex items-center gap-2 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all hover:scale-105 shadow-2xl"
                    style={{ backgroundColor: color }}
                >
                    Crear mi cuenta gratis <ChevronRight className="size-5" />
                </button>
            </div>
        </section>
    );
}

// ─── Section: Contact ─────────────────────────────────────────────
function ContactSection({ gym }: { gym: GymLandingData }) {
    const hasContact = gym.phone || gym.email || gym.address || gym.instagram_url || gym.facebook_url || gym.whatsapp_url;
    if (!hasContact) return null;
    const color = gym.primary_color || "#7c3aed";

    return (
        <section className="py-16 px-6 border-t border-white/5" style={{ background: "#0a0a0a" }}>
            <div className="max-w-4xl mx-auto flex flex-wrap gap-8 justify-center">
                {gym.address && (
                    <a
                        href={gym.maps_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                    >
                        <MapPin className="size-4" style={{ color }} />
                        {gym.address}{gym.city ? `, ${gym.city}` : ""}
                    </a>
                )}
                {gym.phone && (
                    <a href={`tel:${gym.phone}`} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                        <Phone className="size-4" style={{ color }} /> {gym.phone}
                    </a>
                )}
                {gym.email && (
                    <a href={`mailto:${gym.email}`} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                        <Mail className="size-4" style={{ color }} /> {gym.email}
                    </a>
                )}
                {gym.instagram_url && (
                    <a href={gym.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                        <Instagram className="size-4" style={{ color }} /> Instagram
                    </a>
                )}
                {gym.facebook_url && (
                    <a href={gym.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                        <Facebook className="size-4" style={{ color }} /> Facebook
                    </a>
                )}
                {gym.whatsapp_url && (
                    <a href={gym.whatsapp_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                        <MessageCircle className="size-4" style={{ color }} /> WhatsApp
                    </a>
                )}
            </div>
        </section>
    );
}

// ─── Footer ───────────────────────────────────────────────────────
function GymFooter({ gym }: { gym: GymLandingData }) {
    return (
        <footer className="py-8 px-6 bg-black border-t border-white/5 text-center">
            <p className="text-white/20 text-xs">
                © {new Date().getFullYear()} {gym.name} · Powered by{" "}
                <a href="https://grindproject.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">
                    Grind Project
                </a>
            </p>
        </footer>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function GymPortal({ loaderData, actionData }: Route.ComponentProps) {
    const { gym } = loaderData;
    const [showAuth, setShowAuth] = useState(false);
    const color = gym.primary_color || "#7c3aed";

    const sections = gym.landing_sections ?? ["hero", "classes", "schedule", "coaches", "pricing", "cta"];

    return (
        <div className="min-h-screen bg-black font-sans">
            {/* Floating nav */}
            <nav className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {gym.logo_url ? (
                        <img src={gym.logo_url} alt={gym.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                        <span className="text-xl">💪</span>
                    )}
                    <span className="text-white font-bold text-sm hidden sm:block">{gym.name}</span>
                </div>
                <button
                    onClick={() => setShowAuth(true)}
                    className="text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90"
                    style={{ backgroundColor: color }}
                >
                    Ingresar
                </button>
            </nav>

            {/* WhatsApp floating button */}
            {gym.whatsapp_url && (
                <a
                    href={gym.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                >
                    <MessageCircle className="size-7 text-white" />
                </a>
            )}

            {/* Sections */}
            {sections.includes("hero") && <HeroSection gym={gym} onCta={() => setShowAuth(true)} />}
            {sections.includes("classes") && <ClassesSection gym={gym} />}
            {sections.includes("schedule") && <ScheduleSection gym={gym} />}
            {sections.includes("coaches") && <CoachesSection gym={gym} />}
            {sections.includes("pricing") && <PricingSection gym={gym} onCta={() => setShowAuth(true)} />}
            {sections.includes("cta") && <CtaSection gym={gym} onCta={() => setShowAuth(true)} />}
            <ContactSection gym={gym} />
            <GymFooter gym={gym} />

            {/* Auth modal */}
            {showAuth && (
                <AuthModal
                    gym={gym}
                    onClose={() => setShowAuth(false)}
                    actionData={actionData}
                />
            )}
        </div>
    );
}
