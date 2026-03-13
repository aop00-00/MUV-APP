// app/routes/barista/_index.tsx
// Barista – Kanban order queue with SLA semaphore, batching, hold queue,
// user photos/preferences, and customer-facing pickup display (MOCK DATA).
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/_index";
import { useFetcher } from "react-router";
import { useState } from "react";
import {
    Clock, CheckCircle, AlertTriangle, Volume2,
    Layers, Timer, Bell, ChefHat, Eye, EyeOff
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface OrderItem {
    name: string;
    qty: number;
}

interface BaristaOrder {
    id: string;
    customer: string;
    avatar: string;
    items: OrderItem[];
    status: "hold" | "pending" | "preparing" | "completed";
    createdAt: string;
    holdUntil: string | null; // ISO — when class ends
    total: number;
    preferences: string[];
    allergies: string[];
}

// ─── Mock Data ───────────────────────────────────────────────────
const NOW = Date.now();

const MOCK_ORDERS: BaristaOrder[] = [
    {
        id: "ord-001", customer: "María García", avatar: "👩",
        items: [{ name: "Proteína Whey", qty: 1 }, { name: "Americano", qty: 1 }],
        status: "pending", createdAt: new Date(NOW - 2 * 60000).toISOString(),
        holdUntil: null, total: 100,
        preferences: ["Mucho hielo", "Sin azúcar"], allergies: [],
    },
    {
        id: "ord-002", customer: "Pedro López", avatar: "👨",
        items: [{ name: "Smoothie Verde", qty: 1 }],
        status: "pending", createdAt: new Date(NOW - 5 * 60000).toISOString(),
        holdUntil: null, total: 55,
        preferences: [], allergies: ["Nueces"],
    },
    {
        id: "ord-003", customer: "Roberto Sánchez", avatar: "🧔",
        items: [{ name: "Proteína Whey", qty: 1 }],
        status: "pending", createdAt: new Date(NOW - 6 * 60000).toISOString(),
        holdUntil: null, total: 65,
        preferences: ["Con plátano extra"], allergies: [],
    },
    {
        id: "ord-004", customer: "Carlos Ramírez", avatar: "👨‍🦱",
        items: [{ name: "Proteína Whey", qty: 1 }, { name: "Barra Proteica", qty: 2 }],
        status: "preparing", createdAt: new Date(NOW - 8 * 60000).toISOString(),
        holdUntil: null, total: 155,
        preferences: [], allergies: [],
    },
    {
        id: "ord-005", customer: "Ana Martínez", avatar: "👩‍🦱",
        items: [{ name: "Smoothie Verde", qty: 1 }, { name: "Agua Mineral", qty: 1 }],
        status: "hold",
        createdAt: new Date(NOW - 30 * 60000).toISOString(),
        holdUntil: new Date(NOW + 10 * 60000).toISOString(), // class ends in 10 min
        total: 75,
        preferences: ["Bien frío"], allergies: ["Lactosa"],
    },
    {
        id: "ord-006", customer: "Fernanda Ríos", avatar: "👱‍♀️",
        items: [{ name: "Americano", qty: 1 }],
        status: "hold",
        createdAt: new Date(NOW - 45 * 60000).toISOString(),
        holdUntil: new Date(NOW + 25 * 60000).toISOString(),
        total: 35,
        preferences: ["Doble shot"], allergies: [],
    },
    {
        id: "ord-007", customer: "Laura Torres", avatar: "👩‍🔬",
        items: [{ name: "Smoothie Verde", qty: 1 }],
        status: "completed", createdAt: new Date(NOW - 15 * 60000).toISOString(),
        holdUntil: null, total: 55,
        preferences: [], allergies: [],
    },
    {
        id: "ord-008", customer: "Juan Herrera", avatar: "🧑",
        items: [{ name: "Americano", qty: 2 }],
        status: "completed", createdAt: new Date(NOW - 20 * 60000).toISOString(),
        holdUntil: null, total: 70,
        preferences: [], allergies: [],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────
function getMinutesAgo(iso: string) {
    return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

function getMinutesUntil(iso: string) {
    return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
}

function getSLAColor(minutesAgo: number): { border: string; bg: string; label: string; urgent: boolean } {
    if (minutesAgo < 3) return { border: "border-green-400", bg: "bg-green-50", label: "OK", urgent: false };
    if (minutesAgo <= 7) return { border: "border-yellow-400", bg: "bg-yellow-50", label: "Atención", urgent: false };
    return { border: "border-red-500", bg: "bg-red-50", label: "URGENTE", urgent: true };
}

// ─── Batch Detection ─────────────────────────────────────────────
function detectBatches(orders: BaristaOrder[]): { item: string; count: number; orderIds: string[] }[] {
    const active = orders.filter((o) => o.status === "pending" || o.status === "preparing");
    const counts: Record<string, { count: number; orderIds: string[] }> = {};
    for (const o of active) {
        for (const item of o.items) {
            if (!counts[item.name]) counts[item.name] = { count: 0, orderIds: [] };
            counts[item.name].count += item.qty;
            if (!counts[item.name].orderIds.includes(o.id)) {
                counts[item.name].orderIds.push(o.id);
            }
        }
    }
    return Object.entries(counts)
        .filter(([, v]) => v.count >= 2)
        .map(([item, v]) => ({ item, count: v.count, orderIds: v.orderIds }));
}

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymCoach } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymCoach(request);
    const pending = MOCK_ORDERS.filter((o) => o.status === "pending");
    const preparing = MOCK_ORDERS.filter((o) => o.status === "preparing");
    const hold = MOCK_ORDERS.filter((o) => o.status === "hold");
    const completed = MOCK_ORDERS.filter((o) => o.status === "completed");
    const todayRevenue = completed.reduce((s, o) => s + o.total, 0);

    return {
        orders: MOCK_ORDERS,
        pendingCount: pending.length,
        preparingCount: preparing.length,
        holdCount: hold.length,
        completedCount: completed.length,
        todayRevenue,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymCoach } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymCoach(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const orderId = formData.get("orderId") as string;
    if (intent === "complete") {
        // Would send push: "¡María, tu Protein Whey te espera en la barra!"
        return { success: true, intent, orderId, notification: true };
    }
    return { success: true, intent, orderId };
}

// ─── Order Card Component ────────────────────────────────────────
function OrderCard({ order, fetcher }: { order: BaristaOrder; fetcher: ReturnType<typeof useFetcher> }) {
    const minutesAgo = getMinutesAgo(order.createdAt);
    const sla = order.status === "hold" ? { border: "border-slate-300", bg: "bg-slate-50", label: "Hold", urgent: false } : getSLAColor(minutesAgo);

    return (
        <div className={`rounded-2xl border-2 ${sla.border} ${sla.bg} p-4 transition-all hover:shadow-lg relative`}>
            {/* SLA Badge */}
            {sla.urgent && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> URGENTE
                </div>
            )}

            {/* Header: Avatar + Customer */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center text-xl shadow-sm">
                    {order.avatar}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900 text-sm truncate">{order.customer}</p>
                    <p className="text-[10px] text-stone-400 font-mono">#{order.id.slice(4)}</p>
                </div>
                {order.status !== "hold" && (
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                        <Timer className="w-3 h-3" />
                        {minutesAgo}m
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/60 rounded-lg px-2.5 py-1.5">
                        <span className="text-sm font-medium text-stone-800">{item.name}</span>
                        {item.qty > 1 && (
                            <span className="text-xs bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-full font-bold">x{item.qty}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Preferences & Allergies */}
            {(order.preferences.length > 0 || order.allergies.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {order.allergies.map((a, i) => (
                        <span key={`a-${i}`} className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">
                            ⚠️ {a}
                        </span>
                    ))}
                    {order.preferences.map((p, i) => (
                        <span key={`p-${i}`} className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                            {p}
                        </span>
                    ))}
                </div>
            )}

            {/* Hold info */}
            {order.status === "hold" && order.holdUntil && (
                <div className="bg-slate-200/50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Clase termina en {getMinutesUntil(order.holdUntil)} min
                    </p>
                    {getMinutesUntil(order.holdUntil) <= 10 && (
                        <p className="text-xs text-amber-600 font-bold mt-1">⚡ ¡Preparar para salida de clase!</p>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-1.5">
                {order.status === "hold" && (
                    <fetcher.Form method="post" className="flex-1">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="intent" value="activate" />
                        <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-xs font-bold transition-colors">
                            Activar ahora
                        </button>
                    </fetcher.Form>
                )}
                {order.status === "pending" && (
                    <fetcher.Form method="post" className="flex-1">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="intent" value="prepare" />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1">
                            <ChefHat className="w-3.5 h-3.5" />
                            Preparar
                        </button>
                    </fetcher.Form>
                )}
                {order.status === "preparing" && (
                    <fetcher.Form method="post" className="flex-1">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="intent" value="complete" />
                        <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            ¡Listo!
                        </button>
                    </fetcher.Form>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function BaristaOrders({ loaderData }: Route.ComponentProps) {
    const { orders, pendingCount, preparingCount, holdCount, completedCount, todayRevenue } = loaderData;
    const fetcher = useFetcher();
    const [activeTab, setActiveTab] = useState<"active" | "hold" | "completed" | "pickup">("active");

    const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing");
    const holdOrders = orders.filter((o) => o.status === "hold");
    const completedOrders = orders.filter((o) => o.status === "completed");
    const batches = detectBatches(orders);

    // Hold orders about to activate (class ends in ≤10 min)
    const urgentHolds = holdOrders.filter((o) => o.holdUntil && getMinutesUntil(o.holdUntil) <= 10);

    const tabs = [
        { key: "active", label: "Ahora", count: pendingCount + preparingCount, color: "text-blue-600" },
        { key: "hold", label: "En Espera", count: holdCount, color: "text-slate-600", alert: urgentHolds.length > 0 },
        { key: "completed", label: "Listos", count: completedCount, color: "text-green-600" },
        { key: "pickup", label: "📺 Display", count: completedOrders.length, color: "text-purple-600" },
    ] as const;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-stone-900">☕ Línea de Producción</h1>
                    <p className="text-stone-500 text-sm mt-0.5">
                        {pendingCount + preparingCount} activas • ${todayRevenue} hoy
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-amber-700">{pendingCount}</p>
                    <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Pendientes</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-700">{preparingCount}</p>
                    <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Preparando</p>
                </div>
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-slate-700">{holdCount}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">En espera</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-green-700">{completedCount}</p>
                    <p className="text-[10px] text-green-600 font-medium uppercase tracking-wider">Listos</p>
                </div>
            </div>

            {/* Batch Alert */}
            {batches.length > 0 && activeTab === "active" && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-bold text-violet-800">Batching — Preparar juntos</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {batches.map((b) => (
                            <button
                                key={b.item}
                                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-2 rounded-lg font-bold transition-colors"
                            >
                                <Layers className="w-3 h-3" />
                                {b.count}x {b.item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Urgent Hold Alert */}
            {urgentHolds.length > 0 && activeTab !== "hold" && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-600 animate-bounce" />
                        <div>
                            <p className="text-sm font-bold text-amber-800">
                                {urgentHolds.length} pedido{urgentHolds.length > 1 ? "s" : ""} en espera por activar
                            </p>
                            <p className="text-xs text-amber-600">Clases terminan pronto — ¡preparar para salida!</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setActiveTab("hold")}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors"
                    >
                        Ver espera
                    </button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${activeTab === tab.key
                            ? "bg-white shadow-sm text-stone-900"
                            : "text-stone-500 hover:text-stone-700"
                            }`}
                    >
                        {tab.label}
                        <span className={`text-xs ${activeTab === tab.key ? tab.color : "text-stone-400"}`}>
                            {tab.count}
                        </span>
                        {"alert" in tab && tab.alert && (
                            <span className="absolute top-1 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        )}
                    </button>
                ))}
            </div>

            {/* ── Active Orders Grid (Kanban) ─────────── */}
            {activeTab === "active" && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {activeOrders.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-stone-300">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                            <p className="font-medium">Sin órdenes activas 🎉</p>
                        </div>
                    ) : (
                        activeOrders
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                            .map((order) => <OrderCard key={order.id} order={order} fetcher={fetcher} />)
                    )}
                </div>
            )}

            {/* ── Hold Orders ─────────────────────────── */}
            {activeTab === "hold" && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {holdOrders.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-stone-300">
                            <Clock className="w-12 h-12 mx-auto mb-2" />
                            <p className="font-medium">Sin pedidos en espera</p>
                        </div>
                    ) : (
                        holdOrders
                            .sort((a, b) => {
                                // Urgent ones first
                                const aUrgent = a.holdUntil ? getMinutesUntil(a.holdUntil) <= 10 : false;
                                const bUrgent = b.holdUntil ? getMinutesUntil(b.holdUntil) <= 10 : false;
                                if (aUrgent && !bUrgent) return -1;
                                if (!aUrgent && bUrgent) return 1;
                                return 0;
                            })
                            .map((order) => <OrderCard key={order.id} order={order} fetcher={fetcher} />)
                    )}
                </div>
            )}

            {/* ── Completed ───────────────────────────── */}
            {activeTab === "completed" && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {completedOrders.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-stone-300">
                            <p className="font-medium">No hay órdenes completadas hoy</p>
                        </div>
                    ) : (
                        completedOrders.map((order) => (
                            <div key={order.id} className="rounded-2xl border border-green-200 bg-green-50/50 p-4 opacity-70">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-lg">{order.avatar}</div>
                                    <div>
                                        <p className="font-medium text-stone-700 text-sm">{order.customer}</p>
                                        <p className="text-[10px] text-stone-400">Hace {getMinutesAgo(order.createdAt)} min</p>
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    {order.items.map((item, i) => (
                                        <p key={i} className="text-xs text-stone-500">{item.qty > 1 ? `${item.qty}x ` : ""}{item.name}</p>
                                    ))}
                                </div>
                                <p className="text-xs text-green-600 font-bold mt-2 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Entregado • ${order.total}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Customer-Facing Pickup Display ──────── */}
            {activeTab === "pickup" && (
                <div className="bg-stone-900 rounded-2xl p-8 min-h-[400px]">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-white">Listos para recoger</h2>
                        <p className="text-stone-400 text-sm mt-1">Acércate a la barra ☕</p>
                    </div>
                    {completedOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-stone-500 text-lg">Sin pedidos listos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {completedOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-center shadow-xl"
                                >
                                    <div className="text-4xl mb-3">{order.avatar}</div>
                                    <p className="text-xl font-black text-white">{order.customer.split(" ")[0]}</p>
                                    <div className="mt-2 space-y-0.5">
                                        {order.items.map((item, i) => (
                                            <p key={i} className="text-sm text-green-100">{item.name}</p>
                                        ))}
                                    </div>
                                    <div className="mt-3 bg-white/20 rounded-lg py-1 px-3 inline-block">
                                        <p className="text-xs text-white font-bold">✓ LISTO</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
