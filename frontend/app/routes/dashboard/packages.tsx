// Auth service moved to dynamic import inside loader
import type { Route } from "./+types/packages";
import { useDashboardTheme } from "~/hooks/useDashboardTheme";
import { useState } from "react";
import { useNavigate, useFetcher } from "react-router";
import { X, Sparkles, Users, MapPin, Clock, Calendar, CreditCard, CheckCircle, Lock, ChevronRight } from "lucide-react";

// ─── Action ─────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "register_event") {
        const eventId = formData.get("eventId") as string;

        const { data: eventData } = await supabaseAdmin
            .from("events")
            .select("id, max_capacity, current_enrolled")
            .eq("id", eventId)
            .eq("gym_id", gymId)
            .single();

        if (!eventData) return { success: false, error: "Evento no encontrado" };
        if ((eventData.current_enrolled ?? 0) >= (eventData.max_capacity ?? 0)) {
            return { success: false, error: "El evento está lleno" };
        }

        const { error: regError } = await supabaseAdmin
            .from("event_registrations")
            .upsert(
                { user_id: profile.id, event_id: eventId, gym_id: gymId, status: "confirmed" },
                { onConflict: "user_id,event_id" }
            );

        if (regError) return { success: false, error: regError.message };

        // Incrementar current_enrolled de forma segura
        await supabaseAdmin
            .from("events")
            .update({ current_enrolled: (eventData.current_enrolled ?? 0) + 1 })
            .eq("id", eventId)
            .eq("gym_id", gymId);

        return { success: true, intent: "register_event" };
    }

    return { success: false };
}

// ─── Loader (Supabase) ──────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const { getActivePlans } = await import("~/services/plan.server");
    const { getActiveEvents } = await import("~/services/event.server");

    const [[rawPlans, rawEvents], gymResult] = await Promise.all([
        Promise.all([getActivePlans(gymId), getActiveEvents(gymId)]),
        supabaseAdmin.from("gyms").select("brand_color, primary_color, name").eq("id", gymId).single(),
    ]);

    const brandColor = gymResult.data?.brand_color || gymResult.data?.primary_color || "#7c3aed";
    const gymName = gymResult.data?.name || "Studio";

    const packages = rawPlans.map(p => ({
        id: p.id,
        name: p.name,
        classes: p.credits ?? 999,
        price: p.price,
        popular: p.is_popular,
        features: p.features.length > 0 ? p.features : [
            "Acceso a todas las clases",
            `Válido por ${p.validity_days} días`,
            p.credits === null ? "Clases ilimitadas" : `${p.credits} créditos incluidos`,
        ],
    }));

    const events = rawEvents.map(e => {
        const d = new Date(e.start_time);
        return {
            id: e.id,
            name: e.name,
            date: d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }),
            time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
            start_time: e.start_time,
            price: e.price,
            spaces: Math.max(0, e.max_capacity - e.current_enrolled),
            max_capacity: e.max_capacity,
            current_enrolled: e.current_enrolled,
            description: e.description,
            location: e.location,
        };
    });

    return { packages, events, brandColor, gymName };
}

// ─── Purchase Modal ─────────────────────────────────────────────
type PurchaseStep = "detail" | "payment" | "success";

function EventPurchaseModal({
    event,
    brandColor,
    gymName,
    onClose,
}: {
    event: any;
    brandColor: string;
    gymName: string;
    onClose: () => void;
}) {
    const navigate = useNavigate();
    const fetcher = useFetcher();
    const [step, setStep] = useState<PurchaseStep>("detail");
    const [cardNumber, setCardNumber] = useState("");
    const [cardName, setCardName] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvv, setCvv] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    function formatCard(v: string) {
        return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    }
    function formatExpiry(v: string) {
        const digits = v.replace(/\D/g, "").slice(0, 4);
        if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return digits;
    }

    function handlePay(e: React.FormEvent) {
        e.preventDefault();
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            const fd = new FormData();
            fd.set("intent", "register_event");
            fd.set("eventId", event.id);
            fetcher.submit(fd, { method: "post" });
            setStep("success");
        }, 1800);
    }

    const isFree = event.price === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pb-20 md:pb-0" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative w-full md:max-w-md bg-gray-950 md:rounded-2xl rounded-t-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ maxHeight: "min(90dvh, 90vh)" }}
            >
                {/* ── Step: Detail ── */}
                {step === "detail" && (
                    <>
                        <div className="p-5 border-b border-white/10" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.05))" }}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                        <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Evento exclusivo</span>
                                    </div>
                                    <h2 className="text-xl font-black text-white">{event.name}</h2>
                                </div>
                                <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white flex-shrink-0">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                            {event.description && (
                                <p className="text-sm text-white/70 leading-relaxed">{event.description}</p>
                            )}
                            <div className="space-y-2 text-sm text-white/60">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-violet-400" />
                                    <span className="capitalize">{event.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-violet-400" />
                                    <span>{event.time} hrs</span>
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-violet-400" />
                                        <span>{event.location}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-violet-400" />
                                    <span>{event.spaces} lugar{event.spaces !== 1 ? "es" : ""} disponible{event.spaces !== 1 ? "s" : ""}</span>
                                </div>
                            </div>

                            {/* Order summary */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
                                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Resumen</p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">{event.name}</span>
                                    <span className="font-bold text-white">
                                        {isFree ? "Gratis" : `$${event.price.toLocaleString("es-MX")} MXN`}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm border-t border-white/10 pt-2">
                                    <span className="font-bold text-white">Total</span>
                                    <span className="text-xl font-black text-white">
                                        {isFree ? "Gratis" : `$${event.price.toLocaleString("es-MX")} MXN`}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10">
                            <button
                                onClick={() => {
                                    if (isFree) {
                                        const fd = new FormData();
                                        fd.set("intent", "register_event");
                                        fd.set("eventId", event.id);
                                        fetcher.submit(fd, { method: "post" });
                                        setStep("success");
                                    } else {
                                        setStep("payment");
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                                style={{ backgroundColor: "#7c3aed" }}
                            >
                                {isFree ? (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Inscribirme gratis
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-4 h-4" />
                                        Continuar al pago
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* ── Step: Payment ── */}
                {step === "payment" && (
                    <>
                        <div className="p-5 border-b border-white/10 flex items-center gap-3">
                            <button onClick={() => setStep("detail")} className="p-1.5 text-white/40 hover:text-white">
                                <ChevronRight className="w-4 h-4 rotate-180" />
                            </button>
                            <div className="flex-1">
                                <h2 className="text-base font-black text-white">Datos de pago</h2>
                                <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                                    <Lock className="w-3 h-3" /> Pago simulado — entorno de pruebas
                                </p>
                            </div>
                            <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handlePay}>
                            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "55vh" }}>
                                {/* Summary pill */}
                                <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-xs text-violet-300/70 font-medium">{event.name}</p>
                                        <p className="text-lg font-black text-white">${event.price.toLocaleString("es-MX")} MXN</p>
                                    </div>
                                    <Sparkles className="w-6 h-6 text-violet-400 opacity-60" />
                                </div>

                                {/* Card number */}
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Número de tarjeta</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={cardNumber}
                                            onChange={e => setCardNumber(formatCard(e.target.value))}
                                            placeholder="1234 5678 9012 3456"
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-400 tracking-wider pr-12"
                                        />
                                        <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                    </div>
                                </div>

                                {/* Card name */}
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Nombre en la tarjeta</label>
                                    <input
                                        type="text"
                                        value={cardName}
                                        onChange={e => setCardName(e.target.value.toUpperCase())}
                                        placeholder="JUAN PÉREZ"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-400 uppercase tracking-widest"
                                    />
                                </div>

                                {/* Expiry + CVV */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Vencimiento</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={expiry}
                                            onChange={e => setExpiry(formatExpiry(e.target.value))}
                                            placeholder="MM/AA"
                                            required
                                            maxLength={5}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">CVV</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={cvv}
                                            onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                            placeholder="•••"
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-400"
                                        />
                                    </div>
                                </div>

                                <p className="text-[11px] text-white/30 text-center flex items-center justify-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Este es un flujo simulado. No se realizará ningún cargo real.
                                </p>
                            </div>
                            <div className="p-5 border-t border-white/10">
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                                    style={{ backgroundColor: "#7c3aed" }}
                                >
                                    {isProcessing ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            Pagar ${event.price.toLocaleString("es-MX")} MXN
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* ── Step: Success ── */}
                {step === "success" && (
                    <div className="p-8 text-center space-y-5">
                        <div className="relative mx-auto w-20 h-20">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(139,92,246,0.15)" }}>
                                <CheckCircle className="w-10 h-10 text-violet-400" />
                            </div>
                            <span className="absolute -top-1 -right-1 text-2xl">✨</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-1">¡Inscripción confirmada!</h2>
                            <p className="text-white/60 text-sm">Te esperamos en:</p>
                        </div>

                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-5 text-left space-y-3">
                            <p className="font-black text-white text-lg leading-tight">{event.name}</p>
                            <div className="space-y-1.5 text-sm text-white/60">
                                <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-400" /><span className="capitalize">{event.date}</span></p>
                                <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-violet-400" />{event.time} hrs</p>
                                {event.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-400" />{event.location}</p>}
                            </div>
                            {!isFree && (
                                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                    <span className="text-xs text-white/40">Total pagado</span>
                                    <span className="font-black text-white">${event.price.toLocaleString("es-MX")} MXN</span>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-white/40">
                            Revisa tu agenda — el evento ya aparece en tu calendario.
                        </p>

                        <button
                            onClick={() => {
                                onClose();
                                navigate("/dashboard");
                            }}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: "#7c3aed" }}
                        >
                            Ver próxima clase
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────
export default function Packages({ loaderData }: Route.ComponentProps) {
    const { packages, events, brandColor, gymName } = loaderData as any;
    const brand = brandColor || "#7c3aed";
    const t = useDashboardTheme();
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

    return (
        <div className="space-y-12">
            <div>
                <h1 className={`text-2xl font-bold ${t.title}`}>Paquetes y Eventos</h1>
                <p className={`${t.muted} mt-1`}>
                    Adquiere nuevas clases, mejora tu plan actual o inscríbete a eventos especiales.
                </p>
            </div>

            {/* ── Packages Section ── */}
            <section>
                <div className="mb-6">
                    <h2 className={`text-xl font-bold ${t.title}`}>Paquetes de Clases</h2>
                    <p className={`text-sm ${t.muted}`}>Nuestros planes regulares para tu entrenamiento.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {packages.map((pkg: any) => (
                        <div
                            key={pkg.id}
                            className={`${t.card} rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col`}
                            style={pkg.popular ? { borderColor: brand, boxShadow: `0 0 0 2px ${brand}30` } : {}}
                        >
                            {pkg.popular && (
                                <div
                                    className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider"
                                    style={{ backgroundColor: brand }}
                                >
                                    Más Popular
                                </div>
                            )}
                            <h3 className={`text-lg font-bold ${t.title}`}>{pkg.name}</h3>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className={`text-3xl font-black ${t.title}`}>${pkg.price.toLocaleString("es-MX")}</span>
                                <span className={`${t.muted} text-sm font-medium`}>MXN</span>
                            </div>
                            <div
                                className="font-bold px-3 py-1.5 rounded-lg inline-block w-fit mt-3 text-sm"
                                style={{ backgroundColor: `${brand}20`, color: brand }}
                            >
                                {pkg.classes >= 999 ? "Ilimitado" : `${pkg.classes} Clases`}
                            </div>

                            <ul className="mt-6 mb-8 space-y-3 flex-1">
                                {pkg.features.map((feature: string, i: number) => (
                                    <li key={i} className={`flex items-start gap-2 text-sm ${t.body}`}>
                                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: brand }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={`/dashboard/checkout/${pkg.id}`}
                                className="w-full text-center py-2.5 rounded-xl font-bold text-sm transition-all text-white hover:opacity-90"
                                style={{ backgroundColor: brand }}
                            >
                                Adquirir Paquete
                            </a>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Events Section ── */}
            {events.length > 0 && (
                <section>
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-5 h-5 text-violet-400" />
                            <h2 className={`text-xl font-bold ${t.title}`}>Eventos Exclusivos</h2>
                        </div>
                        <p className={`text-sm ${t.muted}`}>
                            Talleres, workshops y clases únicas con cupo limitado. Aparecen en tu agenda aunque no te inscribas.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((evt: any) => {
                            const isFull = evt.spaces === 0;
                            const pct = Math.min(100, Math.round((evt.current_enrolled / evt.max_capacity) * 100));
                            return (
                                <div
                                    key={evt.id}
                                    className="rounded-2xl overflow-hidden border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-all flex flex-col"
                                >
                                    {/* Header */}
                                    <div className="p-5 flex-1 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Evento exclusivo</span>
                                            </div>
                                            {isFull ? (
                                                <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full flex-shrink-0">LLENO</span>
                                            ) : (
                                                <span className="text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                                                    {evt.spaces} lugar{evt.spaces !== 1 ? "es" : ""}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className={`font-black text-white text-lg leading-tight`}>{evt.name}</h3>

                                        {evt.description && (
                                            <p className={`text-sm ${t.muted} leading-relaxed line-clamp-2`}>{evt.description}</p>
                                        )}

                                        <div className="space-y-1.5 text-xs text-white/50">
                                            <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-violet-400" /><span className="capitalize">{evt.date}</span></p>
                                            <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-violet-400" />{evt.time} hrs</p>
                                            {evt.location && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-violet-400" />{evt.location}</p>}
                                        </div>

                                        {/* Occupancy bar */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-white/40">
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {evt.current_enrolled}/{evt.max_capacity}</span>
                                                <span>{pct}% ocupado</span>
                                            </div>
                                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${isFull ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-violet-500"}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className={`px-5 pb-5 pt-3 border-t border-violet-500/10 flex items-center justify-between gap-3`}>
                                        <div>
                                            <p className="text-xl font-black text-white">
                                                {evt.price === 0 ? "Gratis" : `$${evt.price.toLocaleString("es-MX")}`}
                                            </p>
                                            {evt.price > 0 && <p className="text-[10px] text-white/40">MXN por persona</p>}
                                        </div>
                                        <button
                                            onClick={() => setSelectedEvent(evt)}
                                            disabled={isFull}
                                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white`}
                                            style={{ backgroundColor: isFull ? "#374151" : "#7c3aed" }}
                                        >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            {isFull ? "Lleno" : "Inscribirme"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Purchase Modal ── */}
            {selectedEvent && (
                <EventPurchaseModal
                    event={selectedEvent}
                    brandColor={brand}
                    gymName={gymName}
                    onClose={() => setSelectedEvent(null)}
                />
            )}
        </div>
    );
}
