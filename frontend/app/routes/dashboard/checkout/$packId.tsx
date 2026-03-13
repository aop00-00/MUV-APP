// app/routes/dashboard/checkout/$packId.tsx
// Checkout page – confirm package purchase and redirect to Mercado Pago (Tenant B2C Flow).
// Auth and Payment services moved to dynamic imports inside loader/action
import { redirect } from "react-router";
import type { Route } from "./+types/$packId";
import type { Product } from "~/types/database";
import { useFetcher } from "react-router";

// ── Fetch product from Supabase ───────────────────────────────────
// This helper is now in services/supabase.server.ts
// Supabase service moved to dynamic import inside loader

// ── Demo fallback catalogue ───────────────────────────────────────
const MOCK_PACKAGES: Record<string, Product> = {
    "pkg-001": {
        id: "pkg-001", name: "Paquete 5 Clases", price: 450,
        description: "5 créditos para cualquier clase.", image_url: null,
        category: "package", stock: 99, is_active: true,
        created_at: "2025-01-01T00:00:00Z",
    },
    "pkg-002": {
        id: "pkg-002", name: "Paquete 10 Clases", price: 799,
        description: "10 créditos – ahorra un 15%.", image_url: null,
        category: "package", stock: 99, is_active: true,
        created_at: "2025-01-01T00:00:00Z",
    },
    "pkg-003": {
        id: "pkg-003", name: "Paquete 20 Clases", price: 1399,
        description: "20 créditos – el mejor precio.", image_url: null,
        category: "package", stock: 99, is_active: true,
        created_at: "2025-01-01T00:00:00Z",
    },
};

// ── Loader ────────────────────────────────────────────────────────
export async function loader({ request, params }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { getProduct } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const product = await getProduct(params.packId, gymId);

    if (!product) {
        throw new Response("Producto no encontrado", { status: 404 });
    }
    return { product, gymId };
}

// ── Action — creates MP preference (Tenant B2C Flow 2) ───────────
export async function action({ request, params }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { getGymMpToken, createPreference } = await import("~/services/payment.server");
    const { getProduct } = await import("~/services/supabase.server");

    const { profile, gymId } = await requireGymAuth(request);

    // Demo mode: no Supabase / no gym → skip to success
    if (!gymId || gymId === "demo" || !process.env.SUPABASE_URL) {
        return redirect("/dashboard/checkout/success?status=approved&payment_id=demo-12345");
    }

    // Get the product from DB
    const product = await getProduct(params.packId, gymId);
    if (!product) throw new Response("Producto no encontrado", { status: 404 });

    // ── Flujo 2 (Tenant B2C): money goes to gym owner's account ──
    let mpToken: string;
    try {
        mpToken = await getGymMpToken(gymId);
    } catch (err) {
        // If gym has no MP token configured, show helpful error
        console.error("[checkout] No MP token for gym:", gymId, err);
        // In development fall back to demo success
        if (process.env.NODE_ENV !== "production") {
            return redirect("/dashboard/checkout/success?status=approved&payment_id=dev-12345");
        }
        throw new Response(
            "Este gimnasio aún no ha conectado su cuenta de Mercado Pago. Contacta al administrador.",
            { status: 503 }
        );
    }

    // Create MP preference using the gym's own token
    const initPoint = await createPreference(product, profile.id, mpToken, gymId);
    return redirect(initPoint);
}

// ── Component ─────────────────────────────────────────────────────
export default function CheckoutPack({ loaderData }: Route.ComponentProps) {
    const { product } = loaderData;
    const fetcher = useFetcher();
    const isSubmitting = fetcher.state !== "idle";

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Confirmar compra</h1>
                <p className="text-gray-500 mt-1">Revisa los detalles antes de pagar.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                    <span className="text-2xl font-bold text-blue-600">
                        ${product.price.toFixed(2)}
                    </span>
                </div>

                {product.description && (
                    <p className="text-sm text-gray-500">{product.description}</p>
                )}

                <div className="border-t border-gray-100 pt-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total a pagar</span>
                        <span className="font-bold text-gray-900">
                            ${product.price.toFixed(2)} MXN
                        </span>
                    </div>
                </div>

                {/* Badge: secure payment */}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-blue-500 text-lg">🔒</span>
                    <p className="text-xs text-blue-700 font-medium">
                        Pago procesado de forma segura por Mercado Pago
                    </p>
                </div>

                <fetcher.Form method="post">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Redirigiendo a Mercado Pago…
                            </>
                        ) : (
                            "Pagar con Mercado Pago →"
                        )}
                    </button>
                </fetcher.Form>

                <p className="text-xs text-gray-400 text-center">
                    Serás redirigido a Mercado Pago para completar el pago con tarjeta, OXXO o transferencia.
                </p>
            </div>
        </div>
    );
}
