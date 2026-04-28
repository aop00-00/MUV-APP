// app/routes/admin/subscriptions.tsx
// Admin – Membership management: view, freeze, reactivate, renewal queue.

import type { Route } from "./+types/subscriptions";
import { useFetcher } from "react-router";
import { useState } from "react";
import {
    Search, Snowflake, RefreshCw, XCircle, AlertTriangle,
    CheckCircle, Clock, TrendingUp, Users, DollarSign, Filter
} from "lucide-react";
// Server services moved to dynamic imports inside loader/action
import type { Subscription, SubscriptionStatus } from "~/types/database";

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { getRenewalQueue } = await import("~/services/subscription.server");
    const { getGymPlans } = await import("~/services/plan.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");

    const { profile, gymId } = await requireGymAdmin(request);

    const [profilesData, renewalQueue, gymPlans] = await Promise.all([
        supabaseAdmin
            .from("profiles")
            .select("*, memberships(*)")
            .eq("gym_id", gymId),
        getRenewalQueue(7, gymId),
        getGymPlans(gymId),
    ]);

    const allProfiles = profilesData.data || [];

    // Sort profiles to put those with active memberships first
    const sortedProfiles = [...allProfiles].sort((a, b) => {
        const aHasActive = (a.memberships as any[]).some(m => m.status === "active");
        const bHasActive = (b.memberships as any[]).some(m => m.status === "active");
        if (aHasActive && !bHasActive) return -1;
        if (!aHasActive && bHasActive) return 1;
        return 0;
    });

    const stats = {
        active: sortedProfiles.filter((p) => (p.memberships as any[]).some(m => m.status === "active")).length,
        frozen: sortedProfiles.filter((p) => (p.memberships as any[]).some(m => m.status === "frozen")).length,
        expired: allProfiles.length - sortedProfiles.filter((p) => (p.memberships as any[]).some(m => m.status === "active" || m.status === "frozen")).length,
        mrr: allProfiles
            .reduce((sum, p) => {
                const sub = (p.memberships as any[]).find(m => m.status === "active" || m.status === "frozen");
                return sum + (sub?.price ?? 0);
            }, 0),
    };

    return { profiles: sortedProfiles, renewalQueue, plans: gymPlans.filter(p => p.is_active), stats, gymId };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const {
        createMembership,
        freezeMembership, reactivateMembership, cancelMembership,
    } = await import("~/services/subscription.server");

    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const subId = formData.get("subscriptionId") as string;

    try {
        switch (intent) {
            case "freeze":
                await freezeMembership(subId, gymId);
                return { success: true, message: `Membresía congelada.` };
            case "reactivate":
                await reactivateMembership(subId, gymId);
                return { success: true, message: `Membresía reactivada.` };
            case "cancel":
                await cancelMembership(subId, gymId);
                return { success: true, message: `Membresía cancelada.` };
            case "renew": {
                const { supabaseAdmin } = await import("~/services/supabase.server");
                const newEnd = new Date();
                newEnd.setMonth(newEnd.getMonth() + 1);

                // Fetch membership to get price and user info for the order
                const { data: memData } = await supabaseAdmin
                    .from("memberships")
                    .select("price, plan_name, user_id, profiles(full_name)")
                    .eq("id", subId)
                    .eq("gym_id", gymId)
                    .single();

                await supabaseAdmin
                    .from("memberships")
                    .update({ status: "active", end_date: newEnd.toISOString().split("T")[0] })
                    .eq("id", subId)
                    .eq("gym_id", gymId);

                // Register renewal income
                if (memData && Number(memData.price) > 0) {
                    const { createOrder } = await import("~/services/order.server");
                    const renewalPrice = Number(memData.price);
                    await createOrder({
                        gymId,
                        userId: memData.user_id,
                        customerName: (memData.profiles as any)?.full_name ?? null,
                        paymentMethod: "cash",
                        type: "renewal",
                        items: [{ productId: subId, name: `Renovación: ${memData.plan_name}`, quantity: 1, unitPrice: renewalPrice }],
                        subtotal: renewalPrice,
                        tax: 0,
                        total: renewalPrice,
                    }).catch(err => console.error("[renew] order insert failed:", err.message));
                }

                return { success: true, message: `Membresía renovada.` };
            }
            case "link_plan": {
                const userId = formData.get("userId") as string;
                const planId = formData.get("planId") as string;
                const paymentMethod = (formData.get("paymentMethod") as string) || "cash";
                const customerName = (formData.get("customerName") as string) || null;
                const { getGymPlans } = await import("~/services/plan.server");
                const gymPlans = await getGymPlans(gymId);
                const plan = gymPlans.find(p => p.id === planId);
                if (!plan) return { success: false, error: "Plan inválido" };

                await createMembership({
                    userId,
                    gymId,
                    planName: plan.name,
                    price: plan.price,
                    credits: plan.credits ?? 999,
                    validityDays: plan.validity_days,
                    paymentMethod: paymentMethod as any,
                    customerName,
                });
                return { success: true, message: "Plan vinculado con éxito." };
            }
            default:
                return { success: false, error: "Intent no reconocido" };
        }
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─── Helpers ─────────────────────────────────────────────────────
// Helpers
type EnrichedSub = any; // Placeholder until we can safely type it with dynamic imports if needed

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
    active: { label: "Activa", dot: "bg-green-400", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
    frozen: { label: "Congelada", dot: "bg-cyan-400", text: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" },
    expired: { label: "Vencida", dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    cancelled: { label: "Cancelada", dot: "bg-gray-400", text: "text-white/60", bg: "bg-white/5", border: "border-white/[0.08]" },
};

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("es-MX")}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Row Actions ─────────────────────────────────────────────────
function SubscriptionRow({ profile, plans, gymId }: { profile: any, plans: any[], gymId: string }) {
    const fetcher = useFetcher();
    const sub = (profile.memberships as any[]).find(m => m.status === "active" || m.status === "frozen") 
                || (profile.memberships as any[]).sort((a,b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
    
    const [showLink, setShowLink] = useState(false);

    if (!sub) {
        return (
            <tr className="border-b border-gray-50/5 hover:bg-white/5 transition-colors">
                <td className="py-4 px-4">
                    <div>
                        <p className="font-semibold text-white text-sm">{profile.full_name}</p>
                        <p className="text-xs text-white/40">{profile.email}</p>
                    </div>
                </td>
                <td className="py-4 px-4" colSpan={4}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/30 italic">Sin membresía activa</span>
                        {showLink ? (
                            <fetcher.Form method="post" className="flex items-center gap-2 flex-wrap">
                                <input type="hidden" name="intent" value="link_plan" />
                                <input type="hidden" name="userId" value={profile.id} />
                                <input type="hidden" name="gymId" value={gymId} />
                                <input type="hidden" name="customerName" value={profile.full_name ?? ""} />
                                <select
                                    name="planId"
                                    className="text-[11px] bg-zinc-900 border border-white/10 rounded px-2 py-1 text-white"
                                    required
                                >
                                    <option value="">Seleccionar plan...</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                                    ))}
                                </select>
                                <select
                                    name="paymentMethod"
                                    className="text-[11px] bg-zinc-900 border border-white/10 rounded px-2 py-1 text-white"
                                >
                                    <option value="cash">Efectivo</option>
                                    <option value="card">Tarjeta</option>
                                    <option value="mercado_pago">Mercado Pago</option>
                                    <option value="transfer">Transferencia</option>
                                </select>
                                <button type="submit" className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded">Vincular</button>
                                <button type="button" onClick={() => setShowLink(false)} className="text-[10px] text-white/40">×</button>
                            </fetcher.Form>
                        ) : (
                            <button 
                                onClick={() => setShowLink(true)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
                            >
                                Vincular Plan
                            </button>
                        )}
                    </div>
                </td>
                <td className="py-4 px-4" />
            </tr>
        );
    }

    const statusCfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.expired;
    const daysUntilExpiry = sub ? Math.ceil(
        (new Date(sub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ) : 0;

    return (
        <tr className="border-b border-gray-50 hover:bg-white/5/50 transition-colors">
            <td className="py-4 px-4">
                <div>
                    <p className="font-semibold text-white text-sm">{profile.full_name || "—"}</p>
                    <p className="text-xs text-white/40">{profile.email || "—"}</p>
                </div>
            </td>
            <td className="py-4 px-4">
                <div>
                    <p className="font-medium text-white text-sm">{sub.plan_name}</p>
                    <p className="text-xs text-white/40">{sub.credits_included ?? 0} créditos/ciclo</p>
                </div>
            </td>
            <td className="py-4 px-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                    {sub.status === "frozen" && sub.freeze_until && (
                        <span className="ml-1 opacity-70">hasta {formatDate(sub.freeze_until)}</span>
                    )}
                </span>
            </td>
            <td className="py-4 px-4 text-sm text-white/70 font-medium">
                {formatCurrency(sub.price ?? 0)}
                <span className="text-xs text-white/40 ml-1">/mes</span>
            </td>
            <td className="py-4 px-4">
                <div className="text-xs">
                    <p className="text-white/50">{formatDate(sub.end_date)}</p>
                    {daysUntilExpiry <= 7 && daysUntilExpiry >= 0 && (
                        <p className="text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            {daysUntilExpiry}d restantes
                        </p>
                    )}
                    {daysUntilExpiry < 0 && (
                        <p className="text-red-500 font-medium mt-0.5">Vencida</p>
                    )}
                </div>
            </td>
            <td className="py-4 px-4">
                <div className="flex items-center gap-1.5">
                    {sub.status === "active" && (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="freeze" />
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <button
                                type="submit"
                                className="flex items-center gap-1 text-xs bg-cyan-100 hover:bg-cyan-200 text-cyan-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                title="Congelar 15 días"
                            >
                                <Snowflake className="w-3 h-3" />
                                Congelar
                            </button>
                        </fetcher.Form>
                    )}
                    {sub.status === "frozen" && (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="reactivate" />
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <button
                                type="submit"
                                className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Reactivar
                            </button>
                        </fetcher.Form>
                    )}
                    {(sub.status === "expired" || sub.status === "cancelled") && (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="renew" />
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <button
                                type="submit"
                                className="flex items-center gap-1 text-xs bg-violet-100 hover:bg-violet-200 text-violet-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Renovar
                            </button>
                        </fetcher.Form>
                    )}
                    {sub.status === "active" && (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="cancel" />
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <button
                                type="submit"
                                className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                title="Cancelar membresía"
                            >
                                <XCircle className="w-3 h-3" />
                            </button>
                        </fetcher.Form>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── Plan Card ────────────────────────────────────────────────────
function PlanCard({ plan }: { plan: any }) {
    return (
        <div className={`rounded-xl border ${plan.is_popular ? "border-violet-300 bg-violet-50/10" : "border-white/[0.08] bg-white/5"} p-5 relative`}>
            {plan.is_popular && (
                <span className="absolute -top-2.5 left-4 text-[11px] bg-violet-600 text-white px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Popular
                </span>
            )}
            <h3 className={`text-lg font-black ${plan.is_popular ? "text-violet-400" : "text-white"}`}>
                {plan.name}
            </h3>
            <p className="text-2xl font-black text-white mt-1">
                ${plan.price.toLocaleString("es-MX")}
                <span className="text-sm font-normal text-white/40"> MXN</span>
            </p>
            <div className="text-sm text-white/50 mt-2 space-y-1">
                <p>{plan.credits === null ? "Clases ilimitadas" : `${plan.credits} crédito${plan.credits !== 1 ? "s" : ""}`}</p>
                <p>Vigencia: {plan.validity_days} días</p>
            </div>
            {(plan.features ?? []).length > 0 && (
                <ul className="mt-3 space-y-1.5">
                    {(plan.features ?? []).map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-white/60">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            {f}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ─── Renewal Queue Item ───────────────────────────────────────────
// Must be a component (not inline) so useFetcher is called at top level.
function RenewalQueueItem({ sub }: { sub: Subscription }) {
    const fetcher = useFetcher();
    return (
        <div key={sub.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-amber-100">
            <div>
                <p className="text-sm font-semibold text-white">{sub.plan_name}</p>
                <p className="text-xs text-white/50">Vence: {formatDate(sub.end_date)}</p>
            </div>
            <fetcher.Form method="post">
                <input type="hidden" name="intent" value="renew" />
                <input type="hidden" name="subscriptionId" value={sub.id} />
                <button type="submit" className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Renovar
                </button>
            </fetcher.Form>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AdminSubscriptions({ loaderData }: Route.ComponentProps) {
    const { profiles, renewalQueue, plans, stats, gymId } = loaderData;
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<"members" | "plans">("members");

    const filtered = profiles.filter((p: any) => {
        const name = (p.full_name ?? "").toLowerCase();
        const email = (p.email ?? "").toLowerCase();
        const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
        
        const sub = (p.memberships as any[]).find(m => m.status === "active" || m.status === "frozen") || (p.memberships as any[])[0];
        const status = sub?.status || "none";
        
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Membresías</h1>
                <p className="text-white/50 mt-1">Gestiona planes, congelaciones y renovaciones.</p>
            </div>

            {/* ── KPI Cards ──────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 p-5 rounded-xl border border-white/[0.08] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-4 h-4 text-green-600" /></div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Activas</span>
                    </div>
                    <p className="text-3xl font-black text-green-600">{stats.active}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-xl border border-white/[0.08] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-cyan-50 rounded-lg"><Snowflake className="w-4 h-4 text-cyan-600" /></div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Congeladas</span>
                    </div>
                    <p className="text-3xl font-black text-cyan-600">{stats.frozen}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-xl border border-white/[0.08] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Vencidas</span>
                    </div>
                    <p className="text-3xl font-black text-red-500">{stats.expired}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-xl border border-white/[0.08] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-violet-50 rounded-lg"><DollarSign className="w-4 h-4 text-violet-600" /></div>
                        <span className="text-xs text-white/40 uppercase tracking-wider">MRR</span>
                    </div>
                    <p className="text-3xl font-black text-violet-600">${stats.mrr.toLocaleString()}</p>
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────── */}
            <div className="flex bg-white/5/10 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab("members")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "members" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                >
                    <Users className="w-4 h-4" />
                    Miembros
                </button>
                <button
                    onClick={() => setActiveTab("plans")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "plans" ? "bg-white/5 text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
                >
                    <TrendingUp className="w-4 h-4" />
                    Planes
                </button>
            </div>

            {/* ── Renewal Queue ────────────────────── */}
            {renewalQueue.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <h2 className="text-sm font-bold text-amber-800">
                            Cola de renovación – {renewalQueue.length} membresía{renewalQueue.length > 1 ? "s" : ""} vencen esta semana
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {renewalQueue.map((sub) => (
                            <RenewalQueueItem key={sub.id} sub={sub} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Members Table ────────────────────── */}
            {activeTab === "members" && (
                <div className="bg-white/5 border border-white/[0.08] rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o email…"
                                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/[0.08] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-white/40" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | "all")}
                                className="text-sm bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                            >
                                <option value="all">Todos los estados</option>
                                <option value="active">Activas</option>
                                <option value="frozen">Congeladas</option>
                                <option value="expired">Vencidas</option>
                                <option value="cancelled">Canceladas</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>
                                    {["Miembro", "Plan", "Estado", "Precio", "Vencimiento", "Acciones"].map((h) => (
                                        <th key={h} className="py-3 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-white/40">
                                            No se encontraron membresías.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((p: any) => <SubscriptionRow key={p.id} profile={p} plans={plans} gymId={gymId} />)
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Plans Grid ───────────────────────── */}
            {activeTab === "plans" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
                </div>
            )}
        </div>
    );
}
