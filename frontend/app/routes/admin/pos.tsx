// app/routes/admin/pos.tsx
// Admin – POS with persistent cart, customer accounts (Supabase).
import type { Route } from "./+types/pos";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { ShoppingCart, Trash2, Search, User, CreditCard, Banknote, AlertTriangle, X, Plus, Minus, Package, Edit, Save, UserPlus, Sparkles, Eye, ArrowRightLeft } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface POSEvent {
    id: string;
    name: string;
    price: number;
    date: string;
    location: string;
}

interface POSProduct {
    id: string;
    name: string;
    price: number;
    cost: number;
    stock: number;
    category: string;
    is_active: boolean;
    description: string | null;
    metadata: Record<string, any> | null;
}

interface CartItem {
    product: POSProduct;
    qty: number;
}

const LOW_STOCK_THRESHOLD = 5;

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const { getPosProducts, getPosCustomers } = await import("~/services/order.server");
    const { getGymEvents } = await import("~/services/event.server");

    const [rawProducts, customers, rawEvents] = await Promise.all([
        getPosProducts(gymId),
        getPosCustomers(gymId),
        getGymEvents(gymId),
    ]);

    const products: POSProduct[] = rawProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cost: p.cost ?? 0,
        stock: p.stock ?? 0,
        category: p.category ?? "Otro",
        is_active: p.is_active ?? true,
        description: p.description ?? null,
        metadata: p.metadata ?? null,
    }));

    const events: POSEvent[] = rawEvents
        .filter((e: any) => e.is_active)
        .map((e: any) => ({
            id: e.id,
            name: e.name,
            price: e.price,
            date: new Date(e.start_time).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            location: e.location ?? "",
        }));

    return { products, customers, events };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "checkout") {
        const { createOrder } = await import("~/services/order.server");
        const method = formData.get("method") as "cash" | "card" | "transfer";
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items = itemsJson ? JSON.parse(itemsJson) : [];
        try {
            await createOrder({
                gymId,
                userId: profile.id,
                customerName: null,
                paymentMethod: method,
                items,
                subtotal: total,
                tax: 0,
                total,
            });
        } catch (err: any) {
            return { success: false, message: `Error al procesar la venta: ${err?.message ?? "Error desconocido"}` };
        }

        return { success: true, message: "Venta completada." };
    }

    if (intent === "charge_account") {
        const { chargeToAccount } = await import("~/services/order.server");
        const customerId = formData.get("customerId") as string;
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items = itemsJson ? JSON.parse(itemsJson) : [];
        try {
            await chargeToAccount({
                gymId,
                customerId,
                total,
                items,
                subtotal: total,
                tax: 0,
            });
        } catch (err: any) {
            return { success: false, message: `Error al cargar a cuenta: ${err?.message ?? "Error desconocido"}` };
        }

        return { success: true, message: "Cargo a cuenta registrado." };
    }

    if (intent === "guest_checkout") {
        const { createOrder } = await import("~/services/order.server");
        const method = formData.get("method") as "cash" | "card" | "transfer";
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items = itemsJson ? JSON.parse(itemsJson) : [];
        const guestName = (formData.get("guest_name") as string)?.trim() || "Visitante";
        const guestPhone = (formData.get("guest_phone") as string)?.trim() || null;
        const customerName = guestPhone ? `${guestName} (${guestPhone})` : guestName;

        try {
            await createOrder({
                gymId,
                userId: profile.id,
                customerName,
                paymentMethod: method,
                items,
                subtotal: total,
                tax: 0,
                total,
            });
        } catch (err: any) {
            return { success: false, message: `Error al procesar la venta: ${err?.message ?? "Error desconocido"}`, intent: "guest_checkout" };
        }

        return { success: true, message: `Venta registrada para ${guestName}.`, intent: "guest_checkout" };
    }

    if (intent === "upsert_product") {
        const { upsertProduct } = await import("~/services/product.server");
        const id = formData.get("id") as string;

        // Enforce per-plan POS product limits (creation only, not edits)
        // DB trigger is the hard stop, this is the UX layer
        if (!id) {
            const { PLAN_FEATURES } = await import("~/config/plan-features");
            const { supabaseAdmin: supa } = await import("~/services/supabase.server");
            const { data: gymData } = await supa.from("gyms").select("plan_id").eq("id", gymId).single();
            const gymPlanDef = PLAN_FEATURES[(gymData?.plan_id || "starter") as keyof typeof PLAN_FEATURES];
            const maxProducts = gymPlanDef?.maxPosProducts;
            
            if (maxProducts != null) { // null = unlimited
                const { getPosProducts } = await import("~/services/order.server");
                const existing = await getPosProducts(gymId);
                if (existing.length >= maxProducts) {
                    return {
                        success: false,
                        message: `Tu plan ${gymPlanDef.label} permite máximo ${maxProducts} productos en el POS. Actualiza a Starter para agregar más.`,
                        limitReached: "pos_products",
                    };
                }
            }
        }
        const name = formData.get("name") as string;
        const category = formData.get("category") as any;
        const price = Number(formData.get("price"));
        const cost = Number(formData.get("cost") ?? 0);
        const stock = Number(formData.get("stock"));
        const description = formData.get("description") as string;

        try {
            await upsertProduct(gymId, {
                id: id || undefined,
                name,
                category,
                price,
                cost,
                stock,
                description,
            });
            return { success: true, message: id ? "Producto actualizado." : "Producto creado." };
        } catch (e: any) {
            return { success: false, message: e.message ?? "Error al guardar el producto" };
        }
    }

    if (intent === "delete_product") {
        try {
            const { deleteProduct } = await import("~/services/product.server");
            const productId = formData.get("productId") as string;
            await deleteProduct(gymId, productId);
            return { success: true, message: "Producto eliminado." };
        } catch (e: any) {
            return { success: false, message: e.message ?? "Error al eliminar el producto" };
        }
    }

    if (intent === "plan_checkout") {
        const { supabaseAdmin } = await import("~/services/supabase.server");
        const { createMembership } = await import("~/services/subscription.server");
        const { createOrder } = await import("~/services/order.server");

        const full_name = formData.get("full_name") as string;
        const email = formData.get("email") as string;
        const phone = (formData.get("phone") as string) || null;
        const password = (formData.get("password") as string) || "Grind2026!";
        const method = (formData.get("method") as "cash" | "card" | "transfer") || "cash";
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items: Array<{ productId: string; name: string; quantity: number; unitPrice: number; category: string; metadata: any }> = itemsJson ? JSON.parse(itemsJson) : [];
        // 1. Crear usuario en auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, gym_id: gymId, role: "member" },
        });
        if (authError) return { success: false, message: `Error al crear usuario: ${authError.message}`, intent: "plan_checkout" };

        const userId = authData.user.id;

        // 2. Crear perfil
        const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
            { id: userId, email, full_name, phone, role: "member", credits: 0, gym_id: gymId },
            { onConflict: "id" }
        );
        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return { success: false, message: `Error al crear perfil: ${profileError.message}`, intent: "plan_checkout" };
        }

        // 3. Crear membresía por cada item de tipo plan
        const planItems = items.filter(i => i.category === "plan");
        for (const planItem of planItems) {
            const meta = planItem.metadata ?? {};
            const planType = (meta.plan_type ?? "creditos") as "creditos" | "membresia" | "ilimitado";
            const credits = planType === "creditos" ? (meta.credits ?? 0) : 0;
            const validityDays = meta.validity_days ?? 30;
            try {
                await createMembership({
                    userId,
                    gymId,
                    planName: planItem.name,
                    price: planItem.unitPrice * planItem.quantity,
                    credits,
                    planType,
                    validityDays,
                    paymentMethod: method as any,
                    customerName: full_name,
                });
                if (planType === "creditos" && credits > 0) {
                    await supabaseAdmin.from("profiles").update({ credits }).eq("id", userId).eq("gym_id", gymId);
                }
            } catch (err: any) {
                console.error("[POS plan_checkout] membership error:", err.message);
            }
        }

        // 4. Registrar orden / ingreso
        try {
            await createOrder({
                gymId,
                userId,
                customerName: full_name,
                paymentMethod: method as any,
                type: "membership",
                items: items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
                subtotal: total,
                tax: 0,
                total,
            });
        } catch (err: any) {
            console.error("[POS plan_checkout] order error:", err.message);
        }

        return { success: true, message: `¡${full_name} registrado y plan asignado!`, intent: "plan_checkout" };
    }

    if (intent === "toggle_active") {
        try {
            const { toggleProductActive } = await import("~/services/product.server");
            const productId = formData.get("productId") as string;
            const isActive = formData.get("isActive") === "true";
            await toggleProductActive(gymId, productId, !isActive);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message ?? "Error al cambiar estado del producto" };
        }
    }

    return { success: true };
}

export default function POS({ loaderData }: Route.ComponentProps) {
    const { products, customers, events } = loaderData;
    const fetcher = useFetcher<{ success?: boolean; message?: string; intent?: string }>();
    const newMemberFetcher = useFetcher<{ success?: boolean; message?: string; intent?: string }>();
    const guestFetcher = useFetcher<{ success?: boolean; message?: string; intent?: string }>();
    const [view, setView] = useState<"pos" | "inventory">("pos");
    const [productTab, setProductTab] = useState<"products" | "events">("products");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<typeof customers[0] | null>(null);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [showNewMemberForm, setShowNewMemberForm] = useState(false);
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [newMember, setNewMember] = useState({ full_name: "", email: "", phone: "", password: "", confirmPassword: "" });
    const [guest, setGuest] = useState({ name: "", phone: "" });

    const hasPlan = cart.some(c => c.product.category === "plan");
    const passwordValid = newMember.password.length >= 8 && newMember.password === newMember.confirmPassword;
    const newMemberIsValid = newMember.full_name.trim() !== "" && newMember.email.includes("@") && passwordValid;
    const guestIsValid = guest.name.trim() !== "";

    // Ocultar formulario si ya no hay plan en el carrito
    useEffect(() => {
        if (!hasPlan) setShowNewMemberForm(false);
    }, [hasPlan]);

    // Ocultar guest form si el carrito queda vacío
    useEffect(() => {
        if (cart.length === 0) setShowGuestForm(false);
    }, [cart.length]);

    useEffect(() => {
        const data = fetcher.data;
        if (!data?.message) return;
        setToast({ type: data.success ? "success" : "error", message: data.message });
        if (data.success && (data.message === "Venta completada." || data.message === "Cargo a cuenta registrado.")) {
            setCart([]);
            setSelectedCustomer(null);
        }
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [fetcher.data]);

    useEffect(() => {
        const data = newMemberFetcher.data;
        if (!data?.message) return;
        setToast({ type: data.success ? "success" : "error", message: data.message });
        if (data.success && data.intent === "plan_checkout") {
            setCart([]);
            setSelectedCustomer(null);
            setShowNewMemberForm(false);
            setNewMember({ full_name: "", email: "", phone: "", password: "", confirmPassword: "" });
        }
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [newMemberFetcher.data]);

    useEffect(() => {
        const data = guestFetcher.data;
        if (!data?.message) return;
        setToast({ type: data.success ? "success" : "error", message: data.message });
        if (data.success && data.intent === "guest_checkout") {
            setCart([]);
            setShowGuestForm(false);
            setGuest({ name: "", phone: "" });
        }
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [guestFetcher.data]);

    const addEventToCart = (ev: POSEvent) => {
        const virtual: POSProduct = {
            id: `event-${ev.id}`,
            name: ev.name,
            price: ev.price,
            cost: 0,
            stock: 999,
            category: "event",
            is_active: true,
            description: `${ev.date}${ev.location ? ` · ${ev.location}` : ""}`,
            metadata: { event_id: ev.id },
        };
        addToCart(virtual);
    };

    const addToCart = (product: POSProduct) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.product.id === product.id);
            if (existing) {
                return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { product, qty: 1 }];
        });
    };

    const updateQty = (productId: string, delta: number) => {
        setCart((prev) =>
            prev.map((c) => c.product.id === productId ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0)
        );
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => prev.filter((c) => c.product.id !== productId));
    };

    const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0);

    const filteredCustomers = customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                    {toast.type === "success" ? "✓" : "✗"} {toast.message}
                </div>
            )}

            {/* Header / Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{view === "pos" ? "Punto de Venta" : "Inventario"}</h1>
                    <p className="text-white/50 mt-1">
                        {view === "pos" ? "Toca un producto para agregar al carrito." : "Gestiona el catálogo de productos de tu tienda."}
                    </p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setView("pos")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${view === "pos" ? "bg-purple-600 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        Venta
                    </button>
                    <button
                        onClick={() => setView("inventory")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${view === "inventory" ? "bg-purple-600 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                    >
                        <Package className="w-4 h-4" />
                        Inventario
                    </button>
                </div>
            </div>

            {view === "pos" ? (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-220px)]">
                    {/* ── Product / Events Grid (left) ─────────── */}
                    <div className="flex-1 space-y-4 w-full">
                        {/* Pestañas */}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
                            <button
                                onClick={() => setProductTab("products")}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${productTab === "products" ? "bg-purple-600 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                            >
                                <Package className="w-4 h-4" />
                                Productos
                            </button>
                            <button
                                onClick={() => setProductTab("events")}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${productTab === "events" ? "bg-amber-500 text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                            >
                                <Sparkles className="w-4 h-4" />
                                Eventos
                                {events.length > 0 && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${productTab === "events" ? "bg-black/20 text-black" : "bg-amber-500 text-black"}`}>{events.length}</span>
                                )}
                            </button>
                        </div>

                        {productTab === "products" ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {products.filter(p => p.is_active).map((product) => {
                                    const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
                                    const isOutOfStock = product.stock <= 0;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => !isOutOfStock && addToCart(product)}
                                            disabled={isOutOfStock}
                                            className={`text-left rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${isOutOfStock
                                                ? "bg-white/5 border-2 border-white/10 opacity-50 cursor-not-allowed"
                                                : isLowStock
                                                    ? "bg-white/5 border-2 border-red-300 hover:border-red-400"
                                                    : "bg-white/5 border border-white/[0.08] hover:border-purple-400 hover:shadow-md"
                                                }`}
                                        >
                                            {isLowStock && !isOutOfStock && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mb-1.5">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    LOW STOCK
                                                </div>
                                            )}
                                            {isOutOfStock && (
                                                <div className="text-[10px] font-bold text-white/40 mb-1.5">AGOTADO</div>
                                            )}
                                            <p className="font-semibold text-white text-sm">{product.name}</p>
                                            <p className="text-purple-600 font-bold mt-1">${product.price.toFixed(2)}</p>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <p className={`text-xs ${isLowStock ? "text-red-500 font-medium" : "text-white/40"}`}>
                                                    Stock: {product.stock}
                                                </p>
                                                <span className="text-[10px] text-white/40 bg-white/5/10 px-1.5 py-0.5 rounded">{product.category}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {events.length === 0 ? (
                                    <div className="col-span-full text-center py-12 text-white/30">
                                        <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No hay eventos activos.</p>
                                        <p className="text-xs mt-1">Crea eventos en el panel de Eventos.</p>
                                    </div>
                                ) : events.map((ev) => (
                                    <button
                                        key={ev.id}
                                        onClick={() => addEventToCart(ev)}
                                        className="text-left rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-1 text-[10px] font-black text-amber-400 mb-1.5 uppercase tracking-wider">
                                            <Sparkles className="w-3 h-3" />
                                            Evento
                                        </div>
                                        <p className="font-semibold text-white text-sm leading-tight">{ev.name}</p>
                                        <p className="text-amber-400 font-bold mt-1">${ev.price.toFixed(2)}</p>
                                        <p className="text-[10px] text-white/40 mt-1.5 leading-tight">{ev.date}</p>
                                        {ev.location && <p className="text-[10px] text-white/30 truncate">{ev.location}</p>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Cart Panel (right) ───────────────────── */}
                    <div className="w-full lg:w-96 bg-white/5 border border-white/[0.08] rounded-2xl shadow-lg flex flex-col overflow-hidden flex-shrink-0 lg:sticky lg:top-4 h-fit max-h-[calc(100vh-100px)]">
                        {/* Cart header */}
                        <div className="p-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                                    <h2 className="font-bold text-white">Carrito</h2>
                                </div>
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                                    {cart.reduce((s, c) => s + c.qty, 0)} items
                                </span>
                            </div>
                        </div>

                        {/* Cart items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-white/30">
                                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Carrito vacío</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.product.id} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                                            <p className="text-xs text-purple-600 font-bold">${(item.product.price * item.qty).toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white/60 flex items-center justify-center transition-colors">
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs font-bold w-5 text-center text-white">{item.qty}</span>
                                            <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white/60 flex items-center justify-center transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400 hover:text-red-500 transition-colors ml-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart totals + actions */}
                        <div className="border-t border-white/5 p-4 space-y-3 bg-white/5">
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between font-black text-lg text-white">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* ── Nuevo Alumno (solo cuando hay plan en el carrito) ── */}
                            {hasPlan && (
                                <div className={`rounded-xl border transition-all ${showNewMemberForm ? "border-blue-500/40 bg-blue-500/10" : "border-white/10 bg-white/5"}`}>
                                    <button
                                        onClick={() => { setShowNewMemberForm(!showNewMemberForm); setSelectedCustomer(null); }}
                                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors"
                                    >
                                        <span className={`flex items-center gap-2 ${showNewMemberForm ? "text-blue-300" : "text-white/50"}`}>
                                            <UserPlus className="w-3.5 h-3.5" />
                                            Registrar nuevo alumno
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${showNewMemberForm ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-white/30"}`}>
                                            {showNewMemberForm ? "activo" : "plan detectado"}
                                        </span>
                                    </button>
                                    {showNewMemberForm && (
                                        <div className="px-3 pb-3 space-y-2 border-t border-blue-500/20 pt-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre completo *"
                                                value={newMember.full_name}
                                                onChange={e => setNewMember(p => ({ ...p, full_name: e.target.value }))}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-400 placeholder-white/30"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Correo electrónico *"
                                                value={newMember.email}
                                                onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-400 placeholder-white/30"
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Teléfono (opcional)"
                                                value={newMember.phone}
                                                onChange={e => setNewMember(p => ({ ...p, phone: e.target.value }))}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-blue-400 placeholder-white/30"
                                            />
                                            <input
                                                type="password"
                                                placeholder="Contraseña * (mín. 8 caracteres)"
                                                value={newMember.password}
                                                onChange={e => setNewMember(p => ({ ...p, password: e.target.value }))}
                                                className={`w-full bg-black/30 border rounded-lg px-3 py-2 text-white text-xs outline-none placeholder-white/30 transition-colors ${
                                                    newMember.password && newMember.password.length < 8
                                                        ? "border-red-500/50 focus:border-red-400"
                                                        : "border-white/10 focus:border-blue-400"
                                                }`}
                                            />
                                            <input
                                                type="password"
                                                placeholder="Confirmar contraseña *"
                                                value={newMember.confirmPassword}
                                                onChange={e => setNewMember(p => ({ ...p, confirmPassword: e.target.value }))}
                                                className={`w-full bg-black/30 border rounded-lg px-3 py-2 text-white text-xs outline-none placeholder-white/30 transition-colors ${
                                                    newMember.confirmPassword && newMember.confirmPassword !== newMember.password
                                                        ? "border-red-500/50 focus:border-red-400"
                                                        : "border-white/10 focus:border-blue-400"
                                                }`}
                                            />
                                            {newMember.password.length > 0 && newMember.password.length < 8 && (
                                                <p className="text-[9px] text-red-400 pl-1">Mínimo 8 caracteres.</p>
                                            )}
                                            {newMember.confirmPassword.length > 0 && newMember.confirmPassword !== newMember.password && (
                                                <p className="text-[9px] text-red-400 pl-1">Las contraseñas no coinciden.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Visitante / Exhibición ── */}
                            {!showNewMemberForm && (
                                <div className={`rounded-xl border transition-all ${showGuestForm ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
                                    <button
                                        onClick={() => { setShowGuestForm(!showGuestForm); setSelectedCustomer(null); setShowCustomerSearch(false); }}
                                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors"
                                    >
                                        <span className={`flex items-center gap-2 ${showGuestForm ? "text-emerald-300" : "text-white/50"}`}>
                                            <Eye className="w-3.5 h-3.5" />
                                            Venta a visitante
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${showGuestForm ? "bg-emerald-500/30 text-emerald-300" : "bg-white/10 text-white/30"}`}>
                                            {showGuestForm ? "activo" : "exhibición"}
                                        </span>
                                    </button>
                                    {showGuestForm && (
                                        <div className="px-3 pb-3 space-y-2 border-t border-emerald-500/20 pt-2">
                                            <p className="text-[9px] text-emerald-300/70 italic">Solo captura datos de contacto. No crea cuenta de usuario.</p>
                                            <input
                                                type="text"
                                                placeholder="Nombre del visitante *"
                                                value={guest.name}
                                                onChange={e => setGuest(p => ({ ...p, name: e.target.value }))}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-400 placeholder-white/30"
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Teléfono (opcional)"
                                                value={guest.phone}
                                                onChange={e => setGuest(p => ({ ...p, phone: e.target.value }))}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-400 placeholder-white/30"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer assignment (solo si NO está en modo nuevo alumno ni visitante) */}
                            {!showNewMemberForm && !showGuestForm && (
                                selectedCustomer ? (
                                    <div className="flex items-center justify-between bg-purple-600/20 border border-purple-500/30 rounded-lg p-2.5">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-purple-400" />
                                            <div>
                                                <p className="text-xs font-medium text-white">{selectedCustomer.name}</p>
                                                <p className="text-[10px] text-purple-300">Saldo: ${selectedCustomer.balance}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedCustomer(null)} className="text-white/40 hover:text-white">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                                            className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                                        >
                                            <Search className="w-3.5 h-3.5" />
                                            Asignar a cuenta de cliente…
                                        </button>
                                        {showCustomerSearch && (
                                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente…"
                                                    value={customerSearch}
                                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                                    className="w-full px-3 py-2.5 text-sm bg-transparent border-b border-white/5 text-white outline-none"
                                                    autoFocus
                                                />
                                                <div className="max-h-40 overflow-y-auto">
                                                    {filteredCustomers.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch(""); }}
                                                            className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm flex items-center justify-between text-white"
                                                        >
                                                            <span className="font-medium">{c.name}</span>
                                                            <span className="text-xs text-white/40">Saldo: ${c.balance}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            {/* ── Botones de pago ── */}
                            {showGuestForm ? (
                                // Modo visitante: guest_checkout
                                <div className="grid grid-cols-3 gap-2">
                                    {(["cash", "card", "transfer"] as const).map(method => (
                                        <guestFetcher.Form key={method} method="post">
                                            <input type="hidden" name="intent" value="guest_checkout" />
                                            <input type="hidden" name="method" value={method} />
                                            <input type="hidden" name="guest_name" value={guest.name} />
                                            <input type="hidden" name="guest_phone" value={guest.phone} />
                                            <input type="hidden" name="total" value={total} />
                                            <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id.startsWith("event-") ? null : c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                            <button
                                                type="submit"
                                                disabled={cart.length === 0 || !guestIsValid || guestFetcher.state !== "idle"}
                                                className={`w-full flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors ${method === "cash" ? "bg-amber-500 hover:bg-amber-600" : method === "card" ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-600 hover:bg-teal-700"}`}
                                            >
                                                {guestFetcher.state !== "idle" ? (
                                                    <span className="text-xs">…</span>
                                                ) : method === "cash" ? (
                                                    <><Banknote className="w-4 h-4" /><span className="hidden sm:inline"> Efectivo</span></>
                                                ) : method === "card" ? (
                                                    <><CreditCard className="w-4 h-4" /><span className="hidden sm:inline"> Tarjeta</span></>
                                                ) : (
                                                    <><ArrowRightLeft className="w-4 h-4" /><span className="hidden sm:inline"> Transfer</span></>
                                                )}
                                            </button>
                                        </guestFetcher.Form>
                                    ))}
                                </div>
                            ) : showNewMemberForm ? (
                                // Modo nuevo alumno: plan_checkout
                                <div className="grid grid-cols-3 gap-2">
                                    {(["cash", "card", "transfer"] as const).map(method => (
                                        <newMemberFetcher.Form key={method} method="post">
                                            <input type="hidden" name="intent" value="plan_checkout" />
                                            <input type="hidden" name="method" value={method} />
                                            <input type="hidden" name="full_name" value={newMember.full_name} />
                                            <input type="hidden" name="email" value={newMember.email} />
                                            <input type="hidden" name="phone" value={newMember.phone} />
                                            <input type="hidden" name="password" value={newMember.password} />
                                            <input type="hidden" name="total" value={total} />
                                            <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price, category: c.product.category, metadata: c.product.metadata })))} />
                                            <button
                                                type="submit"
                                                disabled={cart.length === 0 || !newMemberIsValid || newMemberFetcher.state !== "idle"}
                                                className={`w-full flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors ${method === "cash" ? "bg-amber-500 hover:bg-amber-600" : method === "card" ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-600 hover:bg-teal-700"}`}
                                            >
                                                {newMemberFetcher.state !== "idle" ? (
                                                    <span className="text-xs">…</span>
                                                ) : method === "cash" ? (
                                                    <><Banknote className="w-4 h-4" /><span className="hidden sm:inline"> Efectivo</span></>
                                                ) : method === "card" ? (
                                                    <><CreditCard className="w-4 h-4" /><span className="hidden sm:inline"> Tarjeta</span></>
                                                ) : (
                                                    <><ArrowRightLeft className="w-4 h-4" /><span className="hidden sm:inline"> Transfer</span></>
                                                )}
                                            </button>
                                        </newMemberFetcher.Form>
                                    ))}
                                </div>
                            ) : (
                                // Modo normal: checkout estándar
                                <div className="grid grid-cols-3 gap-2">
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="intent" value="checkout" />
                                        <input type="hidden" name="method" value="cash" />
                                        <input type="hidden" name="total" value={total} />
                                        <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                        <button
                                            type="submit"
                                            disabled={cart.length === 0 || fetcher.state !== "idle"}
                                            className="w-full flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                        >
                                            <Banknote className="w-4 h-4" />
                                            <span className="hidden sm:inline">Efectivo</span>
                                        </button>
                                    </fetcher.Form>
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="intent" value="checkout" />
                                        <input type="hidden" name="method" value="card" />
                                        <input type="hidden" name="total" value={total} />
                                        <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                        <button
                                            type="submit"
                                            disabled={cart.length === 0 || fetcher.state !== "idle"}
                                            className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            <span className="hidden sm:inline">Tarjeta</span>
                                        </button>
                                    </fetcher.Form>
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="intent" value="checkout" />
                                        <input type="hidden" name="method" value="transfer" />
                                        <input type="hidden" name="total" value={total} />
                                        <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                        <button
                                            type="submit"
                                            disabled={cart.length === 0 || fetcher.state !== "idle"}
                                            className="w-full flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                        >
                                            <ArrowRightLeft className="w-4 h-4" />
                                            <span className="hidden sm:inline">Transfer</span>
                                        </button>
                                    </fetcher.Form>
                                </div>
                            )}

                            {selectedCustomer && !showNewMemberForm && !showGuestForm && (
                                <fetcher.Form method="post">
                                    <input type="hidden" name="intent" value="charge_account" />
                                    <input type="hidden" name="customerId" value={selectedCustomer.id} />
                                    <input type="hidden" name="total" value={total} />
                                    <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                    <button
                                        type="submit"
                                        disabled={cart.length === 0 || fetcher.state !== "idle"}
                                        className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        Cuenta ({selectedCustomer.name.split(" ")[0]})
                                    </button>
                                </fetcher.Form>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Catálogo de Productos</h2>
                        <button
                            onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Añadir Producto
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">Producto</th>
                                    <th className="px-4 py-3 font-medium">Categoría</th>
                                    <th className="px-4 py-3 font-medium">Precio</th>
                                    <th className="px-4 py-3 font-medium">Costo</th>
                                    <th className="px-4 py-3 font-medium">Margen</th>
                                    <th className="px-4 py-3 font-medium">Stock</th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {products.map((p) => {
                                    const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
                                    return (
                                    <tr key={p.id} className="text-white hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="font-bold">{p.name}</div>
                                            {p.description && <div className="text-xs text-white/40 line-clamp-1">{p.description}</div>}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60 uppercase">{p.category}</span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-purple-400">${p.price.toFixed(2)}</td>
                                        <td className="px-4 py-4 text-white/50">${p.cost.toFixed(2)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`text-xs font-bold ${margin >= 40 ? "text-green-400" : margin >= 20 ? "text-amber-400" : "text-red-400"}`}>
                                                {margin}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`font-medium ${p.stock <= LOW_STOCK_THRESHOLD ? "text-red-400" : "text-white/60"}`}>
                                                {p.stock} uni.
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="intent" value="toggle_active" />
                                                <input type="hidden" name="productId" value={p.id} />
                                                <input type="hidden" name="isActive" value={String(p.is_active)} />
                                                <button
                                                    type="submit"
                                                    className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${p.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                                                >
                                                    {p.is_active ? "Activo" : "Oculto"}
                                                </button>
                                            </fetcher.Form>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => { setEditingProduct(p); setShowAddModal(true); }}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <fetcher.Form method="post" onSubmit={(e) => { if (!confirm("¿Eliminar producto?")) e.preventDefault(); }}>
                                                    <input type="hidden" name="intent" value="delete_product" />
                                                    <input type="hidden" name="productId" value={p.id} />
                                                    <button type="submit" className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-all">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </fetcher.Form>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal for Add/Edit */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl mx-4 my-auto max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                            <h3 className="text-xl font-bold text-white">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h3>
                            <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="text-white/40 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <fetcher.Form method="post" className="p-6 space-y-4 overflow-y-auto" onSubmit={() => { setShowAddModal(false); setEditingProduct(null); }}>
                            <input type="hidden" name="intent" value="upsert_product" />
                            {editingProduct && <input type="hidden" name="id" value={editingProduct.id} />}
                            
                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Nombre del Producto</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    defaultValue={editingProduct?.name}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                    placeholder="Ej. Proteína Whey 1kg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Categoría</label>
                                    <select
                                        name="category"
                                        required
                                        defaultValue={editingProduct?.category || "beverage"}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all appearance-none"
                                    >
                                        <option value="beverage">Bebida</option>
                                        <option value="supplement">Suplemento</option>
                                        <option value="merch">Mercancía</option>
                                        <option value="package">Paquete</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Precio de Venta ($)</label>
                                    <input
                                        name="price"
                                        type="number"
                                        step="0.01"
                                        required
                                        defaultValue={editingProduct?.price}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Costo de Producción ($)</label>
                                    <input
                                        name="cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={editingProduct?.cost ?? 0}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex flex-col justify-end pb-1">
                                    <p className="text-[10px] text-white/30 italic">Costo por unidad. Visible solo en Finanzas para calcular margen bruto.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Stock Inicial</label>
                                    <input
                                        name="stock"
                                        type="number"
                                        required
                                        defaultValue={editingProduct?.stock || 0}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <p className="text-[10px] text-white/30 italic mb-1.5">Aparecerá en el POS y Tienda si el stock es &gt; 0</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Descripción (Opcional)</label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    defaultValue={editingProduct?.description || ""}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all resize-none"
                                    placeholder="Detalles sobre el producto…"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingProduct ? "Actualizar Producto" : "Crear Producto"}
                            </button>
                        </fetcher.Form>
                    </div>
                </div>
            )}
        </div>
    );
}
