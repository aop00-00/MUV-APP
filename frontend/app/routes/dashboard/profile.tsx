// app/routes/dashboard/profile.tsx
// Member profile – personal info, wallet, membership, history (MOCK DATA).
// Auth moved to dynamic import inside loader
import type { Route } from "./+types/profile";
import { Wallet, Plus, CreditCard, Shield } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);

    const membership = {
        id: "mem-001",
        user_id: profile.id,
        plan_name: "Plan Premium",
        status: "active" as const,
        price: 799,
        credits_included: 10,
        start_date: "2025-02-01",
        end_date: "2025-03-01",
        created_at: "2025-02-01T00:00:00Z",
    };

    const orders = [
        { id: "ord-a1b2c3d4", user_id: profile.id, status: "paid" as const, payment_method: "mercado_pago" as const, total: 799, mp_preference_id: null, mp_payment_id: null, items: [], created_at: "2025-02-12T10:00:00Z", updated_at: "2025-02-12T10:00:00Z" },
        { id: "ord-e5f6g7h8", user_id: profile.id, status: "paid" as const, payment_method: "cash" as const, total: 65, mp_preference_id: null, mp_payment_id: null, items: [], created_at: "2025-02-10T14:30:00Z", updated_at: "2025-02-10T14:30:00Z" },
        { id: "ord-i9j0k1l2", user_id: profile.id, status: "paid" as const, payment_method: "mercado_pago" as const, total: 450, mp_preference_id: null, mp_payment_id: null, items: [], created_at: "2025-01-28T09:15:00Z", updated_at: "2025-01-28T09:15:00Z" },
    ];

    const walletBalance = 150.0;

    return { profile, membership, orders, walletBalance };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
    const { profile, membership, orders, walletBalance } = loaderData;
    const qrData = `GRIND:${profile.id}`;

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
                <p className="text-gray-500 mt-1">Tu información, monedero y código de acceso.</p>
            </div>

            {/* ── Monedero Virtual ────────────────────────────── */}
            <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-purple-200 text-sm font-medium">
                            <Wallet className="w-4 h-4" />
                            Monedero Virtual
                        </div>
                        <p className="text-4xl font-black mt-2">${walletBalance.toFixed(2)}</p>
                        <p className="text-purple-200 text-sm mt-1">Saldo disponible en cafetería</p>
                    </div>
                    <button className="bg-white/15 hover:bg-white/25 backdrop-blur-sm px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2 border border-white/20">
                        <Plus className="w-4 h-4" />
                        Recargar
                    </button>
                </div>
                <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex items-center gap-4 text-xs text-purple-200">
                    <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Paga sin sacar tu tarjeta
                    </div>
                    <div>•</div>
                    <div>Recarga mínima: $50.00</div>
                </div>
            </div>

            {/* QR Access Code */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Código de acceso</h2>
                <div className="inline-flex items-center justify-center w-48 h-48 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <p className="text-gray-600 text-xs break-all p-4 font-mono">
                        {qrData}
                    </p>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                    Muestra este código al entrar al gym
                </p>
            </div>

            {/* Personal Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información personal</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-gray-400">Nombre</dt>
                        <dd className="font-medium text-gray-900">{profile.full_name}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-400">Email</dt>
                        <dd className="font-medium text-gray-900">{profile.email}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-400">Teléfono</dt>
                        <dd className="font-medium text-gray-900">{profile.phone ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-400">Créditos</dt>
                        <dd className="font-medium text-blue-600">{profile.credits}</dd>
                    </div>
                </dl>
            </div>

            {/* Membership */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Membresía activa</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-900">{membership.plan_name}</p>
                        <p className="text-sm text-gray-500">
                            {new Date(membership.start_date).toLocaleDateString("es-MX")} –{" "}
                            {new Date(membership.end_date).toLocaleDateString("es-MX")}
                        </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                        {membership.status}
                    </span>
                </div>
            </div>

            {/* Payment History */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de pagos</h2>
                <div className="divide-y divide-gray-100">
                    {orders.map((order) => (
                        <div key={order.id} className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <CreditCard className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        Orden #{order.id.slice(4, 12)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(order.created_at).toLocaleDateString("es-MX")}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-gray-900">${order.total.toFixed(2)}</p>
                                <p className={`text-xs ${order.status === "paid" ? "text-green-600" : "text-yellow-600"}`}>
                                    {order.status === "paid" ? "Pagado" : order.status}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
