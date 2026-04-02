// app/routes/dashboard/profile.tsx
// Member profile – personal info, wallet, membership, history (REAL DATA from Supabase).
import type { Route } from "./+types/profile";
import { Wallet, Plus, CreditCard, Shield } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);

    // Fetch active membership
    const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .in("status", ["active", "frozen"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    // Fetch last 10 orders
    const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, status, payment_method, total, created_at")
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false })
        .limit(10);

    // Wallet balance is profile.balance
    const walletBalance = Number(profile.balance ?? 0);

    return { profile, membership, orders: orders ?? [], walletBalance };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
    const { profile, membership, orders, walletBalance } = loaderData;
    const qrData = `GRIND:${profile.id}`;

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
                <p className="text-white/50 mt-1">Tu información, membresía y código de acceso.</p>
            </div>


            {/* QR Access Code */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Código de acceso</h2>
                <div className="inline-flex items-center justify-center w-48 h-48 bg-white/5 rounded-xl border-2 border-dashed border-white/10">
                    <p className="text-white/60 text-xs break-all p-4 font-mono">
                        {qrData}
                    </p>
                </div>
                <p className="text-sm text-white/40 mt-3">
                    Muestra este código al entrar al gym
                </p>
            </div>

            {/* Personal Info */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Información personal</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-white/40">Nombre</dt>
                        <dd className="font-medium text-white">{profile.full_name}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-white/40">Email</dt>
                        <dd className="font-medium text-white">{profile.email}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-white/40">Teléfono</dt>
                        <dd className="font-medium text-white">{profile.phone ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-white/40">Créditos</dt>
                        <dd className="font-medium text-blue-400">{profile.credits}</dd>
                    </div>
                </dl>
            </div>

            {/* Membership */}
            {membership ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-white mb-4">Membresía activa</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-white">{membership.plan_name}</p>
                            <p className="text-sm text-white/60">
                                {new Date(membership.start_date).toLocaleDateString("es-MX")} –{" "}
                                {new Date(membership.end_date).toLocaleDateString("es-MX")}
                            </p>
                            <p className="text-xs text-white/40 mt-1">
                                ${Number(membership.price).toFixed(0)} / mes • {membership.credits_included ?? 0} créditos incluidos
                            </p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            membership.status === "active"
                                ? "bg-green-500/10 text-green-400"
                                : membership.status === "frozen"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-white/10 text-white/50"
                        }`}>
                            {membership.status === "active" ? "Activa" : membership.status === "frozen" ? "Congelada" : membership.status}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm text-center">
                    <h2 className="text-lg font-semibold text-white mb-2">Sin membresía activa</h2>
                    <p className="text-sm text-white/40 mb-4">Compra un plan para acceder a clases ilimitadas.</p>
                    <a href="/dashboard/packages" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors">
                        Ver planes disponibles
                    </a>
                </div>
            )}

            {/* Payment History */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Historial de pagos</h2>
                {orders.length > 0 ? (
                    <div className="divide-y divide-white/5">
                        {orders.map((order) => (
                            <div key={order.id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg">
                                        <CreditCard className="w-4 h-4 text-white/40" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            Orden #{order.id.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            {new Date(order.created_at).toLocaleDateString("es-MX", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-white">${Number(order.total).toFixed(2)}</p>
                                    <p className={`text-xs ${
                                        order.status === "paid"
                                            ? "text-green-400"
                                            : order.status === "pending"
                                            ? "text-yellow-400"
                                            : "text-white/40"
                                    }`}>
                                        {order.status === "paid" ? "Pagado" : order.status === "pending" ? "Pendiente" : order.status}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-white/30 text-sm">
                        Sin historial de pagos.
                    </div>
                )}
            </div>
        </div>
    );
}
