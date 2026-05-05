import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/store";
import type { Product } from "~/types/database";
import { X, ShoppingBag, Lock, CreditCard, CheckCircle, ChevronRight, Package, Wallet } from "lucide-react";
import { useDashboardTheme } from "~/hooks/useDashboardTheme";

// ─── Action ─────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    // Iniciar pago: devuelve la public key del gym para montar el Brick
    if (intent === "init_payment") {
        const { data: gym } = await supabaseAdmin
            .from("gyms")
            .select("mp_public_key, mp_access_token, currency")
            .eq("id", gymId)
            .single();

        if (!gym?.mp_access_token) {
            return { initError: "El estudio aún no tiene Mercado Pago configurado. Contacta al administrador." };
        }

        return {
            mpPublicKey: gym.mp_public_key ?? null,
            currency: gym.currency ?? "MXN",
            userEmail: profile.email,
            userName: profile.full_name ?? "",
        };
    }

    // Procesar pago con token generado por el Brick
    if (intent === "process_payment") {
        const productId = formData.get("productId") as string;
        const cardToken = formData.get("cardToken") as string;
        const paymentMethodId = formData.get("paymentMethodId") as string;
        const installments = parseInt(formData.get("installments") as string) || 1;
        const issuerId = formData.get("issuerId") as string | null;
        const saveCard = formData.get("saveCard") === "true";

        const [productResult, gymResult] = await Promise.all([
            supabaseAdmin
                .from("products")
                .select("id, name, price, stock, is_active, category, gym_id, description, image_url")
                .eq("id", productId)
                .eq("gym_id", gymId)
                .single(),
            supabaseAdmin
                .from("gyms")
                .select("mp_access_token, currency")
                .eq("id", gymId)
                .single(),
        ]);

        if (productResult.error || !productResult.data) return { purchaseError: "Producto no encontrado." };
        const product = productResult.data;
        if (!product.is_active) return { purchaseError: "Este producto no está disponible." };
        if (product.stock <= 0) return { purchaseError: "Producto agotado." };
        if (!gymResult.data?.mp_access_token) return { purchaseError: "El estudio no tiene Mercado Pago configurado." };

        const mpToken = gymResult.data.mp_access_token;
        const currency = gymResult.data.currency ?? "MXN";

        // Crear o recuperar customer de MP para este usuario
        const { getOrCreateMpCustomer, processCardPayment, saveCardToCustomer } =
            await import("~/services/payment-bricks.server");

        const customerId = await getOrCreateMpCustomer(
            profile.id,
            profile.email,
            profile.full_name ?? "",
            mpToken
        );

        // Cobrar con el token del Brick
        const payment = await processCardPayment({
            token: cardToken,
            amount: Number(product.price),
            description: product.name,
            paymentMethodId,
            installments,
            customerId,
            ...(issuerId ? { issuerId } : {}),
            email: profile.email,
            externalReference: `store:gym:${gymId}:user:${profile.id}`,
            mpAccessToken: mpToken,
            currency,
        });

        if (payment.status !== "approved") {
            return { purchaseError: `Pago no aprobado: ${payment.status_detail}` };
        }

        // Guardar tarjeta si el usuario lo pidió
        if (saveCard) {
            try {
                await saveCardToCustomer(cardToken, customerId, mpToken);
            } catch (_) {
                // No interrumpir la compra si falla el guardado
            }
        }

        // Descontar stock de forma atómica
        const { error: stockError } = await supabaseAdmin
            .from("products")
            .update({ stock: product.stock - 1 })
            .eq("id", productId)
            .eq("gym_id", gymId)
            .gt("stock", 0);

        if (stockError) return { purchaseError: "Error al actualizar inventario. Contacta al administrador." };

        // Crear orden registrada como pagada con MP
        const { data: order } = await supabaseAdmin
            .from("orders")
            .insert({
                gym_id: gymId,
                user_id: profile.id,
                customer_name: profile.full_name ?? null,
                payment_method: "mercado_pago",
                type: "pos",
                status: "paid",
                subtotal: product.price,
                tax: 0,
                total: product.price,
                mp_payment_id: String(payment.id),
            })
            .select("id")
            .single();

        if (order) {
            await supabaseAdmin.from("order_items").insert({
                order_id: order.id,
                product_id: productId,
                quantity: 1,
                unit_price: product.price,
            });
        }

        // FitCoins best-effort
        try {
            const { applyFitCoinRule } = await import("~/services/fitcoin-rules.server");
            await applyFitCoinRule("purchase", profile.id, gymId, {
                amountSpent: Number(product.price),
                description: `Compra: ${product.name}`,
                referenceId: order?.id ?? productId,
            });
        } catch (_) {}

        return { purchaseSuccess: true, productName: product.name };
    }

    return { purchaseError: "Acción no reconocida." };
}

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId, profile } = await requireGymAuth(request);

    const [productsResult, gymResult, profileResult] = await Promise.all([
        supabaseAdmin
            .from("products")
            .select("*")
            .eq("gym_id", gymId)
            .eq("is_active", true)
            .in("category", ["beverage", "supplement", "merch", "package"])
            .order("category", { ascending: true })
            .order("created_at", { ascending: true }),
        supabaseAdmin
            .from("gyms")
            .select("brand_color, primary_color, mp_access_token, mp_public_key, currency")
            .eq("id", gymId)
            .single(),
        supabaseAdmin
            .from("profiles")
            .select("mp_customer_id")
            .eq("id", profile.id)
            .single(),
    ]);

    const brandColor = gymResult.data?.brand_color || gymResult.data?.primary_color || "#2563eb";
    const hasMpConfigured = !!(gymResult.data?.mp_access_token);
    const mpPublicKey = gymResult.data?.mp_public_key ?? null;
    const currency = gymResult.data?.currency ?? "MXN";
    const hasSavedCards = !!(profileResult.data?.mp_customer_id);

    return {
        products: productsResult.data ?? [],
        brandColor,
        hasMpConfigured,
        mpPublicKey,
        currency,
        hasSavedCards,
        userEmail: profile.email,
        userName: profile.full_name ?? "",
    };
}

// ─── MP Bricks Payment Step ──────────────────────────────────────
function BricksPaymentStep({
    product,
    brandColor,
    mpPublicKey,
    currency,
    userEmail,
    hasSavedCards,
    onBack,
    onSubmitToken,
    isProcessing,
    purchaseError,
}: {
    product: Product;
    brandColor: string;
    mpPublicKey: string | null;
    currency: string;
    userEmail: string;
    hasSavedCards: boolean;
    onBack: () => void;
    onSubmitToken: (data: { token: string; paymentMethodId: string; installments: number; issuerId?: string; saveCard: boolean }) => void;
    isProcessing: boolean;
    purchaseError?: string;
}) {
    const brickContainerRef = useRef<HTMLDivElement>(null);
    const brickInstanceRef = useRef<any>(null);
    const [saveCard, setSaveCard] = useState(false);
    const [brickReady, setBrickReady] = useState(false);
    const [brickError, setBrickError] = useState<string | null>(null);

    useEffect(() => {
        if (!mpPublicKey) return;

        let mounted = true;

        async function mountBrick() {
            try {
                // Cargar SDK de MP si no está cargado
                if (!(window as any).MercadoPago) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://sdk.mercadopago.com/js/v2";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("No se pudo cargar el SDK de Mercado Pago"));
                        document.head.appendChild(script);
                    });
                }

                if (!mounted) return;

                const mp = new (window as any).MercadoPago(mpPublicKey, { locale: "es-MX" });
                const bricksBuilder = mp.bricks();

                const settings = {
                    initialization: {
                        amount: Number(product.price),
                        payer: { email: userEmail },
                    },
                    customization: {
                        paymentMethods: {
                            creditCard: "all",
                            debitCard: "all",
                            ...(hasSavedCards ? { savedCards: true } : {}),
                        },
                        visual: {
                            style: {
                                theme: "dark",
                                customVariables: {
                                    baseColor: brandColor,
                                    fontSizeBase: "14px",
                                    borderRadiusFull: "12px",
                                },
                            },
                        },
                    },
                    callbacks: {
                        onReady: () => { if (mounted) setBrickReady(true); },
                        onError: (err: any) => { if (mounted) setBrickError(err?.message ?? "Error al cargar el formulario de pago."); },
                        onSubmit: async (cardData: any) => {
                            const { token, payment_method_id, installments, issuer_id } = cardData.formData ?? cardData;
                            onSubmitToken({
                                token,
                                paymentMethodId: payment_method_id,
                                installments: installments ?? 1,
                                issuerId: issuer_id,
                                saveCard,
                            });
                        },
                    },
                };

                brickInstanceRef.current = await bricksBuilder.create("cardPayment", "card-payment-brick", settings);
            } catch (err: any) {
                if (mounted) setBrickError(err?.message ?? "Error al inicializar el formulario.");
            }
        }

        mountBrick();

        return () => {
            mounted = false;
            brickInstanceRef.current?.unmount?.();
        };
    }, [mpPublicKey]);

    return (
        <>
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
                <button onClick={onBack} className="p-1.5 text-white/40 hover:text-white">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <div className="flex-1">
                    <h2 className="text-base font-black text-white">Datos de pago</h2>
                    <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                        <Lock className="w-3 h-3" /> Pago seguro con Mercado Pago
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Apple Pay solo aparece si el dispositivo lo soporta — MP lo detecta automáticamente */}
                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg"
                        alt="Apple Pay" className="h-5 opacity-50" />
                </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "65vh" }}>
                {/* Resumen del producto */}
                <div className="flex items-center justify-between rounded-xl px-4 py-3 border"
                    style={{ background: `${brandColor}15`, borderColor: `${brandColor}30` }}>
                    <div>
                        <p className="text-xs font-medium" style={{ color: `${brandColor}99` }}>{product.name}</p>
                        <p className="text-lg font-black text-white">${Number(product.price).toLocaleString("es-MX")} {currency}</p>
                    </div>
                    <ShoppingBag className="w-6 h-6 opacity-40 text-white" />
                </div>

                {/* Brick de MP */}
                {brickError ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                        <p className="text-sm text-red-400">{brickError}</p>
                        <p className="text-xs text-white/40 mt-1">Verifica tu conexión e intenta de nuevo.</p>
                    </div>
                ) : (
                    <div className="relative min-h-[180px]">
                        {!brickReady && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
                        <div id="card-payment-brick" ref={brickContainerRef} />
                    </div>
                )}

                {/* Opción para guardar tarjeta */}
                {!brickError && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${saveCard ? "border-transparent" : "border-white/20"}`}
                            style={saveCard ? { backgroundColor: brandColor } : {}}>
                            {saveCard && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" className="sr-only" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} />
                        <div>
                            <p className="text-sm text-white/80 font-medium group-hover:text-white transition-colors">Guardar tarjeta para próximas compras</p>
                            <p className="text-xs text-white/30">Solo tú puedes usarla. Puedes eliminarla cuando quieras.</p>
                        </div>
                    </label>
                )}

                {purchaseError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{purchaseError}</p>
                )}

                {isProcessing && (
                    <div className="flex items-center justify-center gap-2 py-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-sm text-white/60">Procesando tu pago…</span>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Purchase Modal ──────────────────────────────────────────────
type PurchaseStep = "detail" | "payment" | "success";

function StorePurchaseModal({
    product,
    brandColor,
    mpPublicKey,
    currency,
    userEmail,
    hasSavedCards,
    hasMpConfigured,
    onClose,
}: {
    product: Product;
    brandColor: string;
    mpPublicKey: string | null;
    currency: string;
    userEmail: string;
    hasSavedCards: boolean;
    hasMpConfigured: boolean;
    onClose: () => void;
}) {
    const fetcher = useFetcher<any>();
    const [step, setStep] = useState<PurchaseStep>("detail");
    const [isProcessing, setIsProcessing] = useState(false);

    const purchaseError = fetcher.data?.purchaseError;
    const purchaseSuccess = fetcher.data?.purchaseSuccess;

    useEffect(() => {
        if (purchaseSuccess) setStep("success");
    }, [purchaseSuccess]);

    function handleSubmitToken(data: {
        token: string;
        paymentMethodId: string;
        installments: number;
        issuerId?: string;
        saveCard: boolean;
    }) {
        setIsProcessing(true);
        const fd = new FormData();
        fd.set("intent", "process_payment");
        fd.set("productId", product.id);
        fd.set("cardToken", data.token);
        fd.set("paymentMethodId", data.paymentMethodId);
        fd.set("installments", String(data.installments));
        fd.set("saveCard", String(data.saveCard));
        if (data.issuerId) fd.set("issuerId", data.issuerId);
        fetcher.submit(fd, { method: "post" });
        setIsProcessing(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pb-20 md:pb-0" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative w-full md:max-w-md bg-gray-950 md:rounded-2xl rounded-t-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ maxHeight: "min(92dvh, 92vh)" }}
            >
                {/* ── Step: Detail ── */}
                {step === "detail" && (
                    <>
                        <div className="p-5 border-b border-white/10" style={{ background: `linear-gradient(135deg, ${brandColor}25, ${brandColor}08)` }}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: brandColor }}>
                                        {categoryLabel(product.category)}
                                    </p>
                                    <h2 className="text-xl font-black text-white">{product.name}</h2>
                                </div>
                                <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white flex-shrink-0">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "55vh" }}>
                            {product.description && (
                                <p className="text-sm text-white/70 leading-relaxed">{product.description}</p>
                            )}

                            {product.stock <= 5 && product.stock > 0 && (
                                <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-2.5">
                                    <span className="text-amber-400 text-xs font-bold">Últimas {product.stock} unidades disponibles</span>
                                </div>
                            )}

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
                                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Resumen</p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">{product.name}</span>
                                    <span className="font-bold text-white">${Number(product.price).toLocaleString("es-MX")} {currency}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm border-t border-white/10 pt-2">
                                    <span className="font-bold text-white">Total</span>
                                    <span className="text-xl font-black text-white">${Number(product.price).toLocaleString("es-MX")} {currency}</span>
                                </div>
                            </div>

                            {!hasMpConfigured && (
                                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3">
                                    <span className="text-amber-400 text-xs leading-relaxed">
                                        El estudio no tiene Mercado Pago configurado. El pago no estará disponible hasta que el administrador conecte su cuenta.
                                    </span>
                                </div>
                            )}

                            {purchaseError && (
                                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{purchaseError}</p>
                            )}
                        </div>

                        <div className="p-5 border-t border-white/10">
                            <button
                                onClick={() => setStep("payment")}
                                disabled={!hasMpConfigured}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ backgroundColor: brandColor }}
                            >
                                <CreditCard className="w-4 h-4" />
                                Continuar al pago
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                )}

                {/* ── Step: Payment (Bricks) ── */}
                {step === "payment" && (
                    <BricksPaymentStep
                        product={product}
                        brandColor={brandColor}
                        mpPublicKey={mpPublicKey}
                        currency={currency}
                        userEmail={userEmail}
                        hasSavedCards={hasSavedCards}
                        onBack={() => setStep("detail")}
                        onSubmitToken={handleSubmitToken}
                        isProcessing={isProcessing || fetcher.state === "submitting"}
                        purchaseError={purchaseError}
                    />
                )}

                {/* ── Step: Success ── */}
                {step === "success" && (
                    <div className="p-8 text-center space-y-5">
                        <div className="relative mx-auto w-20 h-20">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}25` }}>
                                <CheckCircle className="w-10 h-10" style={{ color: brandColor }} />
                            </div>
                            <span className="absolute -top-1 -right-1 text-2xl">✨</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-1">¡Compra exitosa!</h2>
                            <p className="text-white/60 text-sm">Tu producto ha sido registrado.</p>
                        </div>
                        <div className="rounded-2xl p-5 text-left space-y-2 border" style={{ background: `${brandColor}10`, borderColor: `${brandColor}30` }}>
                            <div className="flex items-center gap-3">
                                <Package className="w-5 h-5" style={{ color: brandColor }} />
                                <p className="font-black text-white text-lg">{product.name}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                <span className="text-xs text-white/40">Total pagado</span>
                                <span className="font-black text-white">${Number(product.price).toLocaleString("es-MX")} {currency}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: brandColor }}
                        >
                            Seguir comprando
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function categoryLabel(cat: string) {
    const map: Record<string, string> = {
        beverage: "Bebida",
        supplement: "Suplemento",
        merch: "Merchandise",
        package: "Paquete",
    };
    return map[cat] ?? cat;
}

// ─── Main Component ──────────────────────────────────────────────
export default function Store({ loaderData }: Route.ComponentProps) {
    const { products, brandColor, hasMpConfigured, mpPublicKey, currency, hasSavedCards, userEmail, userName } = loaderData as any;
    const brand = brandColor || "#2563eb";
    const t = useDashboardTheme();
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const categories: Record<string, string> = {
        beverage: "🥤 Bebidas",
        supplement: "💊 Suplementos",
        merch: "👕 Merchandise",
        package: "📦 Paquetes",
    };

    const filterOptions = [
        { id: "all", label: "Todo" },
        { id: "beverage", label: "Bebidas" },
        { id: "supplement", label: "Suplementos" },
        { id: "merch", label: "Merchandise" },
        { id: "package", label: "Paquetes" },
    ];

    const displayedProducts = filterCategory === "all"
        ? products
        : products.filter((p: Product) => p.category === filterCategory);

    const grouped = displayedProducts.reduce(
        (acc: Record<string, Product[]>, product: Product) => {
            const cat = product.category;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(product);
            return acc;
        },
        {} as Record<string, Product[]>
    );

    return (
        <div className="space-y-10 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">Tienda</h1>
                    <p className="text-white/60 mt-2 max-w-md text-lg">
                        Productos oficiales de{" "}
                        <span className="font-bold" style={{ color: brand }}>tu centro</span>{" "}
                        para potenciar tu entrenamiento.
                    </p>
                </div>
                {/* Filter Bar */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-white/10 rounded-2xl w-fit">
                    {filterOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setFilterCategory(option.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                filterCategory === option.id
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-white/50 hover:text-white/70"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {Object.keys(grouped).length > 0 ? (
                (Object.entries(grouped) as [string, Product[]][]).map(([category, items]) => (
                    <section key={category} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white flex-shrink-0 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brand }} />
                                {categories[category] ?? category}
                            </h2>
                            <div className="h-[1px] w-full bg-gradient-to-r from-gray-700 to-transparent" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {items.map((product) => (
                                <div
                                    key={product.id}
                                    className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden group hover:border-white/20 transition-all hover:shadow-2xl flex flex-col relative"
                                >
                                    {product.stock <= 5 && product.stock > 0 && (
                                        <div className="absolute top-4 right-4 z-10 bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                                            Últimas unidades
                                        </div>
                                    )}

                                    <div className="p-8 flex flex-col flex-1">
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-extrabold text-white text-xl tracking-tight group-hover:text-white transition-colors">
                                                    {product.name}
                                                </h3>
                                            </div>
                                            {product.description ? (
                                                <p className="text-sm text-white/50 mt-2 line-clamp-3 leading-relaxed">
                                                    {product.description}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-white/30 italic mt-2">Sin descripción disponible.</p>
                                            )}
                                        </div>

                                        <div className="mt-8 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Precio</span>
                                                <span className="text-3xl font-black text-white">
                                                    ${Number(product.price).toLocaleString("es-MX")}
                                                </span>
                                                <span className="text-[10px] text-white/30 mt-0.5">{currency}</span>
                                            </div>
                                            <button
                                                onClick={() => product.stock > 0 && setSelectedProduct(product)}
                                                disabled={product.stock === 0}
                                                className="px-6 py-3.5 text-white font-black text-xs rounded-2xl transition-all shadow-xl uppercase tracking-[0.15em] disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                                                style={product.stock > 0 ? { backgroundColor: brand } : {}}
                                            >
                                                {product.stock === 0 ? "Agotado" : "Adquirir"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))
            ) : (
                <div className="bg-white/5 rounded-[40px] p-24 text-center border border-white/10 shadow-sm">
                    <div className="bg-white/5 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                        <span className="text-4xl text-white/40">📦</span>
                    </div>
                    <h3 className="text-white text-2xl font-black tracking-tight">Catálogo pendiente</h3>
                    <p className="text-white/50 text-sm mt-4 max-w-xs mx-auto leading-relaxed">
                        {filterCategory === "all"
                            ? "Aún no hay artículos disponibles en este centro. Vuelve pronto."
                            : `No hay artículos en la categoría ${filterOptions.find(o => o.id === filterCategory)?.label}.`}
                    </p>
                </div>
            )}

            {/* ── Purchase Modal ── */}
            {selectedProduct && (
                <StorePurchaseModal
                    product={selectedProduct}
                    brandColor={brand}
                    mpPublicKey={mpPublicKey}
                    currency={currency}
                    userEmail={userEmail}
                    hasSavedCards={hasSavedCards}
                    hasMpConfigured={hasMpConfigured}
                    onClose={() => setSelectedProduct(null)}
                />
            )}
        </div>
    );
}
