// app/routes/dashboard/checkout/$packId.tsx
// Checkout page – confirm package purchase and redirect to Mercado Pago (Tenant B2C Flow).
// Auth and Payment services moved to dynamic imports inside loader/action
import { redirect } from "react-router";
import type { Route } from "./+types/$packId";
import { useFetcher } from "react-router";
import { useEffect } from "react";

// ── Loader ────────────────────────────────────────────────────────
export async function loader({ request, params }: Route.LoaderArgs) {
    console.log("[checkout/$packId/loader] ========== INICIO DE LOADER ==========");
    console.log("[checkout/$packId/loader] Params:", params);
    console.log("[checkout/$packId/loader] Request URL:", request.url);

    const { requireGymAuth } = await import("~/services/gym.server");
    const { getProduct } = await import("~/services/supabase.server");

    let profile, gymId;
    try {
        const auth = await requireGymAuth(request);
        profile = auth.profile;
        gymId = auth.gymId;
        console.log("[checkout/$packId/loader] ✅ Auth exitoso - User ID:", profile.id, "Gym ID:", gymId);
    } catch (authError) {
        console.error("[checkout/$packId/loader] ❌ Error en requireGymAuth:", authError);
        throw authError;
    }

    console.log("[checkout/$packId/loader] 🔍 Buscando producto con ID:", params.packId, "para gym:", gymId);
    const product = await getProduct(params.packId, gymId);

    if (!product) {
        console.error("[checkout/$packId/loader] ❌ Producto NO encontrado");
        throw new Response("Producto no encontrado", { status: 404 });
    }

    console.log("[checkout/$packId/loader] ✅ Producto encontrado:", {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category
    });
    console.log("[checkout/$packId/loader] ========== FIN DE LOADER ==========");

    return { product, gymId };
}

// ── Action — creates MP preference (Tenant B2C Flow 2) ───────────
export async function action({ request, params }: Route.ActionArgs) {
    console.log("[checkout/$packId] ========== INICIO DE ACTION ==========");
    console.log("[checkout/$packId] Params:", params);
    console.log("[checkout/$packId] Request URL:", request.url);

    const { requireGymAuth } = await import("~/services/gym.server");
    const { getGymMpToken, createPreference } = await import("~/services/payment.server");
    const { getProduct } = await import("~/services/supabase.server");

    let profile, gymId;
    try {
        const auth = await requireGymAuth(request);
        profile = auth.profile;
        gymId = auth.gymId;
        console.log("[checkout/$packId] ✅ Auth exitoso - User ID:", profile.id, "Gym ID:", gymId);
    } catch (authError) {
        console.error("[checkout/$packId] ❌ Error en requireGymAuth:", authError);
        throw authError;
    }

    // Demo mode: no Supabase / no gym → skip to success
    if (!gymId || gymId === "demo" || !process.env.SUPABASE_URL) {
        console.log("[checkout/$packId] ⚠️ Modo DEMO detectado - Redirigiendo a success");
        return redirect("/dashboard/checkout/success?status=approved&payment_id=demo-12345");
    }

    // Get the product from DB
    console.log("[checkout/$packId] 🔍 Obteniendo producto con ID:", params.packId, "para gym:", gymId);
    const product = await getProduct(params.packId, gymId);
    if (!product) {
        console.error("[checkout/$packId] ❌ Producto NO encontrado - ID:", params.packId, "Gym:", gymId);
        throw new Response("Producto no encontrado", { status: 404 });
    }
    console.log("[checkout/$packId] ✅ Producto encontrado:", {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category
    });

    // ── Flujo 2 (Tenant B2C): money goes to gym owner's account ──
    let mpToken: string;
    try {
        console.log("[checkout/$packId] 🔑 Obteniendo token de Mercado Pago para gym:", gymId);
        mpToken = await getGymMpToken(gymId);
        console.log("[checkout/$packId] ✅ Token de MP obtenido exitosamente - Longitud:", mpToken?.length || 0);
    } catch (err) {
        // If gym has no MP token configured, show helpful error
        console.error("[checkout/$packId] ❌ Error al obtener token de MP:", err);
        console.error("[checkout/$packId] Stack trace:", (err as Error).stack);
        // In development fall back to demo success
        if (process.env.NODE_ENV !== "production") {
            console.log("[checkout/$packId] ⚠️ Modo desarrollo - Redirigiendo a success de prueba");
            return redirect("/dashboard/checkout/success?status=approved&payment_id=dev-12345");
        }
        throw new Response(
            "Este gimnasio aún no ha conectado su cuenta de Mercado Pago. Contacta al administrador.",
            { status: 503 }
        );
    }

    // Create MP preference using the gym's own token
    try {
        console.log("[checkout/$packId] 📝 Creando preferencia de MP...");
        const initPoint = await createPreference(product, profile.id, mpToken, gymId);
        console.log("[checkout/$packId] ✅ Preferencia creada exitosamente");
        console.log("[checkout/$packId] 🔗 Init Point:", initPoint);
        console.log("[checkout/$packId] ========== FIN DE ACTION (EXITOSO) ==========");
        return redirect(initPoint);
    } catch (preferenceError) {
        console.error("[checkout/$packId] ❌ Error al crear preferencia de MP:", preferenceError);
        console.error("[checkout/$packId] Stack trace:", (preferenceError as Error).stack);
        console.log("[checkout/$packId] ========== FIN DE ACTION (CON ERROR) ==========");
        throw preferenceError;
    }
}

// ── Component ─────────────────────────────────────────────────────
export default function CheckoutPack({ loaderData }: Route.ComponentProps) {
    const { product } = loaderData;
    const fetcher = useFetcher();
    const isSubmitting = fetcher.state !== "idle";

    // Log component mount and state changes
    console.log("[CheckoutPack Component] Renderizando componente");
    console.log("[CheckoutPack Component] Producto:", product);
    console.log("[CheckoutPack Component] Fetcher state:", fetcher.state);
    console.log("[CheckoutPack Component] Fetcher data:", fetcher.data);

    // Monitor fetcher state changes
    useEffect(() => {
        console.log("[CheckoutPack Component] ⚡ Fetcher state cambió a:", fetcher.state);

        if (fetcher.state === "idle" && fetcher.data) {
            console.log("[CheckoutPack Component] 📦 Datos del fetcher:", fetcher.data);
        }

        if (fetcher.state === "submitting") {
            console.log("[CheckoutPack Component] ⏳ Enviando formulario...");
        }

        if (fetcher.state === "loading") {
            console.log("[CheckoutPack Component] 🔄 Cargando respuesta...");
        }
    }, [fetcher.state, fetcher.data]);

    // Log when form is submitted
    const handleSubmit = (e: React.FormEvent) => {
        console.log("[CheckoutPack Component] 🚀 Formulario enviado");
        console.log("[CheckoutPack Component] Producto a comprar:", {
            id: product.id,
            name: product.name,
            price: product.price
        });
    };

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

                <fetcher.Form method="post" onSubmit={handleSubmit}>
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
