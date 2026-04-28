// admin/planes.tsx — Plan & package management + exclusive events (Supabase)
import type { Route } from "./+types/planes";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import {
    CreditCard, Plus, Pencil, Trash2, Star,
    Sparkles, Users, MapPin, Calendar, Clock, X,
} from "lucide-react";

type PlanType = "creditos" | "membresia" | "ilimitado";
const TYPE_LABELS: Record<PlanType, string> = { creditos: "Créditos", membresia: "Membresía", ilimitado: "Ilimitado" };
const TYPE_COLORS: Record<PlanType, string> = { creditos: "bg-blue-100 text-blue-700", membresia: "bg-purple-100 text-purple-700", ilimitado: "bg-amber-100 text-amber-700" };

interface Plan {
    id: string;
    name: string;
    type: PlanType;
    price: number;
    credits: number | null;
    validityDays: number;
    popular: boolean;
    active: boolean;
}

interface GymEvent {
    id: string;
    name: string;
    date: string;
    time: string;
    max_capacity: number;
    current_enrolled: number;
    price: number;
    location: string;
    description: string;
    is_active: boolean;
    attendees: { full_name: string; email: string }[];
}

const QUICK_TEMPLATES = [
    { name: "1 clase", type: "creditos" as PlanType, price: 180, credits: 1, validityDays: 30 },
    { name: "5 clases", type: "creditos" as PlanType, price: 750, credits: 5, validityDays: 60 },
    { name: "10 clases", type: "creditos" as PlanType, price: 1200, credits: 10, validityDays: 90 },
    { name: "20 clases", type: "creditos" as PlanType, price: 1900, credits: 20, validityDays: 120 },
    { name: "Mensual ilimitado", type: "ilimitado" as PlanType, price: 1299, credits: null, validityDays: 30 },
];

// ─── Loader ───────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const { getGymPlans } = await import("~/services/plan.server");
    const { getGymEvents } = await import("~/services/event.server");

    const { supabaseAdmin } = await import("~/services/supabase.server");

    const [rawPlans, rawEvents, { data: registrations }] = await Promise.all([
        getGymPlans(gymId),
        getGymEvents(gymId),
        supabaseAdmin
            .from("event_registrations")
            .select("event_id, profile:profiles!user_id(full_name, email)")
            .eq("gym_id", gymId)
            .eq("status", "confirmed"),
    ]);

    // Agrupar inscritos por evento
    const regsByEvent: Record<string, { full_name: string; email: string }[]> = {};
    for (const r of registrations ?? []) {
        const p = r.profile as any;
        if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
        if (p) regsByEvent[r.event_id].push({ full_name: p.full_name ?? "", email: p.email ?? "" });
    }

    const plans: Plan[] = rawPlans.map(p => ({
        id: p.id,
        name: p.name,
        type: p.plan_type,
        price: p.price,
        credits: p.credits,
        validityDays: p.validity_days,
        popular: p.is_popular,
        active: p.is_active,
    }));

    const events: GymEvent[] = rawEvents.map(e => {
        const d = new Date(e.start_time);
        return {
            id: e.id,
            name: e.name,
            date: d.toISOString().split("T")[0],
            time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
            max_capacity: e.max_capacity,
            current_enrolled: e.current_enrolled,
            price: e.price,
            location: e.location,
            description: e.description,
            is_active: e.is_active,
            attendees: regsByEvent[e.id] ?? [],
        };
    });

    return { plans, events };
}

// ─── Action ───────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    // ── Plan intents ─────────────────────────────────────────────
    if (intent === "create_plan") {
        const { createPlan } = await import("~/services/plan.server");
        await createPlan({
            gymId,
            name: formData.get("name") as string,
            price: Number(formData.get("price")),
            credits: formData.get("credits") ? Number(formData.get("credits")) : null,
            validityDays: Number(formData.get("validityDays") ?? 30),
            planType: formData.get("type") as string,
            isPopular: formData.get("popular") === "true",
        });
        return { success: true, intent };
    }

    if (intent === "toggle_plan") {
        const { togglePlan } = await import("~/services/plan.server");
        const planId = formData.get("planId") as string;
        const isActive = formData.get("isActive") === "true";
        await togglePlan(planId, gymId, !isActive);
        return { success: true, intent };
    }

    if (intent === "delete_plan") {
        const { deletePlan } = await import("~/services/plan.server");
        const planId = formData.get("planId") as string;
        await deletePlan(planId, gymId);
        return { success: true, intent };
    }

    // ── Event intents ─────────────────────────────────────────────
    if (intent === "create_event") {
        const { createEvent } = await import("~/services/event.server");
        await createEvent({
            gymId,
            name: formData.get("name") as string,
            description: (formData.get("description") as string) || "",
            startIso: formData.get("start_iso") as string,
            max_capacity: Number(formData.get("capacity") ?? 15),
            price: Number(formData.get("price") ?? 0),
            location: (formData.get("location") as string) || "",
        });
        return { success: true, intent };
    }

    if (intent === "delete_event") {
        const { deleteEvent } = await import("~/services/event.server");
        const eventId = formData.get("eventId") as string;
        await deleteEvent(eventId, gymId);
        return { success: true, intent };
    }

    return { success: false };
}

// ─── Component ───────────────────────────────────────────────────
export default function Planes({ loaderData }: Route.ComponentProps) {
    const { plans, events } = loaderData;
    const fetcher = useFetcher();
    const [tab, setTab] = useState<"plans" | "events">("plans");
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [planForm, setPlanForm] = useState({
        name: "", type: "creditos" as PlanType, price: 0,
        credits: 10 as number | null, validityDays: 30, popular: false,
    });
    const [eventForm, setEventForm] = useState({
        name: "", date: "", time: "10:00", capacity: 15,
        price: 0, location: "", description: "",
    });

    // Close plan modal on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data?.intent === "create_plan") {
            setShowPlanModal(false);
            setPlanForm({ name: "", type: "creditos", price: 0, credits: 10, validityDays: 30, popular: false });
        }
    }, [fetcher.state, fetcher.data]);

    // Close event modal on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data?.intent === "create_event") {
            setShowEventModal(false);
            setEventForm({ name: "", date: "", time: "10:00", capacity: 15, price: 0, location: "", description: "" });
        }
    }, [fetcher.state, fetcher.data]);

    // ── Plan actions ─────────────────────────────────────────────
    function addFromTemplate(t: typeof QUICK_TEMPLATES[0]) {
        const fd = new FormData();
        fd.set("intent", "create_plan");
        fd.set("name", t.name);
        fd.set("price", String(t.price));
        if (t.credits !== null) fd.set("credits", String(t.credits));
        fd.set("validityDays", String(t.validityDays));
        fd.set("type", t.type);
        fd.set("popular", "false");
        fetcher.submit(fd, { method: "post" });
    }

    function savePlan() {
        const fd = new FormData();
        fd.set("intent", "create_plan");
        fd.set("name", planForm.name);
        fd.set("price", String(planForm.price));
        if (planForm.type === "creditos" && planForm.credits !== null) fd.set("credits", String(planForm.credits));
        fd.set("validityDays", String(planForm.validityDays));
        fd.set("type", planForm.type);
        fd.set("popular", String(planForm.popular));
        fetcher.submit(fd, { method: "post" });
    }

    function togglePlan(id: string, isActive: boolean) {
        const fd = new FormData();
        fd.set("intent", "toggle_plan");
        fd.set("planId", id);
        fd.set("isActive", String(isActive));
        fetcher.submit(fd, { method: "post" });
    }

    function removePlan(id: string) {
        const fd = new FormData();
        fd.set("intent", "delete_plan");
        fd.set("planId", id);
        fetcher.submit(fd, { method: "post" });
    }

    // ── Event actions ─────────────────────────────────────────────
    function saveEvent() {
        const [h, m] = eventForm.time.split(":").map(Number);
        const [y, mo, d] = eventForm.date.split("-").map(Number);
        const startIso = new Date(y, mo - 1, d, h, m, 0, 0).toISOString();

        const fd = new FormData();
        fd.set("intent", "create_event");
        fd.set("name", eventForm.name);
        fd.set("start_iso", startIso);
        fd.set("capacity", String(eventForm.capacity));
        fd.set("price", String(eventForm.price));
        fd.set("location", eventForm.location);
        fd.set("description", eventForm.description);
        fetcher.submit(fd, { method: "post" });
    }

    function removeEvent(id: string) {
        const fd = new FormData();
        fd.set("intent", "delete_event");
        fd.set("eventId", id);
        fetcher.submit(fd, { method: "post" });
    }

    // ── Derived ───────────────────────────────────────────────────
    const upcomingEvents = events.filter(e => new Date(`${e.date}T${e.time}`) >= new Date());
    const pastEvents = events.filter(e => new Date(`${e.date}T${e.time}`) < new Date());

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Negocio</h1>
                    <p className="text-white/50 text-sm mt-0.5">Gestiona tus planes de membresía y eventos exclusivos.</p>
                </div>
                {tab === "plans" ? (
                    <button
                        onClick={() => setShowPlanModal(true)}
                        className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Nuevo plan
                    </button>
                ) : (
                    <button
                        onClick={() => setShowEventModal(true)}
                        className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        <Sparkles className="w-4 h-4" /> Nuevo evento
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setTab("plans")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "plans" ? "bg-white/10 text-white shadow" : "text-white/40 hover:text-white/70"}`}
                >
                    <CreditCard className="w-4 h-4" />
                    Planes
                    <span className="text-xs opacity-60">({plans.length})</span>
                </button>
                <button
                    onClick={() => setTab("events")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "events" ? "bg-white/10 text-white shadow" : "text-white/40 hover:text-white/70"}`}
                >
                    <Sparkles className="w-4 h-4" />
                    Eventos exclusivos
                    <span className="text-xs opacity-60">({upcomingEvents.length})</span>
                </button>
            </div>

            {/* ── PLANES TAB ──────────────────────────────────────── */}
            {tab === "plans" && (
                <>
                    {/* Quick templates */}
                    <div>
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Plantillas rápidas</p>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_TEMPLATES.map(t => (
                                <button
                                    key={t.name}
                                    onClick={() => addFromTemplate(t)}
                                    disabled={fetcher.state !== "idle"}
                                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                                >
                                    <Plus className="w-3 h-3" /> {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {plans.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.03] rounded-2xl border border-white/[0.08]">
                            <CreditCard className="w-12 h-12 text-white/30 mx-auto mb-4" />
                            <h2 className="text-lg font-bold text-white mb-2">Sin planes activos</h2>
                            <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Crea tus primeros paquetes de clases o membresías.</p>
                            <button onClick={() => setShowPlanModal(true)} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Crear primer plan</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {plans.map(p => (
                                <div key={p.id} className={`bg-white/5 rounded-2xl border p-5 space-y-3 transition-opacity ${p.active ? "border-white/[0.08] opacity-100" : "border-white/5 opacity-50"}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            {p.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[p.type]}`}>{TYPE_LABELS[p.type]}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => togglePlan(p.id, p.active)} className="p-1.5 hover:bg-white/10 rounded-lg" title={p.active ? "Pausar" : "Activar"}>
                                                <Pencil className="w-3.5 h-3.5 text-white/40" />
                                            </button>
                                            <button onClick={() => removePlan(p.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-black text-white">{p.name}</p>
                                        <p className="text-3xl font-black text-white mt-1">
                                            ${p.price.toLocaleString("es-MX")}
                                            <span className="text-sm text-white/40 font-normal"> MXN</span>
                                        </p>
                                    </div>
                                    <div className="text-sm text-white/50 space-y-1 border-t border-white/5 pt-3">
                                        <p>{p.credits === null ? "Clases ilimitadas" : `${p.credits} crédito${(p.credits ?? 0) > 1 ? "s" : ""}`}</p>
                                        <p>Vigencia: {p.validityDays} días</p>
                                    </div>
                                    <button
                                        onClick={() => togglePlan(p.id, p.active)}
                                        className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${p.active ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}`}
                                    >
                                        {p.active ? "Pausar plan" : "Activar plan"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── EVENTOS TAB ─────────────────────────────────────── */}
            {tab === "events" && (
                <div className="space-y-6">
                    {/* Upcoming */}
                    {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.03] rounded-2xl border border-white/[0.08]">
                            <Sparkles className="w-12 h-12 text-violet-400/40 mx-auto mb-4" />
                            <h2 className="text-lg font-bold text-white mb-2">Sin eventos creados</h2>
                            <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
                                Crea talleres, workshops o clases únicas con cupo limitado, fuera del horario regular.
                            </p>
                            <button
                                onClick={() => setShowEventModal(true)}
                                className="bg-violet-500 hover:bg-violet-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
                            >
                                + Crear primer evento
                            </button>
                        </div>
                    ) : (
                        <>
                            {upcomingEvents.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Próximos eventos</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {upcomingEvents.map(e => <EventCard key={e.id} event={e} onDelete={removeEvent} />)}
                                    </div>
                                </div>
                            )}
                            {pastEvents.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Eventos pasados</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
                                        {pastEvents.map(e => <EventCard key={e.id} event={e} onDelete={removeEvent} past />)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── MODAL: Nuevo Plan ────────────────────────────────── */}
            {showPlanModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-lg font-black text-white">Nuevo plan</h2>
                            <button onClick={() => setShowPlanModal(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre</label>
                                <input
                                    value={planForm.name}
                                    onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ej: Paquete 10 clases"
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Tipo</label>
                                <select
                                    value={planForm.type}
                                    onChange={e => {
                                        const t = e.target.value as PlanType;
                                        setPlanForm(f => ({ ...f, type: t, credits: t === "creditos" ? (f.credits ?? 10) : null }));
                                    }}
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                                >
                                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v}</option>)}
                                </select>
                            </div>
                            <div className={`grid gap-3 ${planForm.type === "creditos" ? "grid-cols-3" : "grid-cols-2"}`}>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Precio</label>
                                    <input type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: +e.target.value }))} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
                                </div>
                                {planForm.type === "creditos" && (
                                    <div>
                                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Créditos</label>
                                        <input type="number" value={planForm.credits ?? 0} onChange={e => setPlanForm(f => ({ ...f, credits: +e.target.value }))} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Días de vigencia</label>
                                    <input type="number" value={planForm.validityDays} onChange={e => setPlanForm(f => ({ ...f, validityDays: +e.target.value }))} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={planForm.popular} onChange={e => setPlanForm(f => ({ ...f, popular: e.target.checked }))} className="accent-amber-400" />
                                <span className="text-sm text-white/70">Marcar como popular</span>
                            </label>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowPlanModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button
                                onClick={savePlan}
                                disabled={!planForm.name || fetcher.state !== "idle"}
                                className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-black font-bold px-4 py-2.5 rounded-xl text-sm"
                            >
                                {fetcher.state !== "idle" ? "Guardando..." : "Crear plan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: Nuevo Evento ──────────────────────────────── */}
            {showEventModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white">Nuevo evento exclusivo</h2>
                                <p className="text-xs text-white/40 mt-0.5">Taller, workshop o clase única con cupo limitado</p>
                            </div>
                            <button onClick={() => setShowEventModal(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre del evento</label>
                                <input
                                    value={eventForm.name}
                                    onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ej: Taller de Hyrox con AOP"
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label>
                                <textarea
                                    value={eventForm.description}
                                    onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="¿Qué incluye este evento? ¿Para quién es?"
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Ubicación</label>
                                <input
                                    value={eventForm.location}
                                    onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                                    placeholder="Ej: Sala A / Estudio principal"
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={eventForm.date}
                                        min={new Date().toISOString().split("T")[0]}
                                        onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Hora</label>
                                    <input
                                        type="time"
                                        value={eventForm.time}
                                        onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Cupo máximo</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={eventForm.capacity}
                                        onChange={e => setEventForm(f => ({ ...f, capacity: +e.target.value }))}
                                        className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Precio (MXN)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={eventForm.price}
                                        onChange={e => setEventForm(f => ({ ...f, price: +e.target.value }))}
                                        className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowEventModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button
                                onClick={saveEvent}
                                disabled={!eventForm.name || !eventForm.date || fetcher.state !== "idle"}
                                className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm"
                            >
                                {fetcher.state !== "idle" ? "Guardando..." : "Crear evento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Event Card ───────────────────────────────────────────────────
function EventCard({ event: e, onDelete, past = false }: { event: GymEvent; onDelete: (id: string) => void; past?: boolean }) {
    const [showAttendees, setShowAttendees] = useState(false);
    const pct = Math.min(100, Math.round((e.current_enrolled / e.max_capacity) * 100));
    const isFull = e.current_enrolled >= e.max_capacity;
    const spots = e.max_capacity - e.current_enrolled;

    const dateLabel = new Date(`${e.date}T${e.time}`).toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long",
    });

    return (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 relative overflow-hidden">
            {/* Badge */}
            <div className="absolute top-4 right-4 flex gap-1.5">
                {isFull && !past && (
                    <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">LLENO</span>
                )}
                {!isFull && !past && (
                    <span className="text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">
                        {spots} lugar{spots !== 1 ? "es" : ""} libre{spots !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            <div className="pr-28">
                <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Evento exclusivo</span>
                </div>
                <p className="font-black text-white text-base leading-tight">{e.name}</p>
                {e.description && (
                    <p className="text-sm text-white/50 mt-1 leading-relaxed line-clamp-2">{e.description}</p>
                )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    <span className="capitalize">{dateLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    <span>{e.time} hrs</span>
                </div>
                {e.location && (
                    <div className="flex items-center gap-1.5 col-span-2">
                        <MapPin className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                        <span>{e.location}</span>
                    </div>
                )}
            </div>

            {/* Precio + capacidad */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div>
                    <p className="text-xl font-black text-white">
                        {e.price === 0 ? "Gratis" : `$${e.price.toLocaleString("es-MX")}`}
                        {e.price > 0 && <span className="text-xs text-white/40 font-normal ml-1">MXN</span>}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <Users className="w-3.5 h-3.5" />
                    <span>{e.current_enrolled}/{e.max_capacity} inscritos</span>
                </div>
            </div>

            {/* Barra de ocupación */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-violet-500"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Lista de asistentes */}
            {e.attendees.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowAttendees(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                    >
                        <Users className="w-3.5 h-3.5" />
                        {showAttendees ? "Ocultar" : "Ver"} inscritos ({e.attendees.length})
                    </button>
                    {showAttendees && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {e.attendees.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                                        {a.full_name?.[0]?.toUpperCase() ?? "?"}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-white truncate">{a.full_name || "Sin nombre"}</p>
                                        <p className="text-[10px] text-white/40 truncate">{a.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {e.attendees.length === 0 && !past && (
                <p className="text-xs text-white/30 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Sin inscritos aún
                </p>
            )}

            {/* Eliminar */}
            {!past && (
                <button
                    onClick={() => onDelete(e.id)}
                    className="w-full flex items-center justify-center gap-1.5 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 rounded-xl py-2 text-xs font-medium transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar evento
                </button>
            )}
        </div>
    );
}
