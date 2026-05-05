// app/routes/dashboard/checkout/success.tsx
// Mercado Pago return page — shown after a successful payment.
// Also awards fitcoins for the purchase (per gym's fitcoin_rules).

import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/success";

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const paymentId = url.searchParams.get("payment_id");
    const status = url.searchParams.get("status");
    const externalRef = url.searchParams.get("external_reference");

    // Award purchase fitcoins only on approved payments
    if (status === "approved" && externalRef && externalRef.includes("flow:tenant")) {
        try {
            // Parse "flow:tenant:order:pending:user:{userId}:gym:{gymId}"
            const userMatch = externalRef.match(/user:([^:]+)/);
            const gymMatch = externalRef.match(/gym:([^:]+)/);
            const userId = userMatch?.[1];
            const gymId = gymMatch?.[1];

            if (userId && gymId && paymentId) {
                // Fetch payment amount from Supabase orders table (best-effort)
                const { supabaseAdmin } = await import("~/services/supabase.server");
                const { data: order } = await supabaseAdmin
                    .from("orders")
                    .select("total")
                    .eq("mp_payment_id", paymentId)
                    .eq("gym_id", gymId)
                    .single();

                const { applyFitCoinRule } = await import("~/services/fitcoin-rules.server");
                await applyFitCoinRule("purchase", userId, gymId, {
                    amountSpent: order?.total ?? 0,
                    description: "Compra de paquete",
                    referenceId: paymentId,
                });
            }
        } catch (e) {
            // Never crash the success page over fitcoins
            console.error("[checkout/success] fitcoin award failed:", e);
        }
    }

    return { paymentId, status };
}

export default function CheckoutSuccess({ loaderData }: Route.ComponentProps) {
    const { paymentId, status } = loaderData;

    return (
        <div className="max-w-lg mx-auto text-center space-y-6 py-12">
            <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center">
                <span className="text-4xl">✅</span>
            </div>

            <div>
                <h1 className="text-2xl font-bold">¡Pago exitoso!</h1>
                <p className="text-gray-400 mt-2">
                    Tu pago ha sido procesado correctamente. Tus créditos serán
                    acreditados automáticamente.
                </p>
            </div>

            {paymentId && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
                    <p className="text-gray-500">
                        ID de pago:{" "}
                        <span className="font-mono text-white">{paymentId}</span>
                    </p>
                    {status && (
                        <p className="text-gray-500 mt-1">
                            Estado: <span className="text-emerald-400">{status}</span>
                        </p>
                    )}
                </div>
            )}

            <Link
                to="/dashboard"
                className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
            >
                Volver al dashboard
            </Link>
        </div>
    );
}
