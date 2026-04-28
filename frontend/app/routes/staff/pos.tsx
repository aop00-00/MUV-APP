// app/routes/staff/pos.tsx
// Front Desk: simplified POS — view products, add to cart, register sale.
// No product management (create/edit/delete/price changes).

import { useState } from "react";
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/pos";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymFrontDesk(request);

    const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, name, price, category, stock, is_available")
        .eq("gym_id", gymId)
        .eq("is_available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

    return { products: products ?? [] };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId, profile } = await requireGymFrontDesk(request);

    const formData = await request.formData();
    const itemsRaw = formData.get("items") as string;
    const paymentMethod = formData.get("paymentMethod") as string;

    let items: { productId: string; quantity: number; unitPrice: number }[] = [];
    try { items = JSON.parse(itemsRaw); } catch { return { success: false, error: "Carrito inválido" }; }

    if (!items.length) return { success: false, error: "Carrito vacío" };

    const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
            gym_id: gymId,
            user_id: profile.id,
            status: "completed",
            payment_method: paymentMethod || "cash",
            total,
        })
        .select("id")
        .single();

    if (orderError || !order) {
        return { success: false, error: `Error al crear orden: ${orderError?.message}` };
    }

    // Create order items
    const orderItems = items.map(i => ({
        order_id: order.id,
        product_id: i.productId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
    }));

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsError) {
        return { success: false, error: `Error al registrar items: ${itemsError.message}` };
    }

    return { success: true, orderId: order.id, total };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartItem {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffPOS({ loaderData }: Route.ComponentProps) {
    const { products } = loaderData;
    const fetcher = useFetcher<typeof action>();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
    const [orderDone, setOrderDone] = useState(false);

    const isLoading = fetcher.state !== "idle";
    const result = fetcher.data as any;

    // Group products by category
    const byCategory = products.reduce<Record<string, typeof products>>((acc, p) => {
        const cat = (p as any).category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});

    function addToCart(product: any) {
        setCart(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i =>
                    i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
                );
            }
            return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: product.price }];
        });
    }

    function updateQty(productId: string, delta: number) {
        setCart(prev => prev
            .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
            .filter(i => i.quantity > 0)
        );
    }

    function clearCart() {
        setCart([]);
        setOrderDone(false);
    }

    function submitOrder() {
        const fd = new FormData();
        fd.set("items", JSON.stringify(cart.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
        }))));
        fd.set("paymentMethod", paymentMethod);
        fetcher.submit(fd, { method: "post" });
        setOrderDone(true);
    }

    const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    // Order success state
    if (orderDone && result?.success) {
        return (
            <div className="px-4 py-12 text-center space-y-4">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
                <p className="text-white font-black text-2xl">¡Venta registrada!</p>
                <p className="text-green-300 font-bold text-lg">
                    Total: ${result.total?.toFixed(2)}
                </p>
                <button
                    onClick={clearCart}
                    className="mt-4 bg-amber-400 text-black font-bold px-8 py-3 rounded-xl text-lg"
                >
                    Nueva venta
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Product grid */}
            <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
                {Object.entries(byCategory).map(([category, items]) => (
                    <div key={category}>
                        <p className="text-white/40 text-xs uppercase font-bold tracking-wider mb-2">{category}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {items.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="bg-gray-900 border border-white/10 rounded-xl p-3 text-left hover:border-amber-400/50 active:scale-95 transition-all"
                                >
                                    <p className="text-white font-semibold text-sm leading-tight">{p.name}</p>
                                    <p className="text-amber-400 font-black text-base mt-1">${Number(p.price).toFixed(2)}</p>
                                    {p.stock !== null && (
                                        <p className="text-white/30 text-xs mt-0.5">Stock: {p.stock}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {products.length === 0 && (
                    <div className="py-12 text-center">
                        <ShoppingCart className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">Sin productos disponibles</p>
                    </div>
                )}
            </div>

            {/* Cart panel */}
            {cart.length > 0 && (
                <div className="border-t border-white/10 bg-gray-900 px-4 py-4 space-y-3">
                    <div className="space-y-2 max-h-40 overflow-auto">
                        {cart.map(item => (
                            <div key={item.productId} className="flex items-center gap-2">
                                <span className="flex-1 text-white text-sm truncate">{item.name}</span>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => updateQty(item.productId, -1)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-white font-bold w-5 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateQty(item.productId, 1)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <span className="text-amber-400 font-bold text-sm w-16 text-right">
                                    ${(item.unitPrice * item.quantity).toFixed(2)}
                                </span>
                                <button onClick={() => updateQty(item.productId, -item.quantity)} className="text-white/30 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Payment method */}
                    <div className="flex gap-2">
                        {(["cash", "card"] as const).map(method => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    paymentMethod === method
                                        ? "bg-white/20 text-white"
                                        : "text-white/30 hover:text-white/60"
                                }`}
                            >
                                {method === "cash" ? "Efectivo" : "Tarjeta"}
                            </button>
                        ))}
                    </div>

                    {/* Total + checkout */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <p className="text-white/40 text-xs">Total</p>
                            <p className="text-white font-black text-xl">${total.toFixed(2)}</p>
                        </div>
                        <button
                            onClick={submitOrder}
                            disabled={isLoading}
                            className="bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-black font-black px-6 py-3 rounded-xl text-base flex items-center gap-2 transition-colors"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            Cobrar
                        </button>
                    </div>

                    {result?.error && (
                        <p className="text-red-400 text-xs text-center">{result.error}</p>
                    )}
                </div>
            )}
        </div>
    );
}
